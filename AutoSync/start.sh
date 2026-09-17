#!/usr/bin/env bash

# ==============================================================================
# Bắt đầu dịch vụ AutoSync chạy nền
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/autosync.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "⚠️  AutoSync Daemon đang chạy sẵn với PID: $PID"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

# Chạy daemon dưới dạng background process
nohup bash "$SCRIPT_DIR/auto_sync_daemon.sh" > /dev/null 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo "✅ AutoSync đã được khởi động chạy nền thành công (PID: $NEW_PID)!"
echo "👉 Xem trạng thái: bash AutoSync/status.sh"
echo "👉 Dừng dịch vụ:   bash AutoSync/stop.sh"
