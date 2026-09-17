"""
Đồng bộ dữ liệu giữa thư mục local và Google Drive.
Hỗ trợ: upload, download, đồng bộ 2 chiều.
"""
import os
from datetime import datetime
from colorama import Fore, Style

import config
from drive_manager import (
    upload_file, upload_folder, download_file, download_folder,
    create_folder, get_md5, _format_size
)


def sync_upload(service, local_path=None, drive_folder_id=None):
    """
    Đồng bộ từ local lên Drive.
    So sánh MD5 để chỉ upload file mới hoặc đã thay đổi.
    """
    if local_path is None:
        local_path = config.LOCAL_DATA_PATH
    if drive_folder_id is None:
        drive_folder_id = config.DRIVE_FOLDER_ID

    if not os.path.exists(local_path):
        print(f"{Fore.RED}❌ Thư mục local không tồn tại: {local_path}{Style.RESET_ALL}")
        return

    print(f"\n{Fore.CYAN}🔄 Đồng bộ: {local_path} → Google Drive{Style.RESET_ALL}")
    print(f"{'─' * 50}")

    # Lấy danh sách file trên Drive
    drive_files = _get_drive_file_map(service, drive_folder_id)
    
    stats = {"uploaded": 0, "skipped": 0, "folders": 0}
    _sync_upload_recursive(service, local_path, drive_folder_id, drive_files, stats)

    print(f"\n{Fore.GREEN}✅ Đồng bộ hoàn tất!{Style.RESET_ALL}")
    print(f"   ⬆️  Đã upload: {stats['uploaded']} file")
    print(f"   ⏭️  Bỏ qua:    {stats['skipped']} file (không thay đổi)")
    print(f"   📁 Thư mục:   {stats['folders']} thư mục")


def _sync_upload_recursive(service, local_path, drive_folder_id, drive_files, stats):
    """Đệ quy upload thư mục."""
    for item in sorted(os.listdir(local_path)):
        if item.startswith("."):
            continue

        item_path = os.path.join(local_path, item)

        if os.path.isdir(item_path):
            # Tìm hoặc tạo thư mục trên Drive
            if item in drive_files and drive_files[item]["mimeType"] == "application/vnd.google-apps.folder":
                subfolder_id = drive_files[item]["id"]
            else:
                subfolder_id = create_folder(service, item, drive_folder_id)
                stats["folders"] += 1

            # Lấy file map của thư mục con
            sub_drive_files = _get_drive_file_map(service, subfolder_id)
            _sync_upload_recursive(service, item_path, subfolder_id, sub_drive_files, stats)

        elif os.path.isfile(item_path):
            # So sánh MD5
            local_md5 = get_md5(item_path)
            
            if item in drive_files:
                drive_md5 = drive_files[item].get("md5Checksum", "")
                if local_md5 == drive_md5:
                    print(f"   ⏭️  Bỏ qua (giống): {item}")
                    stats["skipped"] += 1
                    continue
                else:
                    # File đã thay đổi - xóa bản cũ rồi upload mới
                    print(f"   🔄 Cập nhật: {item}")
                    service.files().delete(fileId=drive_files[item]["id"]).execute()

            upload_file(service, item_path, drive_folder_id)
            stats["uploaded"] += 1


def sync_download(service, drive_folder_id=None, local_path=None):
    """
    Đồng bộ từ Drive xuống local.
    So sánh MD5 để chỉ download file mới hoặc đã thay đổi.
    """
    if drive_folder_id is None:
        drive_folder_id = config.DRIVE_FOLDER_ID
    if local_path is None:
        local_path = config.LOCAL_DATA_PATH

    os.makedirs(local_path, exist_ok=True)

    print(f"\n{Fore.CYAN}🔄 Đồng bộ: Google Drive → {local_path}{Style.RESET_ALL}")
    print(f"{'─' * 50}")

    stats = {"downloaded": 0, "skipped": 0}
    _sync_download_recursive(service, drive_folder_id, local_path, stats)

    print(f"\n{Fore.GREEN}✅ Đồng bộ hoàn tất!{Style.RESET_ALL}")
    print(f"   ⬇️  Đã download: {stats['downloaded']} file")
    print(f"   ⏭️  Bỏ qua:      {stats['skipped']} file (không thay đổi)")


def _sync_download_recursive(service, drive_folder_id, local_path, stats):
    """Đệ quy download thư mục."""
    from googleapiclient.errors import HttpError

    try:
        query = f"'{drive_folder_id}' in parents and trashed = false"
        results = service.files().list(
            q=query,
            fields="files(id, name, mimeType, md5Checksum, size)"
        ).execute()

        items = results.get("files", [])

        for item in items:
            if item["mimeType"] == "application/vnd.google-apps.folder":
                subfolder_path = os.path.join(local_path, item["name"])
                os.makedirs(subfolder_path, exist_ok=True)
                _sync_download_recursive(service, item["id"], subfolder_path, stats)
            else:
                local_file_path = os.path.join(local_path, item["name"])
                
                # So sánh MD5 nếu file local đã tồn tại
                if os.path.exists(local_file_path):
                    local_md5 = get_md5(local_file_path)
                    drive_md5 = item.get("md5Checksum", "")
                    
                    if local_md5 == drive_md5:
                        print(f"   ⏭️  Bỏ qua (giống): {item['name']}")
                        stats["skipped"] += 1
                        continue

                download_file(service, item["id"], local_file_path)
                stats["downloaded"] += 1

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi đồng bộ: {e}{Style.RESET_ALL}")


def sync_both(service, local_path=None, drive_folder_id=None):
    """
    Đồng bộ 2 chiều: upload file local mới lên Drive, download file Drive mới về local.
    """
    if local_path is None:
        local_path = config.LOCAL_DATA_PATH
    if drive_folder_id is None:
        drive_folder_id = config.DRIVE_FOLDER_ID

    print(f"\n{Fore.CYAN}🔄 Đồng bộ 2 chiều: {local_path} ↔ Google Drive{Style.RESET_ALL}")
    print(f"{'═' * 50}")

    # Bước 1: Download file mới từ Drive
    print(f"\n{Fore.YELLOW}📥 Bước 1: Download từ Drive...{Style.RESET_ALL}")
    sync_download(service, drive_folder_id, local_path)

    # Bước 2: Upload file mới lên Drive
    print(f"\n{Fore.YELLOW}📤 Bước 2: Upload lên Drive...{Style.RESET_ALL}")
    sync_upload(service, local_path, drive_folder_id)

    print(f"\n{Fore.GREEN}{'═' * 50}")
    print(f"✅ Đồng bộ 2 chiều hoàn tất!{Style.RESET_ALL}")


def _get_drive_file_map(service, folder_id):
    """
    Lấy danh sách file trong thư mục Drive dưới dạng dict {name: file_info}.
    """
    from googleapiclient.errors import HttpError
    
    try:
        query = f"'{folder_id}' in parents and trashed = false"
        results = service.files().list(
            q=query,
            fields="files(id, name, mimeType, md5Checksum, size, modifiedTime)"
        ).execute()
        
        files = results.get("files", [])
        return {f["name"]: f for f in files}
    
    except HttpError:
        return {}
