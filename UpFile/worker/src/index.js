/**
 * index.js — Cloudflare Worker (Entry Point)
 * Backend = Control Plane
 * Google Drive Upload = Data Plane (client PUT trực tiếp lên Drive sau khi có session URL)
 *
 * API Routes:
 *   GET  /api/me                    — Thông tin nhân viên + authorized departments
 *   GET  /api/folders?parentId=...  — Danh sách subfolder (chỉ bên trong dept được phép)
 *   POST /api/upload/start          — Tạo Drive resumable session, trả uploadUrl
 *   POST /api/upload/complete       — Verify file sau khi upload xong, ghi log
 *   GET  /health                    — Health check
 */

import { getOwnerAccessToken, verifyEmployeeIdToken, extractBearerToken } from "./auth.js";
import { getCachedPermissions, getAuthorizedDepartments, hasPermission } from "./permissions.js";
import { validateFolderAncestor, listSubfolders, createResumableSession, getDriveFileInfo } from "./drive.js";
import { writeUploadLog, ensureLogSheetHeader, UPLOAD_STATUS } from "./logger.js";
import { DEPARTMENTS, buildFolderMap, isFolderAllowed } from "./config.js";

// =========================================================
// CORS Helper
// =========================================================
function corsHeaders(env, requestOrigin) {
  const allowedOrigins = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data, status = 200, corsH = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsH },
  });
}

function errorResponse(message, status = 400, corsH = {}) {
  return jsonResponse({ error: message }, status, corsH);
}

// =========================================================
// Rate Limiter (in-memory, per Worker instance — đủ cho V1)
// =========================================================
const rateLimitMap = new Map(); // email → { count, resetAt }

function checkRateLimit(email, env) {
  const limit = parseInt(env.RATE_LIMIT_RPM || "30");
  const now = Date.now();
  const windowMs = 60 * 1000;

  let state = rateLimitMap.get(email);
  if (!state || now > state.resetAt) {
    state = { count: 0, resetAt: now + windowMs };
  }

  state.count++;
  rateLimitMap.set(email, state);

  return state.count <= limit;
}

