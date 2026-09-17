"""
Cấu hình cho LDMega Google Drive Manager
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Loại xác thực: "service_account" hoặc "oauth"
AUTH_TYPE = os.getenv("AUTH_TYPE", "oauth")

# Đường dẫn credentials
CREDENTIALS_PATH = os.getenv("CREDENTIALS_PATH", "credentials/credentials.json")

# ID thư mục gốc trên Google Drive
DRIVE_FOLDER_ID = os.getenv("DRIVE_FOLDER_ID", "1L99nIdUz1V-Ios22gWg45HtwQvOmNN2U")

# Đường dẫn thư mục local
LOCAL_DATA_PATH = os.getenv("LOCAL_DATA_PATH", "./data")

# Google Drive API scopes
SCOPES = ["https://www.googleapis.com/auth/drive"]

# Token path (cho OAuth)
TOKEN_PATH = "credentials/token.json"
