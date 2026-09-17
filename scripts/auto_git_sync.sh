#!/bin/bash
# Auto-sync script for LDMega repository

PROJECT_DIR="/Users/sontran/Desktop/LDMega"
LOG_FILE="/Users/sontran/.ldmega_autosync.log"
SSH_KEY="/Users/sontran/.ssh/id_ed25519"

cd "$PROJECT_DIR" || exit 1

# Check if there are any git changes
CHANGES=$(git status --porcelain)

if [ -n "$CHANGES" ]; then
    NOW=$(date "+%Y-%m-%d %H:%M:%S")
    COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
    SUMMARY=$(echo "$CHANGES" | awk '{print $2}' | head -n 3 | tr '\n' ', ' | sed 's/, $//')
    
    if [ "$COUNT" -gt 3 ]; then
        MSG="Auto-sync: $SUMMARY (+ $((COUNT - 3)) files) at $NOW"
    else
        MSG="Auto-sync: $SUMMARY at $NOW"
    fi

    echo "[$NOW] Changes detected ($COUNT files). Syncing..." >> "$LOG_FILE"
    
    git add .
    git commit -m "$MSG" >> "$LOG_FILE" 2>&1
    
    GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
        git push origin main >> "$LOG_FILE" 2>&1
        
    if [ $? -eq 0 ]; then
        echo "[$NOW] Push successful: $MSG" >> "$LOG_FILE"
    else
        echo "[$NOW] Push failed! Will retry next cycle." >> "$LOG_FILE"
    fi
fi
