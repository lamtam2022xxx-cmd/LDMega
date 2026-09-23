/**
 * logger.js — Cloudflare Worker
 * Ghi log upload vào tab Upload_Log của Google Sheets.
 * Không lưu OAuth token hoặc credential nhạy cảm.
 */

import { GOOGLE_APIS } from "./config.js";

/**
 * Trạng thái upload hợp lệ theo spec
 */
export const UPLOAD_STATUS = {
  STARTED:    "STARTED",
  UPLOADING:  "UPLOADING",
  COMPLETED:  "COMPLETED",
  FAILED:     "FAILED",
  CANCELLED:  "CANCELLED",
};

/**
 * Ghi một dòng vào tab Upload_Log.
 * Cột theo spec mục 11:
 * Timestamp | Email | Department | Folder | Subfolder | File Name | File Size |
 * MIME Type | Drive File ID | Drive URL | Status | Upload ID
 *
 * @param {Object} logEntry
 * @param {string} ownerToken
 * @param {Object} env
 */
export async function writeUploadLog(logEntry, ownerToken, env) {
  const {
    timestamp = new Date().toISOString(),
    email = "",
    department = "",
    folder = "",
    subfolder = "",
    fileName = "",
    fileSize = 0,
    mimeType = "",
    driveFileId = "",
    driveUrl = "",
    status = UPLOAD_STATUS.STARTED,
    uploadId = "",
  } = logEntry;

  const spreadsheetId = env.SPREADSHEET_ID;
  const sheetName = env.SHEET_LOG_TAB || "Upload_Log";

  const row = [
    timestamp,
    email,
    department,
    folder,
    subfolder,
    fileName,
    String(fileSize),
    mimeType,
    driveFileId,
    driveUrl,
    status,
    uploadId,
  ];

  const url = `${GOOGLE_APIS.SHEETS_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [row],
      }),
    });

    if (!res.ok) {
      console.error("Failed to write upload log:", await res.text());
    }
  } catch (err) {
    // Log lỗi nhưng không throw để không ảnh hưởng upload chính
    console.error("Logger error:", err.message);
  }
}

/**
 * Đảm bảo tab Upload_Log tồn tại với header đúng.
 * Gọi một lần khi setup.
 */
export async function ensureLogSheetHeader(ownerToken, env) {
  const spreadsheetId = env.SPREADSHEET_ID;
  const sheetName = env.SHEET_LOG_TAB || "Upload_Log";

  const checkUrl = `${GOOGLE_APIS.SHEETS_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1`;
  const checkRes = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  if (!checkRes.ok) return; // Sheet có thể chưa tồn tại, bỏ qua

  const checkData = await checkRes.json();
  const existingVal = checkData.values?.[0]?.[0];
  if (existingVal) return; // Đã có header

  // Ghi header
  const headers = [
    "Timestamp", "Email", "Department", "Folder", "Subfolder",
    "File Name", "File Size", "MIME Type", "Drive File ID", "Drive URL",
    "Status", "Upload ID",
  ];

  const url = `${GOOGLE_APIS.SHEETS_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=RAW`;
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [headers] }),
  });
}
