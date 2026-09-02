#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  OneID — Kiosk Launcher  (Raspberry Pi 4)
#
#  Usage:  ./run-kiosk.sh [MACBOOK_IP]
#
#  What it does:
#    1. Starts the Vite dev server on port 5173
#    2. Polls HTTP until Vite is actually serving
#    3. Opens Chromium in --kiosk fullscreen at http://localhost:5173/kiosk
#
#  Optional arg: IP of the MacBook running the Python InsightFace server.
#  Default: 192.168.1.100
#    ./run-kiosk.sh 192.168.1.42
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=5173
KIOSK_URL="http://localhost:${PORT}/kiosk"
MACBOOK_IP="${1:-192.168.1.100}"
export VITE_FACE_API_URL="http://${MACBOOK_IP}:8000"

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   OneID  ·  Kiosk Mode Launcher  (Raspberry Pi 4)   ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""
echo "  InsightFace API  →  ${VITE_FACE_API_URL}"
echo "  Kiosk URL        →  ${KIOSK_URL}"
echo ""

pkill -f "chromium.*--kiosk" 2>/dev/null || true

cd "$SCRIPT_DIR"
echo "  [vite]  Starting dev server on port ${PORT}..."
npm run dev -- --port "${PORT}" --host &
VITE_PID=$!

echo "  [wait]  Waiting for Vite to become ready..."
MAX_WAIT=90
ELAPSED=0
until curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "  [error] Vite did not start within ${MAX_WAIT}s — aborting."
    kill "$VITE_PID" 2>/dev/null || true
    exit 1
  fi
  printf "  [wait]  %ds...\r" "$ELAPSED"
done
echo "  [vite]  Ready ✓                    "

CHROMIUM_BIN=""
for candidate in chromium-browser chromium google-chrome; do
  if command -v "$candidate" &>/dev/null; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

if [ -z "$CHROMIUM_BIN" ]; then
  echo "  [error] No Chromium / Chrome found. Install: sudo apt install chromium-browser"
  kill "$VITE_PID" 2>/dev/null || true
  exit 1
fi

echo "  [kiosk] Launching ${CHROMIUM_BIN} in fullscreen kiosk mode..."
"$CHROMIUM_BIN" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  --incognito \
  "$KIOSK_URL" &
CHROMIUM_PID=$!

cleanup() {
  echo ""
  echo "  [stop]  Shutting down..."
  kill "$CHROMIUM_PID" 2>/dev/null || true
  kill "$VITE_PID"     2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$VITE_PID"
