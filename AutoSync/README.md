# Module AutoSync - Tự động đồng bộ LDMega lên GitHub

Thư mục này quản lý toàn bộ tính năng tự động đồng bộ code của tất cả các thư mục con trong `LDMega` (bao gồm `FolderSyncGGdriver`, `HR`, `AutoSync` và các thư mục phát triển sau này) lên GitHub.

---

## 📁 Cấu trúc thư mục

* `sync.sh`: Script cốt lõi thực hiện kiểm tra thay đổi, tự động tạo commit chi tiết và push lên branch `main` của GitHub.
* `auto_sync_daemon.sh`: Vòng lặp chạy nền định kỳ kiểm tra (mặc định mỗi 30 giây).
* `start.sh`: Bật chế độ tự động đồng bộ chạy ngầm.
* `stop.sh`: Tắt chế độ tự động đồng bộ chạy ngầm.
* `status.sh`: Xem trạng thái tiến trình, các thay đổi đang chờ và lịch sử đồng bộ gần nhất.
* `sync.log`: File ghi nhận nhật ký các lần đồng bộ (tự động xoay vòng để không làm nặng máy).
* `com.ldmega.autosync.plist`: File cấu hình chạy ngầm tự khởi động cùng macOS (LaunchAgent).

---

## 🚀 Hướng dẫn sử dụng nhanh

### 1. Bật tự động đồng bộ chạy nền
```bash
bash AutoSync/start.sh
```
Hệ thống sẽ chạy ngầm. Cứ mỗi 30 giây, nếu có bất kỳ file nào thay đổi trong `FolderSyncGGdriver`, `HR`,... hệ thống sẽ tự động commit và push lên GitHub ngay lập tức.

### 2. Kiểm tra trạng thái & xem log
```bash
bash AutoSync/status.sh
```

### 3. Dừng tự động đồng bộ
```bash
bash AutoSync/stop.sh
```

### 4. Đồng bộ ngay lập tức 1 lần thủ công
```bash
bash AutoSync/sync.sh
```

---

## 🔄 Tùy chỉnh (dành cho bảo trì riêng)
Khi muốn sửa logic đồng bộ, bạn chỉ cần sửa file [sync.sh](file:///Users/sontran/Desktop/LDMega/AutoSync/sync.sh) trong thư mục này mà không làm ảnh hưởng đến code của `FolderSyncGGdriver` hay `HR`.
