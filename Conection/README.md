# Thư mục Conection - Trung tâm kết nối dịch vụ ngoài của LDMega

Thư mục này tập trung toàn bộ code kết nối sẵn sàng (Plug-and-Play) với 5 dịch vụ theo yêu cầu:
1. **Groq**: Gọi AI siêu tốc (Llama 3.3 70B, Mixtral)
2. **Google Drive & Drive API**: Tìm kiếm, tải lên, tạo thư mục và chia sẻ tài liệu
3. **Telegram**: Gửi tin nhắn, thông báo, nhận lệnh Webhook
4. **Cloudflare**: Gọi API Cloudflare, kích hoạt Worker từ xa
5. **Google Apps Script**: Gọi Web App GAS (doGet / doPost) từ xa

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
├── cloudflare/               # Kết nối Cloudflare
│   └── cloudflare_client.py  # Gọi API & Worker Cloudflare
├── apps_script/              # Kết nối Google Apps Script
│   └── gas_client.py         # Gọi Web App GAS từ xa
└── test_connections.py       # Suite kiểm thử toàn bộ 5 kết nối
```

---

## 🚀 Cách sử dụng trong code khác (Ví dụ trong thư mục HR)

### 1. Dùng Groq AI:
```python
from Conection.groq.groq_client import GroqClient

groq = GroqClient()
answer = groq.quick_ask("Tóm tắt bản mô tả công việc này...")
print(answer)
```

### 2. Dùng Telegram Bot:
```python
from Conection.telegram.telegram_client import TelegramClient

tg = TelegramClient()
tg.send_message("📢 Thông báo: Đã thêm nhân viên mới vào hệ thống HR!")
```

### 3. Dùng Google Drive:
```python
from Conection.google_drive.drive_client import GoogleDriveClient

drive = GoogleDriveClient()
files = drive.list_files()
```

### 4. Kiểm tra tất cả kết nối:
```bash
python3 Conection/test_connections.py
```
