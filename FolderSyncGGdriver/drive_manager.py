"""
Quản lý file/folder trên Google Drive.
Hỗ trợ: liệt kê, upload, download, tạo folder, xóa, tìm kiếm.
"""
import os
import io
import hashlib
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError
from tqdm import tqdm
from tabulate import tabulate
from colorama import Fore, Style

import config


def list_files(service, folder_id=None, show_tree=False, indent=0):
    """
    Liệt kê file/folder trong một thư mục Drive.
    
    Args:
        service: Google Drive service object
        folder_id: ID thư mục (mặc định: DRIVE_FOLDER_ID từ config)
        show_tree: Hiển thị dạng cây thư mục
        indent: Mức thụt lề (dùng cho tree view)
    
    Returns:
        list: Danh sách file/folder
    """
    if folder_id is None:
        folder_id = config.DRIVE_FOLDER_ID

    try:
        query = f"'{folder_id}' in parents and trashed = false"
        results = service.files().list(
            q=query,
            pageSize=100,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum)",
            orderBy="folder, name"
        ).execute()

        items = results.get("files", [])

        if not items:
            if indent == 0:
                print(f"{Fore.YELLOW}📁 Thư mục trống.{Style.RESET_ALL}")
            return []

        if show_tree:
            _print_tree(service, items, indent)
        else:
            _print_table(items)

        return items

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi khi liệt kê file: {e}{Style.RESET_ALL}")
        return []


def _print_tree(service, items, indent=0):
    """In danh sách file dạng cây."""
    prefix = "  " * indent
    for item in items:
        is_folder = item["mimeType"] == "application/vnd.google-apps.folder"
        icon = "📁" if is_folder else "📄"
        size = _format_size(int(item.get("size", 0))) if not is_folder else ""
        
        print(f"{prefix}{icon} {item['name']} {Fore.CYAN}{size}{Style.RESET_ALL}")
        
        if is_folder:
            list_files(service, item["id"], show_tree=True, indent=indent + 1)


def _print_table(items):
    """In danh sách file dạng bảng."""
    table_data = []
    for item in items:
        is_folder = item["mimeType"] == "application/vnd.google-apps.folder"
        icon = "📁" if is_folder else "📄"
        size = _format_size(int(item.get("size", 0))) if not is_folder else "-"
        modified = item.get("modifiedTime", "N/A")[:10]
        
        table_data.append([
            icon,
            item["name"],
            size,
            modified,
            item["id"][:20] + "..."
        ])

    headers = ["", "Tên", "Kích thước", "Ngày sửa", "ID"]
    print(tabulate(table_data, headers=headers, tablefmt="rounded_grid"))
    print(f"\n{Fore.GREEN}Tổng: {len(items)} mục{Style.RESET_ALL}")


def upload_file(service, local_path, folder_id=None):
    """
    Upload file lên Google Drive.
    
    Args:
        service: Google Drive service object
        local_path: Đường dẫn file local
        folder_id: ID thư mục đích trên Drive
    
    Returns:
        dict: Thông tin file đã upload
    """
    if folder_id is None:
        folder_id = config.DRIVE_FOLDER_ID

    if not os.path.exists(local_path):
        print(f"{Fore.RED}❌ File không tồn tại: {local_path}{Style.RESET_ALL}")
        return None

    file_name = os.path.basename(local_path)
    file_size = os.path.getsize(local_path)

    file_metadata = {
        "name": file_name,
        "parents": [folder_id]
    }

    # Resumable upload cho file lớn
    media = MediaFileUpload(
        local_path,
        resumable=True,
        chunksize=1024 * 1024 * 5  # 5MB chunks
    )

    try:
        print(f"⬆️  Đang upload: {file_name} ({_format_size(file_size)})")
        
        request = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, name, size, webViewLink"
        )

        # Progress bar
        response = None
        pbar = tqdm(total=file_size, unit="B", unit_scale=True, desc=file_name)
        
        while response is None:
            status, response = request.next_chunk()
            if status:
                pbar.update(int(status.resumable_progress) - pbar.n)
        
        pbar.update(file_size - pbar.n)
        pbar.close()

        result = response
        print(f"{Fore.GREEN}✅ Upload thành công: {result['name']}{Style.RESET_ALL}")
        print(f"   🔗 Link: {result.get('webViewLink', 'N/A')}")
        return result

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi upload: {e}{Style.RESET_ALL}")
        return None


