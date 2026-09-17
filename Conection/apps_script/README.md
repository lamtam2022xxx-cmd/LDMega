# Google Apps Script Workspace (apps_script)

Thư mục này chứa code và cấu hình để triển khai (deploy) trực tiếp lên **Google Apps Script**.

---

## 🚀 Cách Deploy lên Google Apps Script

### Bước 1: Đăng nhập CLASP (Chỉ cần làm 1 lần)
Chạy lệnh đăng nhập bằng tài khoản Google của bạn:
```bash
npx @google/clasp login
```
*(Trình duyệt sẽ mở để bạn chọn tài khoản Google và cấp quyền).*

### Bước 2: Liên kết với dự án Google Apps Script của bạn
1. Vào [script.google.com](https://script.google.com) và tạo một dự án mới (hoặc mở dự án có sẵn).
2. Vào **Project Settings** (biểu tượng bánh răng) -> Copy dòng **Script ID**.
3. Tạo file `apps_script/.clasp.json` (dựa trên mẫu `.clasp.json.example`) và dán `scriptId` vào:
```json
{
  "scriptId": "ID_DỰ_ÁN_CỦA_BẠN",
  "rootDir": "."
}
```

### Bước 3: Đẩy code lên Google Apps Script
Chạy lệnh từ thư mục gốc LDMega:
```bash
./deploy.sh gas
```
Hoặc:
```bash
npm run deploy:gas
```

Toàn bộ code trong `Code.js` và `appsscript.json` sẽ được đồng bộ ngay lập tức lên Google Apps Script!
