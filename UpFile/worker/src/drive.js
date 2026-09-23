/**
 * drive.js — Cloudflare Worker
 * Tất cả Google Drive API calls đều dùng Access Token của Owner A.
 * KHÔNG bao giờ dùng token của nhân viên để tạo/modify file Drive.
 */

import { GOOGLE_APIS, DEPARTMENTS } from "./config.js";

/**
 * Kiểm tra folder có thực sự là con (ancestor) của department root không.
 * Đây là bảo vệ quan trọng: ngăn nhân viên truyền folderId tùy ý.
 * @param {string} folderId — Folder ID cần kiểm tra
 * @param {string} departmentRootId — Department root folder ID đã whitelist
 * @param {string} ownerToken
 * @returns {Promise<boolean>}
 */
export async function validateFolderAncestor(folderId, departmentRootId, ownerToken) {
  // Nếu folderId chính là root thì cho phép
  if (folderId === departmentRootId) return true;

  // Duyệt lên parent cho đến khi tìm thấy departmentRootId hoặc hết cây
  let currentId = folderId;
  const maxDepth = 10; // Tránh vòng lặp vô tận

  for (let i = 0; i < maxDepth; i++) {
    const url = `${GOOGLE_APIS.DRIVE_FILES_URL}/${currentId}?fields=id,name,parents,trashed`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    if (!res.ok) return false;

    const fileData = await res.json();
    if (fileData.trashed) return false;

    const parents = fileData.parents || [];
    if (parents.includes(departmentRootId)) return true;
    if (parents.length === 0) return false;

    currentId = parents[0]; // Đi lên parent tiếp theo
  }

  return false;
}

/**
 * Liệt kê folder con bên trong một folder (chỉ trả về folder, không trả file).
 * @param {string} parentFolderId
 * @param {string} ownerToken
 * @returns {Promise<Array<{id, name}>>}
 */
export async function listSubfolders(parentFolderId, ownerToken) {
  const query = encodeURIComponent(
    `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const url = `${GOOGLE_APIS.DRIVE_FILES_URL}?q=${query}&fields=files(id,name)&orderBy=name&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  if (!res.ok) {
    throw new Error(`Drive list subfolders failed: ${await res.text()}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Khởi tạo Google Drive Resumable Upload Session.
 * Backend tạo session bằng OAuth của Owner A, trả về uploadUrl cho client.
 * Client sẽ PUT file trực tiếp vào uploadUrl — không qua Worker.
 *
 * @param {Object} params
 * @param {string} params.fileName
 * @param {string} params.mimeType
 * @param {number} params.fileSize — Bytes
 * @param {string} params.folderId — Đã được validate là trong whitelist
 * @param {string} ownerToken
 * @returns {Promise<{uploadUrl: string, uploadId: string}>}
 */
export async function createResumableSession(params, ownerToken) {
  const { fileName, mimeType, fileSize, folderId } = params;

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const url = `${GOOGLE_APIS.DRIVE_UPLOAD_URL}?uploadType=resumable`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(fileSize),
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive resumable session creation failed: ${errText}`);
  }

  // Google trả về Session URI trong Location header
  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("No Location header returned from Drive API");
  }

  // Trích xuất upload ID từ URL để dùng cho logging
  const uploadIdMatch = uploadUrl.match(/upload_id=([^&]+)/);
  const uploadId = uploadIdMatch ? uploadIdMatch[1] : crypto.randomUUID();

  return { uploadUrl, uploadId };
}

/**
 * Lấy thông tin file Drive sau khi upload hoàn tất (để verify và log).
 * @param {string} fileId
 * @param {string} ownerToken
 * @returns {Promise<Object>}
 */
export async function getDriveFileInfo(fileId, ownerToken) {
  const fields = "id,name,size,mimeType,webViewLink,webContentLink,parents,createdTime,owners";
  const url = `${GOOGLE_APIS.DRIVE_FILES_URL}/${fileId}?fields=${encodeURIComponent(fields)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  if (!res.ok) {
    throw new Error(`Drive getFile failed: ${await res.text()}`);
  }

  return res.json();
}
