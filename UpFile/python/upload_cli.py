"""
Công cụ dòng lệnh (CLI) tải lên tệp vào Google Drive
Hỗ trợ 2 phương thức:
1. Trực tiếp qua Google Drive API (Local / Service Account / OAuth)
2. Thông qua Link Script (Google Apps Script Web App REST API)

Thư mục đích: https://drive.google.com/drive/folders/1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I
"""

import sys
import argparse
import base64
import json
import mimetypes
from pathlib import Path

# Thêm thư mục hiện tại vào sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import DRIVE_FOLDER_ID, GAS_WEBAPP_URL
from drive_uploader import GoogleDriveUploader

try:
    import requests
except ImportError:
    requests = None


def upload_via_direct_api(file_path: str, custom_name: str = None, folder_id: str = None):
    """Tải tệp trực tiếp lên Drive qua API v3."""
    print(f"🚀 Đang tải lên trực tiếp qua Google Drive API v3...")
    uploader = GoogleDriveUploader(target_folder_id=folder_id)
    if not uploader.is_connected():
        print(f"❌ Không thể kết nối Google Drive API: {getattr(uploader, 'error', '')}")
        print("💡 Hãy kiểm tra lại file credentials.json hoặc token.json.")
        return False

    res = uploader.upload_file(file_path, custom_name=custom_name, folder_id=folder_id)
    if res.get("success"):
        file_info = res["file"]
        print(f"✅ Tải lên thành công!")
        print(f"   📄 Tên tệp: {file_info['name']}")
        print(f"   📦 Kích thước: {file_info['size']} bytes")
        print(f"   🔗 Liên kết Drive: {file_info['url']}")
        return True
    else:
        print(f"❌ Lỗi tải lên: {res.get('error')}")
        return False


def upload_via_script_link(file_path: str, script_url: str = None, custom_name: str = None):
    """Tải tệp thông qua Link Script (Google Apps Script Web App)."""
    target_url = script_url or GAS_WEBAPP_URL
    if not target_url:
        print("❌ Chưa cấu hình Link Script (GAS_WEBAPP_URL).")
        print("💡 Vui lòng truyền qua tham số --script-url hoặc khai báo trong UpFile/.env")
        return False

    if not requests:
        print("❌ Thư viện 'requests' chưa được cài đặt. Chạy: pip install requests")
        return False

    path = Path(file_path)
    if not path.is_file():
        print(f"❌ Tệp không tồn tại: {file_path}")
        return False

    file_name = custom_name or path.name
    mime_type, _ = mimetypes.guess_type(str(path))
    mime_type = mime_type or "application/octet-stream"

    print(f"🚀 Đang tải lên thông qua Link Script: {target_url}")
    print(f"   📄 Tệp: {file_name} ({path.stat().st_size} bytes)")

    try:
        with open(path, "rb") as f:
            encoded_bytes = base64.b64encode(f.read()).decode("utf-8")

        payload = {
            "action": "upload_file",
            "file_name": file_name,
            "mime_type": mime_type,
            "base64_data": encoded_bytes
        }

        response = requests.post(
            target_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )

        res_json = response.json()
        if res_json.get("success"):
            file_info = res_json["file"]
            print(f"✅ Tải lên thành công qua Link Script!")
            print(f"   📄 Tên tệp: {file_info.get('name')}")
            print(f"   🔗 Liên kết Drive: {file_info.get('url')}")
            return True
        else:
            print(f"❌ Lỗi từ Link Script: {res_json.get('error')}")
            return False

    except Exception as e:
        print(f"❌ Lỗi kết nối đến Link Script: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="UpFile CLI - Tải tệp lên Google Drive (ID: 1_gUGMTzYbXbY4qXGJwGl9NTftwaOsG0I)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ sử dụng:
  # 1. Tải lên trực tiếp qua Google Drive API
  python upload_cli.py --file tailieu.pdf

  # 2. Tải lên thông qua Link Script (Google Apps Script Web App)
  python upload_cli.py --file anh.png --mode script --script-url https://script.google.com/macros/s/.../exec
        """
    )

    parser.add_argument("--file", "-f", required=True, help="Đường dẫn đến tệp cần tải lên")
    parser.add_argument("--name", "-n", help="Tên tệp tùy chỉnh trên Google Drive")
    parser.add_argument("--mode", "-m", choices=["direct", "script"], default="direct",
                        help="Chế độ tải lên: 'direct' (Drive API) hoặc 'script' (Link Script Web App)")
    parser.add_argument("--script-url", "-s", help="URL Link Script Web App (chỉ cần khi dùng mode script)")
    parser.add_argument("--folder-id", help=f"ID thư mục Drive đích (mặc định: {DRIVE_FOLDER_ID})")

    args = parser.parse_args()

    if args.mode == "direct":
        success = upload_via_direct_api(args.file, custom_name=args.name, folder_id=args.folder_id)
    else:
        success = upload_via_script_link(args.file, script_url=args.script_url, custom_name=args.name)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
