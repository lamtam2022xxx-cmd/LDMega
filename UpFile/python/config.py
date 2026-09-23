"""
Cấu hình tập trung cho UpFile (Python Engine)
Tự động nạp cấu hình từ .env của UpFile hoặc các module liên quan trong LDMega
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Xác định đường dẫn thư mục
CURRENT_DIR = Path(__file__).resolve().parent
UPFILE_DIR = CURRENT_DIR.parent
PROJECT_ROOT = UPFILE_DIR.parent

# Ưu tiên nạp từ UpFile/.env, nếu không có thì nạp từ FolderSyncGGdriver/.env hoặc Conection/.env
env_paths = [
    UPFILE_DIR / ".env",
    PROJECT_ROOT / "FolderSyncGGdriver" / ".env",
    PROJECT_ROOT / "Conection" / ".env"
]

for p in env_paths:
    if p.exists():
        load_dotenv(p)

# 1. ID Thư mục Google Drive mục tiêu (theo yêu cầu mặc định: https://drive.google.com/drive/folders/1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I)
DEFAULT_DRIVE_FOLDER_ID = "1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I"

# Đọc từ file .env của UpFile nếu có
upfile_env = UPFILE_DIR / ".env"
upfile_folder_id = None
if upfile_env.exists():
    from dotenv import dotenv_values
    values = dotenv_values(upfile_env)
    upfile_folder_id = values.get("DRIVE_FOLDER_ID")

DRIVE_FOLDER_ID = os.getenv("UPFILE_DRIVE_FOLDER_ID") or upfile_folder_id or DEFAULT_DRIVE_FOLDER_ID

# 2. Cấu hình Telegram Bot
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# 3. Cấu hình Link Script (Google Apps Script Web App URL)
GAS_WEBAPP_URL = os.getenv("GAS_WEBAPP_URL", "")

# 4. Xác thực Google Drive API (OAuth / Service Account)
AUTH_TYPE = os.getenv("AUTH_TYPE", "oauth")

# Đường dẫn credentials
def resolve_path(env_var: str, default_relative: str) -> Path:
    val = os.getenv(env_var)
    if val:
        path = Path(val)
        return path if path.is_absolute() else (PROJECT_ROOT / path).resolve()
    return (PROJECT_ROOT / default_relative).resolve()

CREDENTIALS_PATH = resolve_path("CREDENTIALS_PATH", "FolderSyncGGdriver/credentials/credentials.json")
TOKEN_PATH = resolve_path("TOKEN_PATH", "FolderSyncGGdriver/credentials/token.json")

# Phạm vi quyền Google Drive API
SCOPES = ["https://www.googleapis.com/auth/drive"]

# Thư mục tạm để lưu tệp tải về từ Telegram trước khi đẩy lên Drive
TEMP_DOWNLOAD_DIR = UPFILE_DIR / "temp_downloads"
TEMP_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
