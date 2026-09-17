# Module AutoSync - Tự động đồng bộ LDMega lên GitHub

Thư mục này quản lý toàn bộ tính năng tự động đồng bộ code của tất cả các thư mục con trong `LDMega` (bao gồm `FolderSyncGGdriver`, `HR`, `AutoSync` và các thư mục phát triển sau này) lên GitHub.

---

## ✨ Tính năng nổi bật

* **Hỏi ý kiến trước khi tải**: Mỗi khi có thay đổi code mới, một hộp thoại macOS sẽ xuất hiện hỏi bạn:
  * **[Đồng ý đẩy]**: Lập tức commit và push lên GitHub, đồng thời hiện thông báo đẩy thành công.
  * **[Để sau]**: Tạm hoãn 3 phút (hoặc cho đến khi bạn sửa thêm code mới) rồi mới nhắc lại, không làm phiền bạn liên tục.
* **Đồng bộ đa thư mục**: Tự động theo dõi mọi thư mục con trong `LDMega`.
* **Nhật ký chi tiết**: Mọi thao tác đều được ghi lại trong `sync.log`.

---

## 📁 Cấu trúc thư mục

* `sync.sh`: Script cốt lõi kiểm tra thay đổi, bật hộp thoại xác nhận và push code.
* `auto_sync_daemon.sh`: Vòng lặp chạy nền định kỳ kiểm tra (mặc định mỗi 30 giây).
* `start.sh`: Bật chế độ tự động chạy ngầm.
* `stop.sh`: Tắt chế độ tự động chạy ngầm.
* `status.sh`: Xem trạng thái tiến trình, các thay đổi đang chờ và lịch sử đồng bộ gần nhất.
* `sync.log`: File ghi nhận nhật ký các lần đồng bộ.
* `com.ldmega.autosync.plist`: File cấu hình chạy ngầm tự khởi động cùng macOS (LaunchAgent).

---

## 🚀 Các lệnh thường dùng

```bash
# Xem trạng thái và nhật ký:
bash AutoSync/status.sh

# Dừng chế độ tự động:
bash AutoSync/stop.sh

# Bật lại chế độ tự động:
bash AutoSync/start.sh

# Đẩy code ngay lập tức không cần popup:
bash AutoSync/sync.sh --no-prompt
```
