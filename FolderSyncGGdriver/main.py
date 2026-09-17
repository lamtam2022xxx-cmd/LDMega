#!/usr/bin/env python3
"""
LDMega - Google Drive Manager CLI
Quản lý và đồng bộ dữ liệu với Google Drive.

Sử dụng:
    python main.py list                    Liệt kê file trên Drive
    python main.py list --tree             Liệt kê dạng cây
    python main.py upload <path>           Upload file/thư mục
    python main.py download <file_id>      Download file
    python main.py sync                    Đồng bộ 2 chiều
    python main.py sync --up               Chỉ upload
    python main.py sync --down             Chỉ download
    python main.py search <keyword>        Tìm kiếm file
    python main.py info <file_id>          Thông tin file
    python main.py mkdir <name>            Tạo thư mục
    python main.py delete <file_id>        Xóa file/thư mục
"""
import argparse
import sys
import os

from colorama import init as colorama_init, Fore, Style

# Khởi tạo colorama cho Windows
colorama_init()


BANNER = f"""
{Fore.CYAN}╔══════════════════════════════════════════════╗
║          🚀 LDMega Drive Manager 🚀          ║
║     Quản lý & Đồng bộ Google Drive CLI       ║
╚══════════════════════════════════════════════╝{Style.RESET_ALL}
"""


def main():
    parser = argparse.ArgumentParser(
        description="LDMega - Google Drive Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Lệnh")

    # --- list ---
    list_parser = subparsers.add_parser("list", aliases=["ls"], help="Liệt kê file trên Drive")
    list_parser.add_argument("--folder-id", "-f", help="ID thư mục (mặc định: thư mục gốc)")
    list_parser.add_argument("--tree", "-t", action="store_true", help="Hiển thị dạng cây")

    # --- upload ---
    upload_parser = subparsers.add_parser("upload", aliases=["up"], help="Upload file/thư mục")
    upload_parser.add_argument("path", help="Đường dẫn file hoặc thư mục local")
    upload_parser.add_argument("--folder-id", "-f", help="ID thư mục đích trên Drive")

    # --- download ---
    dl_parser = subparsers.add_parser("download", aliases=["dl"], help="Download file/thư mục")
    dl_parser.add_argument("file_id", help="ID file trên Drive")
    dl_parser.add_argument("--output", "-o", help="Đường dẫn lưu file")
    dl_parser.add_argument("--folder", action="store_true", help="Download cả thư mục")

    # --- sync ---
    sync_parser = subparsers.add_parser("sync", help="Đồng bộ dữ liệu")
    sync_dir = sync_parser.add_mutually_exclusive_group()
    sync_dir.add_argument("--up", action="store_true", help="Chỉ upload (local → Drive)")
    sync_dir.add_argument("--down", action="store_true", help="Chỉ download (Drive → local)")
    sync_parser.add_argument("--local-path", "-l", help="Đường dẫn thư mục local")
    sync_parser.add_argument("--folder-id", "-f", help="ID thư mục Drive")

    # --- search ---
    search_parser = subparsers.add_parser("search", aliases=["find"], help="Tìm kiếm file")
    search_parser.add_argument("query", help="Từ khóa tìm kiếm")
    search_parser.add_argument("--folder-id", "-f", help="Giới hạn trong thư mục")

    # --- info ---
    info_parser = subparsers.add_parser("info", help="Thông tin chi tiết file")
    info_parser.add_argument("file_id", help="ID file trên Drive")

    # --- mkdir ---
    mkdir_parser = subparsers.add_parser("mkdir", help="Tạo thư mục trên Drive")
    mkdir_parser.add_argument("name", help="Tên thư mục")
    mkdir_parser.add_argument("--parent-id", "-p", help="ID thư mục cha")

    # --- delete ---
    del_parser = subparsers.add_parser("delete", aliases=["rm"], help="Xóa file/thư mục")
    del_parser.add_argument("file_id", help="ID file cần xóa")
    del_parser.add_argument("--yes", "-y", action="store_true", help="Không hỏi xác nhận")

    args = parser.parse_args()

    if not args.command:
        print(BANNER)
        parser.print_help()
        return

    print(BANNER)

    # Xác thực
    print(f"{Fore.YELLOW}🔐 Đang xác thực...{Style.RESET_ALL}")
    from auth import authenticate
    service = authenticate()
    print()

    # Xử lý lệnh
    try:
        if args.command in ("list", "ls"):
            cmd_list(service, args)
        elif args.command in ("upload", "up"):
            cmd_upload(service, args)
        elif args.command in ("download", "dl"):
            cmd_download(service, args)
        elif args.command == "sync":
            cmd_sync(service, args)
        elif args.command in ("search", "find"):
            cmd_search(service, args)
        elif args.command == "info":
            cmd_info(service, args)
        elif args.command == "mkdir":
            cmd_mkdir(service, args)
        elif args.command in ("delete", "rm"):
            cmd_delete(service, args)
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}⚠️  Đã hủy thao tác.{Style.RESET_ALL}")
    except Exception as e:
        print(f"\n{Fore.RED}❌ Lỗi: {e}{Style.RESET_ALL}")
        sys.exit(1)


def cmd_list(service, args):
    from drive_manager import list_files
    folder_id = getattr(args, "folder_id", None)
    show_tree = getattr(args, "tree", False)
    list_files(service, folder_id, show_tree=show_tree)


def cmd_upload(service, args):
    from drive_manager import upload_file, upload_folder
    path = args.path
    folder_id = getattr(args, "folder_id", None)
    
    if os.path.isdir(path):
        upload_folder(service, path, folder_id)
    elif os.path.isfile(path):
        upload_file(service, path, folder_id)
    else:
        print(f"{Fore.RED}❌ Đường dẫn không tồn tại: {path}{Style.RESET_ALL}")


def cmd_download(service, args):
    from drive_manager import download_file, download_folder
    
    if getattr(args, "folder", False):
        download_folder(service, args.file_id, getattr(args, "output", None))
    else:
        download_file(service, args.file_id, getattr(args, "output", None))


def cmd_sync(service, args):
    from sync import sync_upload, sync_download, sync_both
    
    local_path = getattr(args, "local_path", None)
    folder_id = getattr(args, "folder_id", None)
    
    if args.up:
        sync_upload(service, local_path, folder_id)
    elif args.down:
        sync_download(service, folder_id, local_path)
    else:
        sync_both(service, local_path, folder_id)


def cmd_search(service, args):
    from drive_manager import search_files
    folder_id = getattr(args, "folder_id", None)
    search_files(service, args.query, folder_id)


def cmd_info(service, args):
    from drive_manager import get_file_info
    get_file_info(service, args.file_id)


def cmd_mkdir(service, args):
    from drive_manager import create_folder
    parent_id = getattr(args, "parent_id", None)
    create_folder(service, args.name, parent_id)


def cmd_delete(service, args):
    from drive_manager import delete_file, get_file_info
    
    if not getattr(args, "yes", False):
        # Hiển thị thông tin trước khi xóa
        file_info = get_file_info(service, args.file_id)
        if file_info:
            confirm = input(f"\n{Fore.YELLOW}⚠️  Bạn có chắc muốn xóa? (y/N): {Style.RESET_ALL}")
            if confirm.lower() != "y":
                print("❌ Đã hủy.")
                return
    
    delete_file(service, args.file_id)


if __name__ == "__main__":
    main()
