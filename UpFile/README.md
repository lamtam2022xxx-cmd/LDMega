# LDMega Central Drive Upload System

Hệ thống upload file nội bộ cho LDMega theo đúng spec `LDMega_Upload_System_Spec.md`.

## 📁 Cấu trúc Project

```
UpFile/
├── .env.example               # Mẫu biến môi trường (không commit .env)
├── README.md
│
├── worker/                    # Cloudflare Worker — Backend (Control Plane)
│   ├── wrangler.toml          # Cấu hình Worker, folder IDs, Sheets ID
│   └── src/
│       ├── index.js           # Entry point — 4 API routes
│       ├── auth.js            # Xác thực nhân viên (Google ID Token) + lấy Owner token
│       ├── permissions.js     # Đọc tab UPload từ Google Sheets, cache 5 phút
│       ├── drive.js           # Drive API: validate folder ancestor, list subfolders, tạo resumable session
│       ├── logger.js          # Ghi Upload_Log vào Google Sheets
│       └── config.js          # Whitelist 8 phòng ban + folder IDs
│
├── frontend/                  # PWA Frontend (Data Plane — upload trực tiếp lên Drive)
│   ├── index.html             # Shell HTML + PWA meta tags
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── manifest.json      # PWA manifest (Add to Home Screen)
│   │   └── sw.js              # Service Worker
│   └── src/
│       ├── app.js             # Main app controller + toàn bộ UI logic
│       ├── auth.js            # Google Sign-In (GIS), lấy ID Token
│       ├── api.js             # API client gọi Cloudflare Worker
│       └── uploader.js        # Resumable Upload engine: chunking, retry, progress, resume
│
└── scripts/
    └── oauth_setup.js         # Script lấy Refresh Token của Owner A (chạy 1 lần)
```

---

## 🏗️ Kiến Trúc (Theo Spec)

```
EMPLOYEE (Google Login)
        ↓ ID Token
CLOUDFLARE WORKER (Control Plane)
        ↓ Refresh Token của Owner A
GOOGLE DRIVE API
        ↓ Resumable Session URL
BROWSER (Data Plane)
        ↓ PUT chunks trực tiếp
GOOGLE DRIVE của Owner A
        ↓
📁 LDMega/[Department]/[Subfolder]/file
```

**Nguyên tắc cốt lõi:**
- File tạo bằng quyền của Account A → thuộc sở hữu của A
- Credential của A KHÔNG bao giờ xuống browser
- Permission enforce server-side qua Google Sheets tab `UPload`

---

## 🚀 Hướng Dẫn Triển Khai

### Phase 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
2. Tạo Project mới (VD: `ldmega-upload`)
3. Bật các API:
   - **Google Drive API**
   - **Google Sheets API**
   - **Google Identity Services (không cần bật riêng, built-in)**
4. Tạo **OAuth 2.0 Client ID** (Web Application):
   - Authorized redirect URIs: `http://localhost:3333/oauth/callback` (để lấy token)
   - Authorized JavaScript origins: URL frontend (sau khi deploy)

### Phase 2: Lấy Refresh Token của Account A (Owner)

```bash
# Cài Node.js nếu chưa có, sau đó:
cd UpFile/scripts
node oauth_setup.js
```

Script sẽ mở trình duyệt để bạn đăng nhập bằng **Account A** (chủ sở hữu Drive).
Sau khi xác nhận, terminal sẽ hiển thị `OWNER_REFRESH_TOKEN`.

### Phase 3: Deploy Cloudflare Worker

```bash
cd UpFile/worker

# Cài Wrangler nếu chưa có:
npm install -g wrangler
wrangler login

# Điền secrets (KHÔNG để vào wrangler.toml):
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put OWNER_REFRESH_TOKEN
wrangler secret put JWT_SECRET

# Deploy Worker:
wrangler deploy
# → Nhận URL: https://ldmega-upload-worker.<your>.workers.dev
```

### Phase 4: Deploy Frontend

```bash
cd UpFile/frontend

# Tạo file .env:
cp ../.env.example .env.local
# Điền VITE_GOOGLE_CLIENT_ID và VITE_WORKER_URL

npm install
npm run dev      # Phát triển local
npm run build    # Build production
```

Deploy `frontend/dist/` lên Cloudflare Pages, Vercel hoặc bất kỳ static hosting nào.

---

## ⚙️ Cấu Hình Phân Quyền (Google Sheets)

Mở tab `UPload` trong Spreadsheet `LDMega_flow`:

| (A) | 1 DR | 2 HR | 3 ACC | 4 Asset | ... |
|-----|------|------|-------|---------|-----|
| **Link Folder** | [URL Drive DR] | [URL Drive HR] | ... | | |
| **Email** | a@company.com | b@company.com | c@company.com | | |
| | d@company.com | a@company.com | | | |

- Mỗi cột = 1 phòng ban
- Row 1 = tên phòng ban (phải khớp chính xác: `1 DR`, `2 HR`, `3 ACC`, `4 Asset`, `5 Sale`, `6 MKT`, `7 Task`, `8 BOD`)
- Row 2 = Link thư mục Drive tương ứng
- Row 3+ = Email nhân viên được phép upload

**Thêm/xóa nhân viên**: Chỉ chỉnh Google Sheet, không cần sửa code.

---

## 🔒 API Endpoints (Cloudflare Worker)

| Method | Path | Mô tả |
|--------|------|-------|
| `GET` | `/health` | Health check (không cần auth) |
| `GET` | `/api/me` | Thông tin nhân viên + danh sách phòng ban được phép |
| `GET` | `/api/folders?parentId=&department=` | Subfolder bên trong phòng ban |
| `POST` | `/api/upload/start` | Tạo Drive resumable session → trả `uploadUrl` |
| `POST` | `/api/upload/complete` | Verify file sau khi upload, ghi `Upload_Log` |

---

## 📊 Upload Log (Google Sheets)

Tab `Upload_Log` tự động tạo header và ghi mỗi lần upload:

| Timestamp | Email | Department | Folder | Subfolder | File Name | File Size | MIME Type | Drive File ID | Drive URL | Status | Upload ID |
|-----------|-------|------------|--------|-----------|-----------|-----------|-----------|---------------|-----------|--------|-----------|

Status values: `STARTED`, `UPLOADING`, `COMPLETED`, `FAILED`, `CANCELLED`

---

## 📱 Hỗ Trợ PWA

- **Add to Home Screen**: Mở trên Chrome (Android) hoặc Safari (iOS) → Chia sẻ → Thêm vào màn hình chính
- **Offline shell**: App vẫn mở được khi mất mạng (nhưng cần mạng để upload)
- **Mobile upload**: Hỗ trợ chọn file từ Files app trên iOS/Android
