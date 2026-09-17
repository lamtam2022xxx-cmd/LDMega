#!/usr/bin/env bash

# ==============================================================================
# Kiểm tra trạng thái AutoSync và xem log
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$SCRIPT_DIR/autosync.pid"
LOG_FILE="$SCRIPT_DIR/sync.log"

echo "=================================================="
echo "📊 TRẠNG THÁI TỰ ĐỘNG ĐỒNG BỘ (AUTOSYNC)"
echo "=================================================="

# 1. Kiểm tra tiến trình
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "🟢 TIẾN TRÌNH: Đang chạy nền (PID: $PID)"
    else
        echo "🔴 TIẾN TRÌNH: Đã tắt (PID cũ: $PID không còn tồn tại)"
    fi
else
    echo "⚪ TIẾN TRÌNH: Hiện đang tắt"
fi

# 2. Kiểm tra Git Status
cd "$PROJECT_ROOT"
PENDING=$(git status --porcelain)
echo "--------------------------------------------------"
if [ -z "$PENDING" ]; then
    echo "✅ GIT: Mọi thư mục con đã được đồng bộ sạch sẽ."
else
    echo "⏳ GIT: Đang có thay đổi chờ đồng bộ:"
    echo "$PENDING"
fi

# 3. Commit gần nhất
echo "--------------------------------------------------"
echo "📌 COMMIT GẦN NHẤT:"
git log -1 --pretty=format:"  Commit: %h%n  Tác giả: %an%n  Thời gian: %ad%n  Nội dung: %s" --date=format:'%Y-%m-%d %H:%M:%S'
echo ""

# 4. Xem 10 dòng log mới nhất
echo "--------------------------------------------------"
echo "📜 NHẬT KÝ ĐỒNG BỘ GẦN ĐÂY (sync.log):"
if [ -f "$LOG_FILE" ]; then
    tail -n 10 "$LOG_FILE"
else
    echo "  (Chưa có file log)"
fi
echo "=================================================="