// =========================================================
// Main Handler
// =========================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const requestOrigin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, requestOrigin);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health check (không cần auth)
    if (path === "/health" && request.method === "GET") {
      return jsonResponse({ status: "ok", ts: new Date().toISOString() }, 200, cors);
    }

    // ---- Routes cần xác thực ----
    try {
      // 1. Lấy Access Token của Owner A
      const ownerToken = await getOwnerAccessToken(env);

      // 2. Xác thực nhân viên qua Google ID Token
      const idToken = extractBearerToken(request);
      if (!idToken) {
        return errorResponse("Missing Authorization header", 401, cors);
      }

      let employee;
      try {
        employee = await verifyEmployeeIdToken(idToken, env);
      } catch (authErr) {
        return errorResponse(`Authentication failed: ${authErr.message}`, 401, cors);
      }

      // 3. Rate limiting
      if (!checkRateLimit(employee.email, env)) {
        return errorResponse("Rate limit exceeded. Please try again later.", 429, cors);
      }

      // 4. Đọc permission từ Google Sheet
      const permMap = await getCachedPermissions(env, ownerToken);
      const folderMap = buildFolderMap(env);

      // ---- Route: GET /api/me ----
      if (path === "/api/me" && request.method === "GET") {
        const authorizedDepts = getAuthorizedDepartments(employee.email, permMap);
        const departments = authorizedDepts.map(dept => ({
          key:      dept,
          label:    DEPARTMENTS[dept]?.label || dept,
          folderId: folderMap[dept] || null,
        }));

        return jsonResponse({
          email:      employee.email,
          name:       employee.name,
          picture:    employee.picture,
          departments,
        }, 200, cors);
      }

      // ---- Route: GET /api/folders?parentId=&department= ----
      if (path === "/api/folders" && request.method === "GET") {
        const parentId   = url.searchParams.get("parentId");
        const department = url.searchParams.get("department");

        if (!parentId || !department) {
          return errorResponse("Missing parentId or department parameter", 400, cors);
        }

        // Kiểm tra quyền với department
        if (!hasPermission(employee.email, department, permMap)) {
          return errorResponse("Access denied to this department", 403, cors);
        }

        const deptRootId = folderMap[department];
        if (!deptRootId) {
          return errorResponse("Department folder not configured", 500, cors);
        }

        // Validate parentId có thuộc department root không
        const isValidParent = await validateFolderAncestor(parentId, deptRootId, ownerToken);
        if (!isValidParent) {
          return errorResponse("Folder not in authorized department", 403, cors);
        }

        const subfolders = await listSubfolders(parentId, ownerToken);
        return jsonResponse({ folders: subfolders }, 200, cors);
      }

      // ---- Route: POST /api/upload/start ----
      if (path === "/api/upload/start" && request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Invalid JSON body", 400, cors);
        }

        const { filename, mimeType, size, department, folderId } = body;

        // Validate required fields
        if (!filename || !mimeType || !size || !department || !folderId) {
          return errorResponse("Missing required fields: filename, mimeType, size, department, folderId", 400, cors);
        }

        // Validate file size (tối đa 100GB để có buffer)
        const MAX_SIZE = 100 * 1024 * 1024 * 1024;
        if (size <= 0 || size > MAX_SIZE) {
          return errorResponse("Invalid file size", 400, cors);
        }

        // Kiểm tra quyền với department
        if (!hasPermission(employee.email, department, permMap)) {
          return errorResponse("Access denied to department: " + department, 403, cors);
        }

        const deptRootId = folderMap[department];
        if (!deptRootId) {
          return errorResponse("Department folder not configured", 500, cors);
        }

        // Validate folderId thuộc department (quan trọng: ngăn bypass)
        const isValidFolder = await validateFolderAncestor(folderId, deptRootId, ownerToken);
        if (!isValidFolder) {
          return errorResponse("Destination folder is not in authorized department", 403, cors);
        }

        // Tạo Resumable Upload Session bằng OAuth của Owner A
        let sessionResult;
        try {
          sessionResult = await createResumableSession(
            { fileName: filename, mimeType, fileSize: size, folderId },
            ownerToken
          );
        } catch (driveErr) {
          return errorResponse(`Drive session error: ${driveErr.message}`, 502, cors);
        }

        const { uploadUrl, uploadId } = sessionResult;

        // Ghi log STARTED vào Google Sheets (không await để không làm chậm response)
        ctx.waitUntil(writeUploadLog({
          email:      employee.email,
          department,
          folder:     department,
          subfolder:  folderId !== deptRootId ? folderId : "",
          fileName:   filename,
          fileSize:   size,
          mimeType,
          status:     UPLOAD_STATUS.STARTED,
          uploadId,
        }, ownerToken, env));

        return jsonResponse({
          uploadUrl,
          uploadId,
          message: "Resumable upload session created. PUT file chunks to uploadUrl.",
        }, 200, cors);
      }

      // ---- Route: POST /api/upload/complete ----
      if (path === "/api/upload/complete" && request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Invalid JSON body", 400, cors);
        }

        const { fileId, uploadId, department } = body;

        if (!fileId || !uploadId) {
          return errorResponse("Missing fileId or uploadId", 400, cors);
        }

        // Kiểm tra quyền
        if (department && !hasPermission(employee.email, department, permMap)) {
          return errorResponse("Access denied", 403, cors);
        }

        // Lấy thông tin file Drive để verify và log
        let fileInfo;
        try {
          fileInfo = await getDriveFileInfo(fileId, ownerToken);
        } catch (driveErr) {
          return errorResponse(`Drive verify error: ${driveErr.message}`, 502, cors);
        }

        // Ghi log COMPLETED
        ctx.waitUntil(writeUploadLog({
          email:       employee.email,
          department:  department || "",
          fileName:    fileInfo.name,
          fileSize:    fileInfo.size,
          mimeType:    fileInfo.mimeType,
          driveFileId: fileInfo.id,
          driveUrl:    fileInfo.webViewLink,
          status:      UPLOAD_STATUS.COMPLETED,
          uploadId,
        }, ownerToken, env));

        return jsonResponse({
          success:  true,
          fileId:   fileInfo.id,
          fileName: fileInfo.name,
          url:      fileInfo.webViewLink,
          size:     fileInfo.size,
        }, 200, cors);
      }

      return errorResponse("Route not found", 404, cors);

    } catch (err) {
      console.error("Worker unhandled error:", err);
      return errorResponse(`Server error: ${err.message}`, 500,
        corsHeaders(env, request.headers.get("Origin") || ""));
    }
  },
};
