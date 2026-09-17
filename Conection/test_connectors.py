"""
Test suite kiểm tra cấu trúc và khởi tạo của các Connectors (Groq, Telegram, Drive)
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from connectors.groq.groq_client import GroqClient
from connectors.telegram.telegram_client import TelegramClient
from connectors.google_drive.drive_client import GoogleDriveClient

def run_tests():
    print("==================================================")
    print("🧪 KIỂM TRA KHỞI TẠO BỘ CONNECTORS")
    print("==================================================")
    
    # 1. Test Groq
    groq = GroqClient(api_key="test_dummy_key")
    assert groq.default_model == "llama-3.3-70b-versatile"
    print("✅ GroqClient: Khởi tạo thành công, cấu hình model mặc định chuẩn.")

    # 2. Test Telegram
    tg = TelegramClient(bot_token="test_dummy_token", default_chat_id="123456789")
    assert tg.base_url == "https://api.telegram.org/bottest_dummy_token"
    print("✅ TelegramClient: Khởi tạo thành công, URL API chuẩn.")

    # 3. Test Drive
    drive = GoogleDriveClient()
    print("✅ GoogleDriveClient: Khởi tạo class thành công.")

    print("--------------------------------------------------")
    print("🎉 TẤT CẢ CÁC BỘ CONNECTORS ĐÃ SẴN SÀNG!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
