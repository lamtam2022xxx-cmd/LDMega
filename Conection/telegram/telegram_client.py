"""
Telegram Bot Connector (Python)
Hỗ trợ gửi tin nhắn, gửi tài liệu, thông báo sự kiện qua Telegram Bot API (không cần cài thêm thư viện).
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

class TelegramClient:
    def __init__(self, bot_token: Optional[str] = None, default_chat_id: Optional[str] = None):
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN")
        self.default_chat_id = default_chat_id or os.getenv("TELEGRAM_CHAT_ID")
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None

    def send_message(self, text: str, chat_id: Optional[str] = None, parse_mode: str = "HTML") -> Dict[str, Any]:
        """Gửi tin nhắn văn bản đến nhóm hoặc cá nhân."""
        target_chat = chat_id or self.default_chat_id
        if not self.base_url or not target_chat:
            return {"success": False, "error": "Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID"}

        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": target_chat,
            "text": text,
            "parse_mode": parse_mode
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_me(self) -> Dict[str, Any]:
        """Kiểm tra kết nối và thông tin của Bot."""
        if not self.base_url:
            return {"success": False, "error": "Chưa cấu hình TELEGRAM_BOT_TOKEN"}

        try:
            with urllib.request.urlopen(f"{self.base_url}/getMe", timeout=10) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            return {"success": False, "error": str(e)}

    def set_webhook(self, webhook_url: str) -> Dict[str, Any]:
        """Cấu hình Webhook trỏ về Cloudflare Worker hoặc server xử lý."""
        if not self.base_url:
            return {"success": False, "error": "Chưa cấu hình TELEGRAM_BOT_TOKEN"}

        url = f"{self.base_url}/setWebhook"
        payload = {"url": webhook_url}
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    client = TelegramClient()
    print("Telegram Client đã sẵn sàng. Cần có TELEGRAM_BOT_TOKEN để gửi tin.")