def upload_folder(service, local_path, parent_folder_id=None):
    """
    Upload toàn bộ thư mục lên Google Drive (đệ quy).
    
    Args:
        service: Google Drive service object
        local_path: Đường dẫn thư mục local
        parent_folder_id: ID thư mục cha trên Drive
    
    Returns:
        str: ID thư mục đã tạo trên Drive
    """
    if parent_folder_id is None:
        parent_folder_id = config.DRIVE_FOLDER_ID

    folder_name = os.path.basename(local_path)
    
    # Tạo thư mục trên Drive
    drive_folder_id = create_folder(service, folder_name, parent_folder_id)
    
    if not drive_folder_id:
        return None

    # Upload từng file/thư mục con
    for item in sorted(os.listdir(local_path)):
        item_path = os.path.join(local_path, item)
        
        if item.startswith("."):
            continue
            
        if os.path.isfile(item_path):
            upload_file(service, item_path, drive_folder_id)
        elif os.path.isdir(item_path):
            upload_folder(service, item_path, drive_folder_id)

    print(f"{Fore.GREEN}✅ Upload thư mục thành công: {folder_name}{Style.RESET_ALL}")
    return drive_folder_id


def download_file(service, file_id, local_path=None):
    """
    Download file từ Google Drive.
    
    Args:
        service: Google Drive service object
        file_id: ID file trên Drive
        local_path: Đường dẫn lưu file local
    
    Returns:
        str: Đường dẫn file đã download
    """
    try:
        # Lấy thông tin file
        file_info = service.files().get(
            fileId=file_id, 
            fields="id, name, size, mimeType"
        ).execute()
        
        file_name = file_info["name"]
        file_size = int(file_info.get("size", 0))
        
        # Xác định đường dẫn lưu
        if local_path is None:
            local_path = os.path.join(config.LOCAL_DATA_PATH, file_name)
        elif os.path.isdir(local_path):
            local_path = os.path.join(local_path, file_name)

        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)

        # Google Docs/Sheets/Slides cần export
        if file_info["mimeType"].startswith("application/vnd.google-apps."):
            return _export_google_doc(service, file_id, file_name, local_path, file_info["mimeType"])

        print(f"⬇️  Đang download: {file_name} ({_format_size(file_size)})")

        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)

        pbar = tqdm(total=file_size, unit="B", unit_scale=True, desc=file_name)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                pbar.update(int(status.progress() * file_size) - pbar.n)
        pbar.update(file_size - pbar.n)
        pbar.close()

        with open(local_path, "wb") as f:
            f.write(fh.getvalue())

        print(f"{Fore.GREEN}✅ Download thành công: {local_path}{Style.RESET_ALL}")
        return local_path

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi download: {e}{Style.RESET_ALL}")
        return None


def _export_google_doc(service, file_id, file_name, local_path, mime_type):
    """Export Google Docs/Sheets/Slides sang định dạng phổ biến."""
    export_map = {
        "application/vnd.google-apps.document": (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"
        ),
        "application/vnd.google-apps.spreadsheet": (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"
        ),
        "application/vnd.google-apps.presentation": (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"
        ),
    }

    if mime_type not in export_map:
        print(f"{Fore.YELLOW}⚠️  Không hỗ trợ export loại file: {mime_type}{Style.RESET_ALL}")
        return None

    export_mime, ext = export_map[mime_type]
    
    if not local_path.endswith(ext):
        local_path = local_path + ext

    print(f"⬇️  Đang export: {file_name} → {ext}")

    request = service.files().export_media(fileId=file_id, mimeType=export_mime)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)

    done = False
    while not done:
        status, done = downloader.next_chunk()

    with open(local_path, "wb") as f:
        f.write(fh.getvalue())

    print(f"{Fore.GREEN}✅ Export thành công: {local_path}{Style.RESET_ALL}")
    return local_path


def download_folder(service, folder_id, local_path=None):
    """
    Download toàn bộ thư mục từ Google Drive (đệ quy).
    
    Args:
        service: Google Drive service object
        folder_id: ID thư mục trên Drive
        local_path: Đường dẫn thư mục local
    """
    try:
        # Lấy tên thư mục
        folder_info = service.files().get(
            fileId=folder_id, fields="name"
        ).execute()
        
        folder_name = folder_info["name"]
        
        if local_path is None:
            local_path = os.path.join(config.LOCAL_DATA_PATH, folder_name)
        
        os.makedirs(local_path, exist_ok=True)

        # Liệt kê nội dung
        query = f"'{folder_id}' in parents and trashed = false"
        results = service.files().list(
            q=query,
            fields="files(id, name, mimeType)"
        ).execute()

        items = results.get("files", [])
        
        for item in items:
            if item["mimeType"] == "application/vnd.google-apps.folder":
                subfolder_path = os.path.join(local_path, item["name"])
                download_folder(service, item["id"], subfolder_path)
            else:
                download_file(service, item["id"], local_path)

        print(f"{Fore.GREEN}✅ Download thư mục thành công: {folder_name} → {local_path}{Style.RESET_ALL}")

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi download thư mục: {e}{Style.RESET_ALL}")


