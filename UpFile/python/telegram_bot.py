"""
Telegram Bot Uploader (Python Engine)
Lắng nghe tệp tin từ Telegram và tự động lưu vào Google Drive (Thư mục 1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I)
Chạy chế độ Long Polling (không cần mở cổng mạng hoặc cấu hình domain/SSL)
"""

import os
import sys
import time
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any

# Thêm thư mục hiện tại vào sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    TELEGRAM_BOT_TOKEN,
    DRIVE_FOLDER_ID,
    GAS_WEBAPP_URL,
    TEMP_DOWNLOAD_DIR
)
from drive_uploader import GoogleDriveUploader

try:
    import requests
except ImportError:
    print("❌ Thiếu thư viện 'requests'. Vui lòng chạy: pip install requests")
    sys.exit(1)

# Cấu hình logging
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("TelegramBotUploader")


class TelegramDriveBot:
    def __init__(self, token: Optional[str] = None):
        self.token = token or TELEGRAM_BOT_TOKEN
        if not self.token:
            logger.error("❌ Chưa cấu hình TELEGRAM_BOT_TOKEN trong UpFile/.env")
            print("💡 Hãy mở file UpFile/.env và điền TELEGRAM_BOT_TOKEN của bạn từ @BotFather.")
            sys.exit(1)

        self.api_base = f"https://api.telegram.org/bot{self.token}"
        self.file_base = f"https://api.telegram.org/file/bot{self.token}"
        self.uploader = GoogleDriveUploader()
        self.last_update_id = 0

    def verify_bot(self) -> bool:
        """Kiểm tra token và thông tin Bot."""
        try:
            res = requests.get(f"{self.api_base}/getMe", timeout=10)
            data = res.json()
            if data.get("ok"):
                bot_user = data["result"]
                logger.info(f"🤖 Bot đã kết nối thành công: @{bot_user.get('username')} ({bot_user.get('first_name')})")
                return True
            else:
                logger.error(f"❌ Token bot không hợp lệ: {data.get('description')}")
                return False
        except Exception as e:
            logger.error(f"❌ Không thể kết nối tới máy chủ Telegram API: {e}")
            return False

    def send_message(self, chat_id: int, text: str, reply_to_id: Optional[int] = None):
        """Gửi tin nhắn phản hồi tới Telegram."""
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": False
        }
        if reply_to_id:
            payload["reply_to_message_id"] = reply_to_id

        try:
            requests.post(f"{self.api_base}/sendMessage", json=payload, timeout=10)
        except Exception as e:
            logger.error(f"Lỗi gửi tin nhắn Telegram: {e}")

    def download_telegram_file(self, file_id: str, dest_name: str) -> Optional[Path]:
        """Tải file từ máy chủ Telegram về thư mục tạm."""
        try:
            # 1. Lấy thông tin file path
            info_res = requests.get(f"{self.api_base}/getFile", params={"file_id": file_id}, timeout=15)
            info = info_res.json()
            if not info.get("ok"):
                logger.error(f"Lỗi getFile: {info.get('description')}")
                return None

            remote_path = info["result"]["file_path"]
            download_url = f"{self.file_base}/{remote_path}"

            # 2. Tải về file cục bộ
            local_path = TEMP_DOWNLOAD_DIR / dest_name
            with requests.get(download_url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(local_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

            return local_path
        except Exception as e:
            logger.error(f"Lỗi khi tải file từ Telegram: {e}")
            return None

    def upload_to_drive(self, local_path: Path, file_name: str) -> Dict[str, Any]:
        """Lưu tệp vào Google Drive (ưu tiên API trực tiếp, dự phòng qua Link Script)."""
        # Phương án 1: Trực tiếp qua Google Drive API
        if self.uploader.is_connected():
            return self.uploader.upload_file(str(local_path), custom_name=file_name)

        # Phương án 2: Dự phòng qua Link Script Web App nếu có cấu hình
        if GAS_WEBAPP_URL:
            import base64
            import mimetypes
            try:
                mime_type, _ = mimetypes.guess_type(str(local_path))
                with open(local_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("utf-8")
                res = requests.post(
                    GAS_WEBAPP_URL,
                    json={
                        "action": "upload_file",
                        "file_name": file_name,
                        "mime_type": mime_type or "application/octet-stream",
                        "base64_data": b64
                    },
                    timeout=60
                )
                return res.json()
            except Exception as e:
                return {"success": False, "error": f"Lỗi dự phòng qua Link Script: {e}"}

        return {
            "success": False,
            "error": "Chưa kết nối Google Drive API và chưa cấu hình Link Script dự phòng."
        }

    def process_message(self, message: Dict[str, Any]):
        """Xử lý nội dung tin nhắn gửi tới bot."""
        chat_id = message["chat"]["id"]
        message_id = message["message_id"]

        # Kiểm tra lệnh văn bản
        text = message.get("text", "")
        if text.startswith("/start") or text.startswith("/help"):
            welcome = (
                "👋 <b>Chào mừng bạn đến với LDMega UpFile Bot!</b>\n\n"
                f"📁 <b>Thư mục Google Drive lưu trữ:</b>\n"
                f'<a href="https://drive.google.com/drive/folders/{DRIVE_FOLDER_ID}">Mở Thư Mục Google Drive</a>\n\n'
                "🚀 <b>Cách tải lên:</b>\n"
                "Hãy gửi bất kỳ tệp nào vào đoạn chat này (Tài liệu, Ảnh, File nén, Video...).\n"
                "Bot sẽ tự động tải lên Google Drive và gửi lại link cho bạn!"
            )
            self.send_message(chat_id, welcome, reply_to_id=message_id)
            return

        # Xác định tệp đính kèm
        file_id = None
        file_name = f"upload_{int(time.time())}"

        if "document" in message:
            doc = message["document"]
            file_id = doc["file_id"]
            file_name = doc.get("file_name", file_name)
        elif "photo" in message and message["photo"]:
            best_photo = message["photo"][-1]
            file_id = best_photo["file_id"]
            file_name = f"photo_{int(time.time())}.jpg"
        elif "video" in message:
            video = message["video"]
            file_id = video["file_id"]
            file_name = video.get("file_name", f"video_{int(time.time())}.mp4")
        elif "audio" in message:
            audio = message["audio"]
            file_id = audio["file_id"]
            file_name = audio.get("file_name", f"audio_{int(time.time())}.mp3")
        elif "voice" in message:
            voice = message["voice"]
            file_id = voice["file_id"]
            file_name = f"voice_{int(time.time())}.ogg"

        if not file_id:
            if not text.startswith("/"):
                self.send_message(
                    chat_id,
                    "ℹ️ Hãy gửi 1 tệp đính kèm (ảnh, file, tài liệu...) để bot lưu vào Google Drive.",
                    reply_to_id=message_id
                )
            return

        # Báo đang tải
        self.send_message(chat_id, f"⏳ Đang tải tệp <b>{file_name}</b> lên Google Drive...", reply_to_id=message_id)

        # Tải file từ Telegram
        local_path = self.download_telegram_file(file_id, file_name)
        if not local_path or not local_path.exists():
            self.send_message(chat_id, "❌ Không thể tải tệp từ Telegram. Tệp có thể vượt quá giới hạn 20MB của Bot API.", reply_to_id=message_id)
            return

        try:
            # Tải lên Drive
            result = self.upload_to_drive(local_path, file_name)

            if result.get("success"):
                drive_info = result["file"]
                success_text = (
                    "✅ <b>Tải lên Google Drive thành công!</b>\n\n"
                    f"📄 <b>Tên tệp:</b> {drive_info.get('name')}\n"
                    f"🔗 <b>Xem tệp:</b> <a href=\"{drive_info.get('url')}\">Mở trên Google Drive</a>\n"
                    f"📁 <b>Thư mục:</b> <a href=\"https://drive.google.com/drive/folders/{DRIVE_FOLDER_ID}\">Xem toàn bộ thư mục</a>"
                )
                self.send_message(chat_id, success_text, reply_to_id=message_id)
                logger.info(f"✅ Đã tải lên Drive thành công: {file_name}")
            else:
                err_msg = result.get("error", "Lỗi không xác định")
                self.send_message(chat_id, f"❌ Lỗi khi lưu vào Google Drive: <code>{err_msg}</code>", reply_to_id=message_id)
                logger.error(f"❌ Lỗi tải lên Drive: {err_msg}")

        finally:
            # Dọn dẹp tệp tạm
            if local_path.exists():
                local_path.unlink()

    def start_polling(self):
        """Bắt đầu vòng lặp lắng nghe tin nhắn (Long Polling)."""
        logger.info("🚀 Telegram Drive Bot đang bắt đầu lắng nghe tin nhắn...")
        logger.info(f"📁 Thư mục Google Drive mục tiêu: https://drive.google.com/drive/folders/{DRIVE_FOLDER_ID}")

        while True:
            try:
                params = {
                    "offset": self.last_update_id + 1,
                    "timeout": 30
                }
                res = requests.get(f"{self.api_base}/getUpdates", params=params, timeout=40)
                if res.status_code == 200:
                    data = res.json()
                    for update in data.get("result", []):
                        self.last_update_id = update["update_id"]
                        if "message" in update:
                            self.process_message(update["message"])
                time.sleep(0.5)
            except KeyboardInterrupt:
                logger.info("🛑 Đang dừng bot...")
                break
            except Exception as e:
                logger.error(f"Lỗi trong vòng lặp polling: {e}")
                time.sleep(3)


def main():
    bot = TelegramDriveBot()
    if bot.verify_bot():
        bot.start_polling()


if __name__ == "__main__":
    main()
