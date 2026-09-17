# Cloudflare Worker Backend (cloudflare/backend)

Thư mục này chứa API Serverless chạy trên mạng biên (Edge) toàn cầu của Cloudflare.

---

## 🚀 Tính năng
* **Groq AI Proxy**: Gọi Llama 3.3 70B với độ trễ cực thấp, bảo mật API Key trên Cloudflare Secrets.
* **Telegram Webhook**: Nhận tin nhắn từ Bot Telegram và tự động dùng Groq AI trả lời trực tiếp.
* **CORS Middleware**: Sẵn sàng cho phép Frontend (Cloudflare Pages) hoặc ứng dụng khác gọi API.

---

## 🛠️ Hướng dẫn Deploy

### 1. Đăng nhập Cloudflare Wrangler
```bash
npx wrangler login
```

### 2. Thiết lập Secrets (Chỉ cần làm 1 lần)
```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

### 3. Deploy lên Cloudflare
```bash
./deploy.sh cf-be
```
Hoặc:
```bash
npm run deploy:cf:be
```
