# UpFile - Hệ Thống Tải Lên Tệp Vào Google Drive

Hệ thống cho phép tải lên tệp tin từ **Telegram Bot** hoặc **Link Script (Web App / REST API)** trực tiếp vào thư mục Google Drive:

- 📁 **Thư mục Google Drive mục tiêu**: [Xem Thư Mục Trên Google Drive](https://drive.google.com/drive/folders/1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I)
- 🆔 **ID Thư mục**: `1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I`

---

## 🏗️ Cấu Trúc Dự Án

```text
UpFile/
├── .env.example                         # Mẫu cấu hình môi trường (Bot token, Folder ID)
├── README.md                            # Hướng dẫn chi tiết sử dụng & triển khai
├── requirements.txt                     # Dependencies cho Python
├── apps_script/                         # PHƯƠNG ÁN 1: Link Script & Serverless 24/7
│   ├── Code.js                          # Xử lý Web Upload, Telegram Webhook & Drive API
│   ├── upload_ui.html                   # Giao diện Web Upload kéo & thả hiện đại
│   └── appsscript.json                  # Cấu hình quyền truy cập Drive và Web App
└── python/                              # PHƯƠNG ÁN 2: Python Engine (Local / Server / CLI)
    ├── config.py                        # Cấu hình ID thư mục Drive và API Keys
    ├── drive_uploader.py                # Class xử lý upload trực tiếp lên Drive API v3
    ├── telegram_bot.py                  # Bot Telegram lắng nghe và tự lưu file vào Drive
    └── upload_cli.py                    # Script CLI upload nhanh tệp từ máy tính
```

---

## ⚡ PHƯƠNG ÁN 1: Dùng "Link Script" Google Apps Script (Khuyến nghị 🌟)

> **Ưu điểm vượt trội:** Hoạt động **100% miễn phí 24/7 trên máy chủ Google**, không cần mở máy tính cá nhân hay thuê VPS, kết nối trực tiếp DriveApp với tốc độ cao nhất.

### Bước 1: Tạo dự án Google Apps Script
1. Truy cập [script.google.com](https://script.google.com) và bấm **Dự án mới** (New Project).
2. Đổi tên dự án thành `LDMega UpFile`.
3. Tạo 2 tệp trong trình soạn thảo:
   - Tệp mã `Code.gs`: Dán toàn bộ nội dung từ [Code.js](file:///Users/sontran/Desktop/LDMega/UpFile/apps_script/Code.js).
   - Tệp HTML `upload_ui.html`: Dán toàn bộ nội dung từ [upload_ui.html](file:///Users/sontran/Desktop/LDMega/UpFile/apps_script/upload_ui.html).

### Bước 2: Cài đặt Thông tin (Script Properties)
1. Trong Apps Script, vào biểu tượng **Cài đặt dự án** (Project Settings ⚙️) ở thanh bên trái.
2. Cuộn xuống mục **Thuộc tính tập lệnh** (Script Properties), thêm:
   - `TELEGRAM_BOT_TOKEN`: Token bot của bạn từ `@BotFather` (ví dụ: `123456789:ABC...`).
   - `DRIVE_FOLDER_ID`: `1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I`.

### Bước 3: Triển khai lấy "Link Script" (Deploy Web App)
1. Bấm nút xanh **Triển khai** (Deploy) > **Tùy chọn triển khai mới** (New deployment).
2. Chọn loại: **Ứng dụng web** (Web app).
   - Mô tả: `LDMega UpFile v1`
   - Thực thi dưới dạng (Execute as): **Tôi** (Me - tài khoản Google của bạn)
   - Ai có quyền truy cập (Who has access): **Bất kỳ ai** (Anyone)
3. Bấm **Triển khai** (Deploy) và cấp quyền truy cập Google Drive lần đầu.
4. Sao chép **URL của ứng dụng web** (đây chính là **Link Script** của bạn):
   - Định dạng: `https://script.google.com/macros/s/AKfycb.../exec`

### Bước 4: Kích hoạt tải lên từ Telegram Bot (Webhook)
Bạn chỉ cần mở trình duyệt và dán đường dẫn sau (thay bằng Token và Link Script của bạn):
```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<LINK_SCRIPT_WEBAPP_URL>
```
*Sau khi cài đặt xong, bất kỳ file, ảnh, video hay tài liệu nào gửi đến bot Telegram sẽ tự động được lưu vào thư mục Drive `1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I` và bot sẽ trả lại link Drive xem ngay!*

### Bước 5: Sử dụng "Link Script" để Upload trên Trình duyệt
- Chỉ cần mở đường dẫn **Link Script** trên bất kỳ trình duyệt nào (máy tính hoặc điện thoại).
- Kéo thả bất kỳ tệp tin nào để tải lên Google Drive với giao diện trực quan!

---

## 🐍 PHƯƠNG ÁN 2: Dùng Python Engine (Local / VPS / Dòng lệnh)

### Bước 1: Cài đặt thư viện
```bash
pip install -r UpFile/requirements.txt
```

### Bước 2: Cấu hình biến môi trường
Tạo tệp `UpFile/.env` từ mẫu:
```bash
cp UpFile/.env.example UpFile/.env
```
Điền `TELEGRAM_BOT_TOKEN` và (tùy chọn) `GAS_WEBAPP_URL`.

### Bước 3: Chạy Telegram Bot trên máy tính
```bash
python UpFile/python/telegram_bot.py
```
Bot sẽ chạy chế độ Long Polling, tự động phát hiện tệp gửi đến qua chat Telegram và tải vào Google Drive.

### Bước 4: Tải tệp lên bằng dòng lệnh (CLI)
```bash
# 1. Tải lên trực tiếp qua Drive API
python UpFile/python/upload_cli.py --file /duong/dan/tep_tin.pdf

# 2. Tải lên thông qua Link Script (Web App)
python UpFile/python/upload_cli.py --file /duong/dan/tep_tin.pdf --mode script --script-url https://script.google.com/macros/s/.../exec
```

---

## 🔒 Quản Lý Quyền Thư Mục Google Drive

Để đảm bảo tệp tải lên được lưu thành công vào thư mục:
- URL: `https://drive.google.com/drive/folders/1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I`
- Hãy đảm bảo tài khoản Google thực hiện Deploy Apps Script (hoặc email Service Account) có quyền **Người chỉnh sửa (Editor)** trong thư mục Drive trên.
