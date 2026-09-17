# Thư mục Conection - Trung tâm kết nối & Triển khai (Deploy Hub)

Thư mục này tập hợp toàn bộ code kết nối dịch vụ ngoài và toàn bộ code nguồn triển khai (deploy) lên **Google Apps Script** và **Cloudflare**:

1. **Groq**: Gọi AI siêu tốc (Llama 3.3 70B, Mixtral)
2. **Google Drive & Drive API**: Tìm kiếm, tải lên, tạo thư mục và chia sẻ tài liệu
3. **Telegram**: Gửi tin nhắn, thông báo, nhận lệnh Webhook
4. **Cloudflare**: Toàn bộ Backend Worker (API, Webhook) và Frontend Pages (Web App Dashboard)
5. **Google Apps Script**: Toàn bộ code Apps Script V8 (Web App API, Drive, Sheets, CLASP)

---

## 📁 Cấu trúc thư mục

```text
Conection/
├── groq/                     # Kết nối Groq AI
│   ├── groq_client.py        # Dùng cho Python (HR, script, data)
│   └── groq_client.js        # Dùng cho Cloudflare Worker & GAS
├── telegram/                 # Kết nối Telegram Bot
│   ├── telegram_client.py    # Gửi tin & bot Python
│   └── telegram_client.js    # Gửi tin & webhook Cloudflare/GAS
├── google_drive/             # Kết nối Google Drive API
│   ├── drive_client.py       # Tích hợp Drive v3 Python
│   └── drive_helper.js       # Tương tác Drive trong GAS & Worker
├── cloudflare/               # [DEPLOY TARGET] Cloudflare Hub
│   ├── backend/              # Cloudflare Worker (Edge API, Groq Proxy, Webhook)
│   │   ├── wrangler.toml
│   │   └── src/index.js
│   ├── frontend/             # Cloudflare Pages (Web Dashboard giao diện đẹp)
│   │   └── public/
│   └── cloudflare_client.py  # Client Python gọi API & Worker
├── apps_script/              # [DEPLOY TARGET] Google Apps Script Hub
│   ├── appsscript.json       # Manifest GAS
│   ├── Code.js               # Code GAS (Web App doGet/doPost, Drive, Groq, Telegram)
│   ├── .clasp.json.example   # Mẫu kết nối CLASP
│   └── gas_client.py         # Client Python gọi Web App GAS từ xa
├── test_connections.py       # Suite kiểm thử toàn bộ các kết nối
└── README.md
```

---

## 🚀 Cách Deploy nhanh

Từ thư mục gốc `LDMega`:
```bash
# Đẩy lên Google Apps Script:
./deploy.sh gas

# Đẩy Backend Worker lên Cloudflare:
./deploy.sh cf-be

# Đẩy Frontend Pages lên Cloudflare:
./deploy.sh cf-fe

# Kiểm tra tất cả các kết nối:
./deploy.sh test
```
