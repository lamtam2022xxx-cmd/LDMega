#!/usr/bin/env bash

# ==============================================================================
# AutoSync - Git Auto Synchronizer for LDMega
# Đồng bộ tự động tất cả các thư mục con trong LDMega lên GitHub
# ==============================================================================

set -e

# Đặt biến môi trường
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

# Xác định đường dẫn thư mục
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$SCRIPT_DIR/sync.log"

log() {
    local timestamp
    timestamp="$(date "+%Y-%m-%d %H:%M:%S")"
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

cd "$PROJECT_ROOT"

# Kiểm tra thay đổi trong git (bao gồm tất cả thư mục con: FolderSyncGGdriver, HR, AutoSync, ...)
CHANGES=$(git status --porcelain)

if [ -z "$CHANGES" ]; then
    # Không có thay đổi nào, kết thúc âm thầm
    exit 0
fi

# Phát hiện các thư mục con có thay đổi
CHANGED_MODULES=$(git status --porcelain | awk '{print $NF}' | cut -d'/' -f1 | sort -u | tr '\n' ' ' | sed 's/ $//')

TIMESTAMP="$(date "+%Y-%m-%d %H:%M:%S")"
COMMIT_MSG="Auto-sync: [$CHANGED_MODULES] at $TIMESTAMP"

log "Phát hiện thay đổi ở [$CHANGED_MODULES]. Bắt đầu đồng bộ..."

# Thực hiện add, commit và push
git add -A

# Commit nếu có staged changes
if ! git diff --cached --quiet; then
    git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
    log "Đã commit: $COMMIT_MSG"
fi

# Đẩy code lên GitHub
if git push origin main >> "$LOG_FILE" 2>&1; then
    log "✅ Đồng bộ thành công lên GitHub (origin/main)!"
else
    log "❌ Lỗi khi push lên GitHub. Kiểm tra kết nối mạng hoặc conflict."
fi

# Giới hạn kích thước file log (giữ lại 1000 dòng gần nhất)
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 1000 ]; then
    tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
