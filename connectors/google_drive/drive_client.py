"""
Google Drive API Connector (Python)
Cung cấp các hàm tương tác tiện lợi với Google Drive API v3:
- Tìm kiếm tệp / thư mục
- Tạo thư mục mới
- Tải lên tệp
- Chia sẻ quyền truy cập
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Tích hợp sẵn với module auth của FolderSyncGGdriver nếu có
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
FOLDER_SYNC_DIR = PROJECT_ROOT / "FolderSyncGGdriver"

if str(FOLDER_SYNC_DIR) not in sys.path:
    sys.path.insert(0, str(FOLDER_SYNC_DIR))

class GoogleDriveClient:
    def __init__(self, credentials_path: Optional[str] = None):
        self.credentials_path = credentials_path or os.getenv(
            "CREDENTIALS_PATH", 
            str(FOLDER_SYNC_DIR / "credentials" / "credentials.json")
        )
        self.service = None
        self._init_service()

    def _init_service(self):
        """Khởi tạo Google Drive API Service qua module auth sẵn có."""
        try:
            import auth
            self.service = auth.get_drive_service(self.credentials_path)
        except Exception as e:
            # Service chưa sẵn sàng (chưa có credentials hoặc thư viện)
            self.service = None
            self.init_error = str(e)

    def is_ready(self) -> bool:
        return self.service is not None

    def list_files(self, folder_id: Optional[str] = None, page_size: int = 20) -> List[Dict[str, Any]]:
        """Lấy danh sách tệp trong thư mục Drive."""
        if not self.service:
            return []

        query = f"'{folder_id}' in parents and trashed = false" if folder_id else "trashed = false"
        results = self.service.files().list(
            q=query,
            pageSize=page_size,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)"
        ).execute()

        return results.get("files", [])

    def create_folder(self, folder_name: str, parent_folder_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Tạo một thư mục mới trên Google Drive."""
        if not self.service:
            return None

        metadata = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder"
        }
        if parent_folder_id:
            metadata["parents"] = [parent_folder_id]

        return self.service.files().create(body=metadata, fields="id, name, webViewLink").execute()

if __name__ == "__main__":
    client = GoogleDriveClient()
    print("Google Drive Client ready status:", client.is_ready())
