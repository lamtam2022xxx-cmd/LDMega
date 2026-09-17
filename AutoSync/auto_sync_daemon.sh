#!/usr/bin/env bash

# ==============================================================================
# AutoSync Daemon - Vòng lặp tự động chạy nền đồng bộ GitHub
# Chu kỳ mặc định: 30 giây kiểm tra 1 lần
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/autosync.pid"
INTERVAL=30 # Thời gian giãn cách giữa các lần kiểm tra (giây)

cleanup() {
    echo "Dừng AutoSync Daemon..."
    rm -f "$PID_FILE"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo $$ > "$PID_FILE"
echo "AutoSync Daemon khởi động thành công với PID $$ (chu kỳ: ${INTERVAL}s)."

while true; do
    bash "$SCRIPT_DIR/sync.sh"
    sleep "$INTERVAL"
done
