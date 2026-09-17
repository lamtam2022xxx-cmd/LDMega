#!/usr/bin/env bash

# ==============================================================================
# Dừng dịch vụ AutoSync
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/autosync.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID" 2>/dev/null || true
        # Tiêu diệt tiến trình con (sleep / sync nếu có)
        pkill -P "$PID" 2>/dev/null || true
        rm -f "$PID_FILE"
        echo "🛑 Đã dừng AutoSync Daemon (PID: $PID)."
        exit 0
    else
        rm -f "$PID_FILE"
        echo "ℹ️  Không tìm thấy tiến trình AutoSync nào đang chạy."
    fi
else
    echo "ℹ️  AutoSync hiện không chạy."
fi
