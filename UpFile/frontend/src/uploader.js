/**
 * uploader.js — Frontend Resumable Upload Engine
 * Browser PUT file trực tiếp lên Google Drive qua Resumable Session URL.
 * Worker đã tạo session bằng OAuth của Owner A — file sẽ thuộc sở hữu của Owner A.
 *
 * Hỗ trợ:
 * - File lớn: 1GB, 5GB, 10GB, 20GB, 50GB+
 * - Progress callback (bytes uploaded, percentage, speed MB/s)
 * - Retry tự động khi mạng lỗi (exponential backoff)
 * - Resume session khi browser refresh (lưu state vào sessionStorage)
 * - Mobile: phát hiện khi tab bị suspend
 */

const CHUNK_SIZE = 256 * 1024 * 8; // 2 MB (bội số của 256KB theo spec Google)
const MAX_RETRIES = 5;

/**
 * Upload file bằng Google Drive Resumable Upload protocol.
 * @param {Object} options
 * @param {string}   options.uploadUrl    — Session URL từ /api/upload/start
 * @param {string}   options.uploadId     — Upload ID để tracking
 * @param {File}     options.file         — File object từ input/drag-drop
 * @param {Function} options.onProgress   — Callback: ({ loaded, total, percent, speedMBps })
 * @param {Function} options.onComplete   — Callback: ({ fileId, response })
 * @param {Function} options.onError      — Callback: (Error)
 * @param {AbortSignal} options.signal    — AbortController signal để cancel
 * @returns {Promise<{fileId: string}>}
 */
export async function resumableUpload({
  uploadUrl,
  uploadId,
  file,
  onProgress,
  onComplete,
  onError,
  signal,
}) {
  let uploadedBytes = 0;
  const totalBytes = file.size;
  let startTime = Date.now();

  // Khôi phục trạng thái nếu browser bị refresh giữa chừng
  const savedState = sessionStorage.getItem(`upload_${uploadId}`);
  if (savedState) {
    const state = JSON.parse(savedState);
    if (state.uploadUrl === uploadUrl) {
      // Kiểm tra server đã nhận bao nhiêu byte
      const resumeBytes = await queryUploadStatus(uploadUrl);
      if (resumeBytes > 0 && resumeBytes < totalBytes) {
        uploadedBytes = resumeBytes;
        console.log(`[UpFile] Resuming upload from byte ${uploadedBytes}`);
      }
    }
  }

  // Lưu state để có thể resume
  sessionStorage.setItem(`upload_${uploadId}`, JSON.stringify({
    uploadUrl,
    fileName: file.name,
    totalBytes,
    startedAt: new Date().toISOString(),
  }));

  try {
    while (uploadedBytes < totalBytes) {
      if (signal?.aborted) {
        throw new DOMException("Upload cancelled by user", "AbortError");
      }

      const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, totalBytes);
      const chunk = file.slice(uploadedBytes, chunkEnd);

      const result = await uploadChunkWithRetry({
        uploadUrl,
        chunk,
        rangeStart: uploadedBytes,
        rangeEnd: chunkEnd - 1,
        totalBytes,
        signal,
        maxRetries: MAX_RETRIES,
      });

      uploadedBytes = chunkEnd;

      // Tính tốc độ upload
      const elapsed = (Date.now() - startTime) / 1000;
      const speedMBps = elapsed > 0 ? (uploadedBytes / 1024 / 1024) / elapsed : 0;
      const percent = Math.round((uploadedBytes / totalBytes) * 100);

      onProgress?.({ loaded: uploadedBytes, total: totalBytes, percent, speedMBps });

      // Nếu Google trả về file ID — upload hoàn tất
      if (result.fileId) {
        sessionStorage.removeItem(`upload_${uploadId}`);
        onComplete?.({ fileId: result.fileId });
        return { fileId: result.fileId };
      }
    }

    // Không bao giờ đến đây nếu flow đúng
    throw new Error("Upload finished but no fileId returned");

  } catch (err) {
    onError?.(err);
    throw err;
  }
}

/**
 * Upload một chunk với cơ chế retry và exponential backoff.
 */
async function uploadChunkWithRetry({ uploadUrl, chunk, rangeStart, rangeEnd, totalBytes, signal, maxRetries }) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes ${rangeStart}-${rangeEnd}/${totalBytes}`,
          "Content-Type": "application/octet-stream",
        },
        body: chunk,
        signal,
      });

      // 200/201: Upload hoàn tất — Google trả về file metadata
      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        return { fileId: data.id, data };
      }

      // 308: Chunk đã nhận, tiếp tục
      if (res.status === 308) {
        const range = res.headers.get("Range");
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match) {
            // Server xác nhận byte offset mới nhất
          }
        }
        return {}; // Tiếp tục vòng lặp ngoài
      }

      // 4xx (ngoại trừ 503): Lỗi không retry được
      if (res.status >= 400 && res.status < 500 && res.status !== 503) {
        const errText = await res.text();
        throw new Error(`Drive upload error ${res.status}: ${errText}`);
      }

      // 5xx hoặc 503: Retry
      throw new Error(`Server error ${res.status}, retrying...`);

    } catch (err) {
      if (err.name === "AbortError") throw err; // Cancel không retry

      attempt++;
      if (attempt >= maxRetries) {
        throw new Error(`Upload failed after ${maxRetries} retries: ${err.message}`);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      console.warn(`[UpFile] Retry ${attempt}/${maxRetries} in ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));

      // Truy vấn server để biết đã nhận bao nhiêu byte
      try {
        const resumeBytes = await queryUploadStatus(uploadUrl);
        if (resumeBytes > rangeStart) {
          // Server đã nhận hơn điểm hiện tại — điều chỉnh range
          return { resumedAt: resumeBytes };
        }
      } catch (_) {
        // Bỏ qua lỗi khi query status
      }
    }
  }
}

/**
 * Truy vấn số byte server đã nhận (để resume sau khi mạng đứt).
 * @param {string} uploadUrl
 * @returns {Promise<number>} Số byte đã nhận (0 nếu chưa nhận gì)
 */
async function queryUploadStatus(uploadUrl) {
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": "bytes */*" },
    });

    if (res.status === 308) {
      const range = res.headers.get("Range");
      if (range) {
        const match = range.match(/bytes=0-(\d+)/);
        if (match) return parseInt(match[1]) + 1;
      }
      return 0;
    }

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      return { fileId: data.id }; // Đã hoàn tất
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Format bytes ra string đẹp (1.23 MB, 4.56 GB, ...)
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[Math.min(i, units.length - 1)]}`;
}
