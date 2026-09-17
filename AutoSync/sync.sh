#!/usr/bin/env bash

# ==============================================================================
# AutoSync - Git Auto Synchronizer for LDMega (with Interactive Confirmation)
# Đồng bộ tự động code của tất cả các thư mục con trong LDMega lên GitHub
# Có hộp thoại hỏi người dùng xác nhận Đồng ý / Để sau trước khi đẩy code.
# ==============================================================================

set -e

# Đặt biến môi trường an toàn
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

# Xác định đường dẫn thư mục
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$SCRIPT_DIR/sync.log"
SKIP_RECORD="$SCRIPT_DIR/.last_skipped_hash"

log() {
    local timestamp
    timestamp="$(date "+%Y-%m-%d %H:%M:%S")"
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

notify() {
    local title="$1"
    local message="$2"
    osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
}

cd "$PROJECT_ROOT"

# 1. Kiểm tra thay đổi trong git
CHANGES=$(git status --porcelain)

if [ -z "$CHANGES" ]; then
    # Không có thay đổi nào, kết thúc âm thầm
    exit 0
fi

# 2. Tạo mã băm (hash) của danh sách thay đổi hiện tại
CURRENT_HASH=$(echo "$CHANGES" | shasum | awk '{print $1}')
CURRENT_TIME=$(date +%s)

# Kiểm tra nếu người dùng vừa chọn "Để sau" cho tập thay đổi này và chưa quá 3 phút (180s)
if [ "$1" != "--no-prompt" ] && [ "$1" != "--force" ] && [ -f "$SKIP_RECORD" ]; then
    RECORDED_HASH=$(awk '{print $1}' "$SKIP_RECORD" 2>/dev/null || echo "")
    RECORDED_TIME=$(awk '{print $2}' "$SKIP_RECORD" 2>/dev/null || echo "0")
    TIME_DIFF=$((CURRENT_TIME - RECORDED_TIME))

    if [ "$CURRENT_HASH" = "$RECORDED_HASH" ] && [ "$TIME_DIFF" -lt 180 ]; then
        # Vẫn là thay đổi cũ và đang trong thời gian tạm hoãn -> không làm phiền người dùng
        exit 0
    fi
fi

# 3. Phát hiện các thư mục con có thay đổi
CHANGED_MODULES=$(git status --porcelain | awk '{print $NF}' | cut -d'/' -f1 | sort -u | tr '\n' ' ' | sed 's/ $//')
CHANGED_FILES_COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')

# 4. Hiển thị hộp thoại hỏi người dùng trên macOS (hết hạn sau 120s nếu không ở máy)
USER_CHOICE="YES"
if [ "$1" != "--no-prompt" ]; then
    USER_CHOICE=$(osascript <<EOF 2>/dev/null || echo "CANCEL"
tell application "System Events"
    activate
    try
        set res to display alert "LDMega AutoSync" message "Phát hiện có thay đổi code mới tại thư mục: [ $CHANGED_MODULES ] ($CHANGED_FILES_COUNT tệp thay đổi).\n\nBạn có đồng ý đẩy (push) lên GitHub ngay bây giờ không?" as informational buttons {"Để sau", "Đồng ý đẩy"} default button "Đồng ý đẩy" giving up after 120
        if gave up of res then
            return "TIMEOUT"
        else if button returned of res is "Đồng ý đẩy" then
            return "YES"
        else
            return "NO"
        end if
    on error
        return "CANCEL"
    end try
end tell
EOF
)
fi

# 5. Xử lý phản hồi của người dùng
if [ "$USER_CHOICE" != "YES" ]; then
    # Người dùng chọn "Để sau" hoặc huỷ/hết giờ -> Ghi nhận để tạm hoãn 3 phút
    echo "$CURRENT_HASH $CURRENT_TIME" > "$SKIP_RECORD"
    log "⏸️ Người dùng chọn 'Để sau' (hoặc hết hạn) cho thay đổi tại [$CHANGED_MODULES]. Tạm dừng nhắc nhở 3 phút."
    exit 0
fi

# Đã đồng ý -> Xóa trạng thái tạm hoãn
rm -f "$SKIP_RECORD"

TIMESTAMP="$(date "+%Y-%m-%d %H:%M:%S")"
COMMIT_MSG="Auto-sync: [$CHANGED_MODULES] at $TIMESTAMP"

log "Phát hiện thay đổi ở [$CHANGED_MODULES]. Người dùng đã ĐỒNG Ý. Bắt đầu đồng bộ..."

# 6. Thực hiện add, commit và push
git add -A

if ! git diff --cached --quiet; then
    git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1
    log "Đã commit: $COMMIT_MSG"
fi

if git push origin main >> "$LOG_FILE" 2>&1; then
    log "✅ Đồng bộ thành công lên GitHub (origin/main)!"
    notify "AutoSync - LDMega" "Đã đồng bộ [$CHANGED_MODULES] lên GitHub thành công!"
else
    log "❌ Lỗi khi push lên GitHub. Vui lòng kiểm tra lại mạng."
    notify "AutoSync - LDMega" "Lỗi khi đẩy code lên GitHub. Hãy kiểm tra kết nối mạng."
fi

# Giới hạn kích thước file log
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 1000 ]; then
    tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
