/**
 * auth.js — Cloudflare Worker
 * Xác thực nhân viên qua Google ID Token (từ "Sign in with Google").
 * KHÔNG dùng OAuth token của nhân viên để tạo file Drive.
 * Credential của Account A (Owner) tuyệt đối chỉ ở server-side.
 */

import { GOOGLE_APIS } from "./config.js";

/**
 * Lấy Access Token của Owner Account A từ Refresh Token.
 * Refresh Token và Client Secret chỉ có trong Cloudflare Worker Secrets.
 * @param {Object} env
 * @returns {Promise<string>} Access Token
 */
export async function getOwnerAccessToken(env) {
  const res = await fetch(GOOGLE_APIS.TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.OWNER_REFRESH_TOKEN,
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to refresh Owner token: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Xác thực Google ID Token của nhân viên (từ Sign in with Google frontend).
 * @param {string} idToken — ID Token từ frontend Google Sign-In
 * @param {Object} env
 * @returns {Promise<{email: string, name: string, picture: string}>}
 */
export async function verifyEmployeeIdToken(idToken, env) {
  const res = await fetch(`${GOOGLE_APIS.TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);

  if (!res.ok) {
    throw new Error("Invalid ID token");
  }

  const payload = await res.json();

  // Kiểm tra audience khớp với Google Client ID của hệ thống
  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error("Token audience mismatch");
  }

  // Token phải còn hạn
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || parseInt(payload.exp) < now) {
    throw new Error("Token expired");
  }

  if (!payload.email_verified) {
    throw new Error("Email not verified by Google");
  }

  return {
    email:   payload.email,
    name:    payload.name || "",
    picture: payload.picture || "",
  };
}

/**
 * Parse Authorization header dạng "Bearer <idToken>"
 * @param {Request} request
 * @returns {string|null}
 */
export function extractBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}
