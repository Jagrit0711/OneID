#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  OneID — POS Kiosk Launcher  (Jetson Nano 4GB)
#  ─────────────────────────────────────────────────────────────────────────────
#  Starts the OneID stack. Zero npm/Node.js required at runtime.
#  The Python FastAPI server serves BOTH the AI API and the React frontend.
#
#  Usage:
#    ./run-pos-kiosk.sh              # boots to /kiosk   (Officer terminal)
#    ./run-pos-kiosk.sh --consumer   # boots to /consumer (Citizen self-service)
#    ./run-pos-kiosk.sh --admin      # boots to /super    (Admin dashboard)
#    ./run-pos-kiosk.sh --home       # boots to /         (Portal selector)
#
#  Requirements (installed by jetson-setup.sh):
#    - Python venv at server/venv   (InsightFace + FastAPI + StaticFiles)
#    - .output/public/              (built React bundle)
#    - chromium-browser
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PORT=8000           # FastAPI serves both the API and the React frontend
LOG="/tmp/oneid-pos-kiosk.log"
PYTHON="${SCRIPT_DIR}/server/venv/bin/python"
MAIN_PY="${SCRIPT_DIR}/server/main.py"

# ── Parse --flag ───────────────────────────────────────────────────────────────
TARGET_PATH="/kiosk"
case "${1:-}" in
  --consumer) TARGET_PATH="/consumer" ;;
  --admin)    TARGET_PATH="/super"    ;;
  --home)     TARGET_PATH="/"         ;;
  --kiosk|"") TARGET_PATH="/kiosk"   ;;
  *)
    echo "Usage: $0 [--kiosk|--consumer|--admin|--home]"
    exit 1
    ;;
esac

KIOSK_URL="http://localhost:${SERVER_PORT}${TARGET_PATH}"

exec > >(tee -a "$LOG") 2>&1

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  OneID POS Kiosk  ·  Jetson Nano 4GB  ·  $(date)"
echo "════════════════════════════════════════════════════════════"
echo "  Kiosk URL   →  ${KIOSK_URL}"
echo "  API health  →  http://localhost:${SERVER_PORT}/health"
echo ""

# ── Pre-flight checks ──────────────────────────────────────────────────────────
if [ ! -f "$PYTHON" ]; then
  echo "  [FAIL]   Python venv not found: ${PYTHON}"
  echo "           Run ./jetson-setup.sh first!"
  exit 1
fi

if [ ! -d "${SCRIPT_DIR}/.output/public" ]; then
  echo "  [FAIL]   React build not found: ${SCRIPT_DIR}/.output/public"
  echo "           Run ./jetson-setup.sh first (or npm run build on your dev machine"
  echo "           and copy .output/ to the Jetson)."
  exit 1
fi

echo "  [check]  Python venv     ✓"
echo "  [check]  React build     ✓  (.output/public/)"

# ── Display / X11 ─────────────────────────────────────────────────────────────
export DISPLAY="${DISPLAY:-:0}"
for xa in "$HOME/.Xauthority" "/home/oneid/.Xauthority" "/var/run/lightdm/root/:0"; do
  [ -f "$xa" ] && export XAUTHORITY="$xa" && break
done
echo "  [disp]   DISPLAY=${DISPLAY}"

xset s off 2>/dev/null || true
xset s noblank 2>/dev/null || true
xset -dpms 2>/dev/null || true
command -v unclutter &>/dev/null && unclutter -idle 1 -root & UNCLUTTER_PID=${!:-0}

# ── Kill stale processes ──────────────────────────────────────────────────────
pkill -f "chromium.*--kiosk" 2>/dev/null || true
pkill -f "uvicorn"           2>/dev/null || true
pkill -f "main.py"           2>/dev/null || true
sleep 1

# ── Start the OneID Python server (API + React frontend in one process) ───────
echo "  [server] Starting OneID Python server (API + frontend) on :${SERVER_PORT}..."
cd "${SCRIPT_DIR}/server"
"$PYTHON" main.py &
SERVER_PID=$!
cd "${SCRIPT_DIR}"
echo "  [server] PID=${SERVER_PID}"

# ── Wait for server to be ready ───────────────────────────────────────────────
echo "  [wait]   Waiting for server to be ready..."
ELAPSED=0
until curl -sf "http://localhost:${SERVER_PORT}/health" > /dev/null 2>&1; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  printf "  [wait]   %ds (InsightFace model loading takes ~30s first time)...\r" "$ELAPSED"
  if [ "$ELAPSED" -ge 180 ]; then
    echo ""
    echo "  [FAIL]   Server did not start after ${ELAPSED}s"
    echo "           Check logs: sudo journalctl -fu oneid-ai-server"
    kill "${SERVER_PID}" 2>/dev/null || true
    exit 1
  fi
done
echo ""
echo "  [server] Ready ✓ → http://localhost:${SERVER_PORT}"

# Verify the frontend is also being served
if curl -sf "http://localhost:${SERVER_PORT}/" | grep -q "html" 2>/dev/null; then
  echo "  [serve]  React frontend served ✓"
else
  echo "  [warn]   React build may not be mounted — check .output/public exists"
fi

# ── Find Chromium ─────────────────────────────────────────────────────────────
CHROMIUM_BIN=""
for candidate in chromium-browser chromium google-chrome-stable google-chrome; do
  command -v "$candidate" &>/dev/null && CHROMIUM_BIN="$candidate" && break
done

if [ -z "$CHROMIUM_BIN" ]; then
  echo "  [FAIL]   Chromium not found!"
  echo "           Install with: sudo apt install chromium-browser"
  kill "${SERVER_PID}" 2>/dev/null || true
  exit 1
fi
echo "  [browser] ${CHROMIUM_BIN}"

PROFILE_DIR="/tmp/oneid-chromium-profile"
rm -rf "$PROFILE_DIR" && mkdir -p "$PROFILE_DIR"

echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  Launching → ${KIOSK_URL}"
echo "  Ctrl+C to stop"
echo "  ─────────────────────────────────────────────────────────"
echo ""

# ── Launch Chromium with Jetson GPU flags ─────────────────────────────────────
DISPLAY="$DISPLAY" "$CHROMIUM_BIN" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="$PROFILE_DIR" \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --enable-native-gpu-memory-buffers \
  --ignore-gpu-blocklist \
  --use-gl=egl \
  --in-process-gpu \
  --disable-features=IsolateOrigins,site-per-process \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  "$KIOSK_URL" &

BROWSER_PID=$!
echo "  [kiosk]  Chromium PID=${BROWSER_PID}"

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "  [stop]   Shutting down OneID POS Kiosk..."
  kill "${BROWSER_PID}" 2>/dev/null || true
  kill "${SERVER_PID}"  2>/dev/null || true
  kill "${UNCLUTTER_PID:-0}" 2>/dev/null || true
  echo "  [stop]   Done."
}
trap cleanup EXIT INT TERM
wait "${BROWSER_PID}"
