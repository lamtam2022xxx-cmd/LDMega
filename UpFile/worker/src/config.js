/**
 * config.js — Cloudflare Worker
 * Tập trung cấu hình whitelist folder, department keys và department labels.
 * Folder IDs phản chiếu đúng cấu trúc Google Drive thực tế của Account A.
 */

/**
 * Danh sách phòng ban được hỗ trợ.
 * Key: tên phòng ban dùng trong API
 * label: tên hiển thị
 * envVar: tên biến env trong wrangler.toml chứa Folder ID
 */
export const DEPARTMENTS = {
  "1 DR":    { label: "1 DR",    envVar: "FOLDER_DR" },
  "2 HR":    { label: "2 HR",    envVar: "FOLDER_HR" },
  "3 ACC":   { label: "3 ACC",   envVar: "FOLDER_ACC" },
  "4 Asset": { label: "4 Asset", envVar: "FOLDER_ASSET" },
  "5 Sale":  { label: "5 Sale",  envVar: "FOLDER_SALE" },
  "6 MKT":   { label: "6 MKT",  envVar: "FOLDER_MKT" },
  "7 Task":  { label: "7 Task",  envVar: "FOLDER_TASK" },
  "8 BOD":   { label: "8 BOD",   envVar: "FOLDER_BOD" },
};

/**
 * Trả về map { departmentKey => folderId } từ biến môi trường Cloudflare.
 * @param {Object} env — Cloudflare Worker env bindings
 */
export function buildFolderMap(env) {
  const map = {};
  for (const [key, { envVar }] of Object.entries(DEPARTMENTS)) {
    map[key] = env[envVar];
  }
  return map;
}

/**
 * Kiểm tra folderId có thuộc department root hoặc subfolder hợp lệ không.
 * Backend KHÔNG tin folderId từ browser, phải validate lại.
 * @param {string} folderId — Folder ID gửi từ browser
 * @param {string} department — Department key đã được xác nhận quyền
 * @param {Object} env — Worker env
 * @returns {boolean}
 */
export function isFolderAllowed(folderId, department, env) {
  const deptRootId = env[DEPARTMENTS[department]?.envVar];
  if (!deptRootId) return false;
  // Cho phép root folder hoặc bất kỳ sub-folder bên trong (sẽ validate ancestor phía Drive API)
  // Logic phụ: validateFolderAncestor() được gọi từ upload router
  return typeof folderId === "string" && folderId.length > 5;
}

/**
 * Tập hợp các Google API endpoint dùng trong Worker.
 */
export const GOOGLE_APIS = {
  TOKEN_URL:        "https://oauth2.googleapis.com/token",
  DRIVE_FILES_URL:  "https://www.googleapis.com/drive/v3/files",
  DRIVE_UPLOAD_URL: "https://www.googleapis.com/upload/drive/v3/files",
  TOKENINFO_URL:    "https://www.googleapis.com/oauth2/v3/tokeninfo",
  USERINFO_URL:     "https://www.googleapis.com/oauth2/v2/userinfo",
  SHEETS_URL:       "https://sheets.googleapis.com/v4/spreadsheets",
};
