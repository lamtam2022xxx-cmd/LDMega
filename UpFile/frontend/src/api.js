/**
 * api.js — Frontend API client
 * Tất cả request đến Cloudflare Worker đều kèm theo Google ID Token trong header.
 * ID Token của nhân viên chỉ dùng để xác thực danh tính — không dùng để tạo file Drive.
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "";

/** Helper: gọi Worker API với xác thực */
async function workerFetch(path, options = {}, idToken) {
  const headers = {
    "Content-Type": "application/json",
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

/**
 * Lấy thông tin nhân viên và danh sách phòng ban được phép.
 * @param {string} idToken — Google ID Token
 * @returns {Promise<{email, name, picture, departments: Array}>}
 */
export async function fetchMe(idToken) {
  return workerFetch("/api/me", { method: "GET" }, idToken);
}

/**
 * Lấy danh sách subfolder trong phòng ban.
 * @param {string} parentId — Folder ID của thư mục cha
 * @param {string} department — Department key (VD: "2 HR")
 * @param {string} idToken
 * @returns {Promise<{folders: Array<{id, name}>}>}
 */
export async function fetchFolders(parentId, department, idToken) {
  const params = new URLSearchParams({ parentId, department });
  return workerFetch(`/api/folders?${params}`, { method: "GET" }, idToken);
}

/**
 * Khởi tạo phiên Resumable Upload.
 * Backend tạo session bằng OAuth của Owner A, trả về uploadUrl.
 * @param {Object} fileInfo
 * @param {string} idToken
 * @returns {Promise<{uploadUrl: string, uploadId: string}>}
 */
export async function startUploadSession(fileInfo, idToken) {
  return workerFetch("/api/upload/start", {
    method: "POST",
    body: JSON.stringify(fileInfo),
  }, idToken);
}

/**
 * Thông báo upload hoàn tất — backend verify và ghi log.
 * @param {string} fileId — Drive File ID (từ response cuối của resumable upload)
 * @param {string} uploadId
 * @param {string} department
 * @param {string} idToken
 */
export async function completeUpload(fileId, uploadId, department, idToken) {
  return workerFetch("/api/upload/complete", {
    method: "POST",
    body: JSON.stringify({ fileId, uploadId, department }),
  }, idToken);
}
