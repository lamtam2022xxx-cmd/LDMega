"""
Module tải tệp trực tiếp lên Google Drive qua Google Drive API v3
Mục tiêu mặc định: https://drive.google.com/drive/folders/1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I
"""

import os
import mimetypes
import io
from pathlib import Path
from typing import Dict, Any, Optional

from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

from config import (
    AUTH_TYPE,
    CREDENTIALS_PATH,
    TOKEN_PATH,
    SCOPES,
    DRIVE_FOLDER_ID
)


class GoogleDriveUploader:
    def __init__(self, target_folder_id: Optional[str] = None):
        self.target_folder_id = target_folder_id or DRIVE_FOLDER_ID
        self.service = None
        self._init_service()

    def _init_service(self):
        """Khởi tạo kết nối Google Drive API v3."""
        try:
            creds = None
            if AUTH_TYPE == "service_account":
                if not Path(CREDENTIALS_PATH).exists():
                    raise FileNotFoundError(f"Không tìm thấy file Service Account: {CREDENTIALS_PATH}")
                creds = service_account.Credentials.from_service_account_file(
                    str(CREDENTIALS_PATH), scopes=SCOPES
                )
            else:
                # OAuth 2.0
                if Path(TOKEN_PATH).exists():
                    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

                if not creds or not creds.valid:
                    if creds and creds.expired and creds.refresh_token:
                        creds.refresh(Request())
                    elif Path(CREDENTIALS_PATH).exists():
                        flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
                        creds = flow.run_local_server(port=0)
                    else:
                        raise FileNotFoundError(
                            f"Chưa có tệp xác thực OAuth tại {CREDENTIALS_PATH} hoặc {TOKEN_PATH}"
                        )

                    # Lưu lại token
                    Path(TOKEN_PATH).parent.mkdir(parents=True, exist_ok=True)
                    with open(TOKEN_PATH, "w") as token_file:
                        token_file.write(creds.to_json())

            self.service = build("drive", "v3", credentials=creds)
        except Exception as e:
            self.service = None
            self.error = str(e)

    def is_connected(self) -> bool:
        return self.service is not None

    def upload_file(
        self,
        file_path: str,
        custom_name: Optional[str] = None,
        folder_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tải một tệp từ ổ đĩa máy tính lên Google Drive.
        """
        if not self.service:
            return {"success": False, "error": f"Chưa kết nối Google Drive API: {getattr(self, 'error', 'Unknown')}"}

        path = Path(file_path)
        if not path.is_file():
            return {"success": False, "error": f"Tệp không tồn tại: {file_path}"}

        file_name = custom_name or path.name
        dest_folder_id = folder_id or self.target_folder_id

        # Đoán MIME Type
        mime_type, _ = mimetypes.guess_type(str(path))
        if not mime_type:
            mime_type = "application/octet-stream"

        media = MediaFileUpload(str(path), mimetype=mime_type, resumable=True)
        file_metadata = {
            "name": file_name,
            "parents": [dest_folder_id]
        }

        try:
            drive_file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id, name, mimeType, size, webViewLink, webContentLink"
            ).execute()

            return {
                "success": True,
                "file": {
                    "id": drive_file.get("id"),
                    "name": drive_file.get("name"),
                    "mime_type": drive_file.get("mimeType"),
                    "size": drive_file.get("size", path.stat().st_size),
                    "url": drive_file.get("webViewLink")
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def upload_bytes(
        self,
        data: bytes,
        file_name: str,
        mime_type: Optional[str] = None,
        folder_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tải dữ liệu byte (tải trực tiếp từ bộ nhớ hoặc stream mạng) lên Google Drive.
        """
        if not self.service:
            return {"success": False, "error": f"Chưa kết nối Google Drive API: {getattr(self, 'error', 'Unknown')}"}

        dest_folder_id = folder_id or self.target_folder_id
        if not mime_type:
            mime_type, _ = mimetypes.guess_type(file_name)
            mime_type = mime_type or "application/octet-stream"

        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime_type, resumable=True)
        file_metadata = {
            "name": file_name,
            "parents": [dest_folder_id]
        }

        try:
            drive_file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id, name, mimeType, size, webViewLink, webContentLink"
            ).execute()

            return {
                "success": True,
                "file": {
                    "id": drive_file.get("id"),
                    "name": drive_file.get("name"),
                    "mime_type": drive_file.get("mimeType"),
                    "size": len(data),
                    "url": drive_file.get("webViewLink")
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


if __name__ == "__main__":
    uploader = GoogleDriveUploader()
    print("Trạng thái kết nối Google Drive:", uploader.is_connected())
    print("Thư mục đích:", uploader.target_folder_id)
