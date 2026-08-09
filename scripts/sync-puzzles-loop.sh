#!/bin/bash
# Run the puzzle sync, retrying until it completes (idempotent + resume-safe).
# Used by both the daily systemd timer and manual overnight runs.
cd "/home/sarok/projects/anathor projects/FinalRank" || exit 1
LOG="/tmp/opencode/puzzles_sync.log"
echo "=== sync start $(date -Is) ===" >> "$LOG"
until node scripts/sync-puzzles.mjs >> "$LOG" 2>&1; do
  echo "=== sync failed at $(date -Is); retrying in 300s ===" >> "$LOG"
  sleep 300
done
echo "=== sync complete $(date -Is) ===" >> "$LOG"
