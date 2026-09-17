"""
Test suite kiểm tra cấu trúc và khởi tạo của toàn bộ 5 Connectors trong thư mục Conection:
1. Groq AI
2. Telegram Bot
3. Google Drive API
4. Cloudflare
5. Google Apps Script
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from Conection.groq.groq_client import GroqClient
from Conection.telegram.telegram_client import TelegramClient
from Conection.google_drive.drive_client import GoogleDriveClient
from Conection.cloudflare.cloudflare_client import CloudflareClient
from Conection.apps_script.gas_client import GoogleAppsScriptClient

def run_tests():
    print("==================================================")
    print("🧪 KIỂM TRA BỘ 5 KẾT NỐI TRONG THƯ MỤC [Conection]")
    print("==================================================")
    
    # 1. Test Groq
    groq = GroqClient(api_key="test_dummy_key")
    assert groq.default_model == "llama-3.3-70b-versatile"
    print("✅ 1. GroqClient: Khởi tạo thành công (Llama 3.3).")

    # 2. Test Telegram
    tg = TelegramClient(bot_token="test_dummy_token", default_chat_id="123456789")
    assert tg.base_url == "https://api.telegram.org/bottest_dummy_token"
    print("✅ 2. TelegramClient: Khởi tạo thành công (Bot API).")

    # 3. Test Drive
    drive = GoogleDriveClient()
    print("✅ 3. GoogleDriveClient: Khởi tạo thành công (Drive API v3).")

    # 4. Test Cloudflare
    cf = CloudflareClient(account_id="dummy_acc", api_token="dummy_token")
    assert cf.api_token == "dummy_token"
    print("✅ 4. CloudflareClient: Khởi tạo thành công (Workers & API).")

    # 5. Test Google Apps Script
    gas = GoogleAppsScriptClient(webapp_url="https://script.google.com/macros/s/dummy/exec")
    assert gas.webapp_url is not None
    print("✅ 5. GoogleAppsScriptClient: Khởi tạo thành công (Web App HTTP).")

    print("--------------------------------------------------")
    print("🎉 TOÀN BỘ 5 KẾT NỐI TRONG [Conection] ĐÃ SẴN SÀNG!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