def create_folder(service, folder_name, parent_id=None):
    """
    Tạo thư mục trên Google Drive.
    
    Returns:
        str: ID thư mục mới
    """
    if parent_id is None:
        parent_id = config.DRIVE_FOLDER_ID

    file_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id]
    }

    try:
        folder = service.files().create(
            body=file_metadata, fields="id, name"
        ).execute()
        
        print(f"{Fore.GREEN}📁 Đã tạo thư mục: {folder['name']} (ID: {folder['id']}){Style.RESET_ALL}")
        return folder["id"]

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi tạo thư mục: {e}{Style.RESET_ALL}")
        return None


def delete_file(service, file_id):
    """Xóa file/folder trên Google Drive (chuyển vào thùng rác)."""
    try:
        # Lấy tên trước khi xóa
        file_info = service.files().get(fileId=file_id, fields="name").execute()
        
        service.files().update(
            fileId=file_id, body={"trashed": True}
        ).execute()
        
        print(f"{Fore.GREEN}🗑️  Đã xóa: {file_info['name']}{Style.RESET_ALL}")
        return True

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi xóa: {e}{Style.RESET_ALL}")
        return False


def search_files(service, query_text, folder_id=None):
    """
    Tìm kiếm file trên Google Drive.
    
    Args:
        query_text: Từ khóa tìm kiếm
        folder_id: Giới hạn trong thư mục (optional)
    """
    try:
        query = f"name contains '{query_text}' and trashed = false"
        if folder_id:
            query += f" and '{folder_id}' in parents"

        results = service.files().list(
            q=query,
            pageSize=50,
            fields="files(id, name, mimeType, size, modifiedTime, parents)",
            orderBy="modifiedTime desc"
        ).execute()

        items = results.get("files", [])
        
        if not items:
            print(f"{Fore.YELLOW}🔍 Không tìm thấy kết quả cho: '{query_text}'{Style.RESET_ALL}")
            return []

        print(f"{Fore.GREEN}🔍 Tìm thấy {len(items)} kết quả cho: '{query_text}'{Style.RESET_ALL}\n")
        _print_table(items)
        return items

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi tìm kiếm: {e}{Style.RESET_ALL}")
        return []


def get_file_info(service, file_id):
    """Hiển thị thông tin chi tiết của file."""
    try:
        file_info = service.files().get(
            fileId=file_id,
            fields="id, name, mimeType, size, modifiedTime, createdTime, "
                   "owners, webViewLink, md5Checksum, parents"
        ).execute()

        is_folder = file_info["mimeType"] == "application/vnd.google-apps.folder"
        
        print(f"\n{'📁' if is_folder else '📄'} {Fore.CYAN}{file_info['name']}{Style.RESET_ALL}")
        print(f"{'─' * 50}")
        print(f"  ID:          {file_info['id']}")
        print(f"  Loại:        {file_info['mimeType']}")
        if not is_folder:
            print(f"  Kích thước:  {_format_size(int(file_info.get('size', 0)))}")
        print(f"  Ngày tạo:    {file_info.get('createdTime', 'N/A')}")
        print(f"  Ngày sửa:    {file_info.get('modifiedTime', 'N/A')}")
        if file_info.get("md5Checksum"):
            print(f"  MD5:         {file_info['md5Checksum']}")
        if file_info.get("webViewLink"):
            print(f"  🔗 Link:     {file_info['webViewLink']}")
        
        owners = file_info.get("owners", [])
        if owners:
            print(f"  Chủ sở hữu: {owners[0].get('displayName', 'N/A')}")

        return file_info

    except HttpError as e:
        print(f"{Fore.RED}❌ Lỗi lấy thông tin: {e}{Style.RESET_ALL}")
        return None


def get_md5(file_path):
    """Tính MD5 hash của file local."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def _format_size(size_bytes):
    """Format kích thước file cho dễ đọc."""
    if size_bytes == 0:
        return "0 B"
    
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    while size >= 1024 and i < len(units) - 1:
        size /= 1024
        i += 1
    return f"{size:.1f} {units[i]}"
