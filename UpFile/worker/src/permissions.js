/**
 * permissions.js — Cloudflare Worker
 * Đọc tab UPload từ Google Sheets để xác định quyền upload của từng nhân viên.
 *
 * Cấu trúc tab UPload (dạng cột):
 *   Row 1: Header (department names) — VD: "", "1 DR", "2 HR", "3 ACC", ...
 *   Row 2: "Link Folder" + Drive folder URLs tương ứng
 *   Row 3+: Email nhân viên được cấp quyền (mỗi cột là 1 phòng ban)
 *
 * Ví dụ:
 *   Col A (Row 3+): Label (bỏ qua)
 *   Col B (Row 1): "1 DR",  Row 2: URL, Row 3+: emails
 *   Col C (Row 1): "2 HR",  Row 2: URL, Row 3+: emails
 */

import { GOOGLE_APIS, DEPARTMENTS } from "./config.js";

/**
 * Đọc toàn bộ tab UPload và trả về map quyền.
 * @param {Object} env
 * @param {string} ownerAccessToken — Access token của Owner A (để đọc Sheets)
 * @returns {Promise<Map<string, Set<string>>>} Map: departmentKey → Set of emails
 */
export async function fetchPermissions(env, ownerAccessToken) {
  const spreadsheetId = env.SPREADSHEET_ID;
  const sheetName = env.SHEET_UPLOAD_TAB || "UPload";

  // Đọc toàn bộ sheet (tối đa 200 dòng x 20 cột)
  const range = encodeURIComponent(`${sheetName}!A1:T200`);
  const url = `${GOOGLE_APIS.SHEETS_URL}/${spreadsheetId}/values/${range}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ownerAccessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to read Google Sheet: ${await res.text()}`);
  }

  const data = await res.json();
  const rows = data.values || [];

  if (rows.length < 3) {
    return new Map(); // Sheet trống hoặc thiếu dữ liệu
  }

  // Row 0 = headers (department names), Row 1 = folder URLs, Row 2+ = emails
  const headers = rows[0]; // ["", "1 DR", "2 HR", ...]

  // Tìm index cột theo department name
  const deptColMap = {}; // { "1 DR": 1, "2 HR": 2, ... }
  for (let col = 1; col < headers.length; col++) {
    const dept = (headers[col] || "").trim();
    if (dept && DEPARTMENTS[dept]) {
      deptColMap[dept] = col;
    }
  }

  // Xây dựng permission map: { email → [depts] }
  const permMap = new Map(); // departmentKey → Set<email>

  for (const [dept] of Object.entries(deptColMap)) {
    permMap.set(dept, new Set());
  }

  // Từ row 2 trở đi chứa emails
  for (let row = 2; row < rows.length; row++) {
    const rowData = rows[row] || [];
    for (const [dept, colIdx] of Object.entries(deptColMap)) {
      const cellVal = (rowData[colIdx] || "").trim().toLowerCase();
      if (cellVal && cellVal.includes("@")) {
        permMap.get(dept)?.add(cellVal);
      }
    }
  }

  return permMap;
}

/**
 * Lấy danh sách phòng ban mà email này được quyền upload.
 * @param {string} email
 * @param {Map} permMap
 * @returns {string[]} Danh sách department keys
 */
export function getAuthorizedDepartments(email, permMap) {
  const normalizedEmail = email.trim().toLowerCase();
  const authorized = [];
  for (const [dept, emails] of permMap.entries()) {
    if (emails.has(normalizedEmail)) {
      authorized.push(dept);
    }
  }
  return authorized;
}

/**
 * Kiểm tra email có quyền với department cụ thể không.
 * @param {string} email
 * @param {string} department
 * @param {Map} permMap
 * @returns {boolean}
 */
export function hasPermission(email, department, permMap) {
  const normalizedEmail = email.trim().toLowerCase();
  return permMap.get(department)?.has(normalizedEmail) ?? false;
}

/**
 * Cache permissions trong KV hoặc memory đơn giản để giảm Sheets API calls.
 * Cloudflare Worker không có state giữa requests, dùng Cache API nếu có.
 * Mỗi permission check cache 5 phút.
 */
const PERM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
let _permCache = null;
let _permCacheTime = 0;

export async function getCachedPermissions(env, ownerAccessToken) {
  const now = Date.now();
  if (_permCache && (now - _permCacheTime) < PERM_CACHE_TTL_MS) {
    return _permCache;
  }
  _permCache = await fetchPermissions(env, ownerAccessToken);
  _permCacheTime = now;
  return _permCache;
}
