"""
Xác thực Google Drive API - hỗ trợ OAuth 2.0 và Service Account
"""
import os
import json
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

import config


def authenticate():
    """
    Xác thực và trả về Google Drive service object.
    Tự động chọn OAuth hoặc Service Account dựa trên config.
    """
    creds = None

    if config.AUTH_TYPE == "service_account":
        creds = _auth_service_account()
    else:
        creds = _auth_oauth()

    service = build("drive", "v3", credentials=creds)
    print("✅ Kết nối Google Drive thành công!")
    return service


def _auth_service_account():
    """Xác thực bằng Service Account."""
    creds_path = config.CREDENTIALS_PATH
    if not os.path.exists(creds_path):
        print(f"❌ Không tìm thấy file Service Account: {creds_path}")
        print("   Hãy tải file JSON key từ Google Cloud Console")
        print("   và đặt vào thư mục credentials/")
        raise FileNotFoundError(f"Service Account key not found: {creds_path}")

    creds = service_account.Credentials.from_service_account_file(
        creds_path, scopes=config.SCOPES
    )
    print(f"🔑 Xác thực bằng Service Account: {creds.service_account_email}")
    return creds


def _auth_oauth():
    """Xác thực bằng OAuth 2.0 (mở browser để đăng nhập)."""
    creds = None
    token_path = config.TOKEN_PATH

    # Kiểm tra token đã lưu
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, config.SCOPES)

    # Nếu token hết hạn hoặc chưa có
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Đang refresh token...")
            creds.refresh(Request())
        else:
            creds_path = config.CREDENTIALS_PATH
            if not os.path.exists(creds_path):
                print(f"❌ Không tìm thấy file OAuth credentials: {creds_path}")
                print("   Hãy tải file OAuth Client ID từ Google Cloud Console")
                print("   và đặt vào thư mục credentials/")
                raise FileNotFoundError(f"OAuth credentials not found: {creds_path}")

            print("🌐 Mở browser để đăng nhập Google...")
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, config.SCOPES)
            creds = flow.run_local_server(port=0)

        # Lưu token để lần sau không cần đăng nhập lại
        os.makedirs(os.path.dirname(token_path), exist_ok=True)
        with open(token_path, "w") as token_file:
            token_file.write(creds.to_json())
        print(f"💾 Token đã lưu tại: {token_path}")

    return creds
