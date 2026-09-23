/**
 * oauth_setup.js — Script hỗ trợ lấy Refresh Token của Account A (Owner)
 * Chạy một lần trên máy tính cá nhân để lấy OWNER_REFRESH_TOKEN.
 * KHÔNG đưa file này lên GitHub.
 *
 * Sử dụng:
 *   node oauth_setup.js
 *
 * Cần điền:
 *   CLIENT_ID, CLIENT_SECRET từ Google Cloud Console
 *   (APIs & Services > Credentials > OAuth 2.0 Client IDs)
 */

import http from "http";
import { URL } from "url";
import { exec } from "child_process";

// =========================================================
// Điền thông tin Google Cloud Project của bạn vào đây
// =========================================================
const CLIENT_ID     = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
const REDIRECT_URI  = "http://localhost:3333/oauth/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
// =========================================================

const AUTH_URL = new URL("https://accounts.google.com/o/oauth2/v2/auth");
AUTH_URL.searchParams.set("client_id",     CLIENT_ID);
AUTH_URL.searchParams.set("redirect_uri",  REDIRECT_URI);
AUTH_URL.searchParams.set("response_type", "code");
AUTH_URL.searchParams.set("scope",         SCOPES);
AUTH_URL.searchParams.set("access_type",   "offline");
AUTH_URL.searchParams.set("prompt",        "consent"); // Bắt buộc để nhận refresh_token

console.log("\n🔐 LDMega Owner OAuth Setup\n");
console.log("Đang mở trình duyệt để đăng nhập Account A (Owner)...");
console.log("URL:", AUTH_URL.toString(), "\n");

// Mở trình duyệt
const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
exec(`${openCmd} "${AUTH_URL.toString()}"`);

// Tạo server tạm thời để nhận callback
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, "http://localhost:3333");
  const code = reqUrl.searchParams.get("code");

  if (!code) {
    res.end("No code received.");
    return;
  }

  res.end("<html><body><h2>✅ Authorization nhận thành công! Quay lại terminal để xem Refresh Token.</h2></body></html>");

  // Đổi code lấy token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (tokens.refresh_token) {
    console.log("\n✅ LẤY REFRESH TOKEN THÀNH CÔNG!");
    console.log("━".repeat(60));
    console.log("OWNER_REFRESH_TOKEN=", tokens.refresh_token);
    console.log("━".repeat(60));
    console.log("\nĐiền giá trị OWNER_REFRESH_TOKEN này vào Cloudflare Worker Secrets:");
    console.log("  wrangler secret put OWNER_REFRESH_TOKEN\n");
    console.log("Cũng cần điền:");
    console.log("  wrangler secret put GOOGLE_CLIENT_ID");
    console.log("  wrangler secret put GOOGLE_CLIENT_SECRET\n");
  } else {
    console.error("\n❌ Lỗi lấy token:", JSON.stringify(tokens, null, 2));
  }

  server.close();
  process.exit(0);
});

server.listen(3333, () => {
  console.log("Server đang chờ callback tại: http://localhost:3333/oauth/callback");
});
