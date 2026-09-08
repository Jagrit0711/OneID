#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  OneID — POS Kiosk Launcher  (Jetson Nano 4GB)
#  ─────────────────────────────────────────────────────────────────────────────
#  Starts the full OneID stack — AI backend + React frontend + Chromium kiosk.
#
#  Usage:
#    ./run-pos-kiosk.sh              # boots to /kiosk  (Officer terminal)
#    ./run-pos-kiosk.sh --consumer   # boots to /consumer (Citizen self-service)
#    ./run-pos-kiosk.sh --admin      # boots to /super   (Admin dashboard)
#    ./run-pos-kiosk.sh --home       # boots to /        (Portal selector)
#
#  Requirements (installed by jetson-setup.sh):
#    - Node.js 20+, npm, npx serve
#    - Python venv in server/venv with InsightFace
#    - Chromium (chromium-browser)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVE_PORT=8080
AI_PORT=8000
LOG="/tmp/oneid-pos-kiosk.log"

# ── Parse --flag argument ─────────────────────────────────────────────────────
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

KIOSK_URL="http://localhost:${SERVE_PORT}${TARGET_PATH}"

exec > >(tee -a "$LOG") 2>&1

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  OneID POS Kiosk  ·  Jetson Nano 4GB  ·  $(date)"
echo "════════════════════════════════════════════════════════════"
echo "  Target URL  →  ${KIOSK_URL}"
echo "  AI Backend  →  http://localhost:${AI_PORT}/health"
echo ""

# ── Display / X11 ─────────────────────────────────────────────────────────────
export DISPLAY="${DISPLAY:-:0}"
for xa in "$HOME/.Xauthority" "/home/oneid/.Xauthority" "/var/run/lightdm/root/:0"; do
  [ -f "$xa" ] && export XAUTHORITY="$xa" && break
done
echo "  [disp]   DISPLAY=${DISPLAY}"

# Disable screensaver / blanking
xset s off 2>/dev/null || true
xset s noblank 2>/dev/null || true
xset -dpms 2>/dev/null || true

# Hide cursor after 1s idle
command -v unclutter &>/dev/null && unclutter -idle 1 -root & UNCLUTTER_PID=${!:-0}

# ── Kill stale processes ──────────────────────────────────────────────────────
pkill -f "chromium.*--kiosk"  2>/dev/null || true
pkill -f "npx.*serve"         2>/dev/null || true
pkill -f "uvicorn.*main"      2>/dev/null || true
sleep 1

# ── Ensure production build exists ────────────────────────────────────────────
cd "$SCRIPT_DIR"
if [ ! -d ".output/public" ]; then
  echo "  [build]  Production bundle not found — building now (takes ~2 min)..."
  npm run build
  echo "  [build]  Build complete ✓"
else
  echo "  [build]  Production bundle found ✓ (.output/public/)"
fi

# ── Start Python InsightFace AI backend ──────────────────────────────────────
SERVER_DIR="$SCRIPT_DIR/server"
PYTHON="$SERVER_DIR/venv/bin/python"

if [ ! -f "$PYTHON" ]; then
  echo "  [warn]   Python venv not found at $PYTHON"
  echo "           Run ./jetson-setup.sh first to install all dependencies."
else
  echo "  [ai]     Starting InsightFace ArcFace server..."
  cd "$SERVER_DIR"
  "$PYTHON" main.py &
  AI_PID=$!
  cd "$SCRIPT_DIR"
  echo "  [ai]     PID=${AI_PID}"
fi

# ── Start static React server ─────────────────────────────────────────────────
echo "  [serve]  Starting static server on port ${SERVE_PORT}..."
npx --yes serve .output/public --single --listen "${SERVE_PORT}" &
SERVE_PID=$!

# ── Wait for static server to be ready ────────────────────────────────────────
echo "  [wait]   Waiting for static server..."
ELAPSED=0
until curl -sf "http://localhost:${SERVE_PORT}" > /dev/null 2>&1; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  printf "  [wait]   %ds...\r" "$ELAPSED"
  if [ "$ELAPSED" -ge 90 ]; then
    echo ""
    echo "  [error]  Timeout waiting for static server — aborting"
    kill "${SERVE_PID}" 2>/dev/null || true
    kill "${AI_PID:-0}" 2>/dev/null || true
    exit 1
  fi
done
echo "  [serve]  Ready ✓ → http://localhost:${SERVE_PORT}"

# ── Wait for AI backend (non-fatal — MediaPipe fallback in browser) ───────────
echo "  [ai]     Waiting for InsightFace API..."
ELAPSED=0
until curl -sf "http://localhost:${AI_PORT}/health" > /dev/null 2>&1; do
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  printf "  [ai]     %ds...\r" "$ELAPSED"
  if [ "$ELAPSED" -ge 120 ]; then
    echo ""
    echo "  [warn]   AI backend not ready after ${ELAPSED}s — kiosk will start with MediaPipe CPU fallback"
    break
  fi
done
if curl -sf "http://localhost:${AI_PORT}/health" > /dev/null 2>&1; then
  HEALTH=$(curl -sf "http://localhost:${AI_PORT}/health" 2>/dev/null || echo "{}")
  echo "  [ai]     InsightFace ready ✓  ($(echo "$HEALTH" | grep -o '"model":"[^"]*"' | head -1))"
fi

# ── Find Chromium ─────────────────────────────────────────────────────────────
CHROMIUM_BIN=""
for candidate in chromium-browser chromium google-chrome-stable google-chrome; do
  command -v "$candidate" &>/dev/null && CHROMIUM_BIN="$candidate" && break
done

if [ -z "$CHROMIUM_BIN" ]; then
  echo "  [error]  Chromium not found!"
  echo "           Install with: sudo apt install chromium-browser"
  kill "${SERVE_PID}" 2>/dev/null || true
  kill "${AI_PID:-0}" 2>/dev/null || true
  exit 1
fi
echo "  [browser] Using: ${CHROMIUM_BIN}"

# ── Clean profile dir ─────────────────────────────────────────────────────────
PROFILE_DIR="/tmp/oneid-chromium-profile"
rm -rf "$PROFILE_DIR" && mkdir -p "$PROFILE_DIR"

echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  Launching kiosk → ${KIOSK_URL}"
echo "  Press Ctrl+C to stop everything"
echo "  ─────────────────────────────────────────────────────────"
echo ""

# ── Launch Chromium with Tegra GPU flags ──────────────────────────────────────
#  --enable-gpu-rasterization         Tegra GPU compositing
#  --enable-zero-copy                 DMA-BUF zero-copy for camera frames
#  --enable-native-gpu-memory-buffers Jetson shared memory GPU path
#  --ignore-gpu-blocklist             Jetson is on Chrome's denylist — override
#  --use-gl=egl                       EGL for Tegra driver compatibility
#  --in-process-gpu                   Less IPC overhead on 4GB RAM
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
  --allow-running-insecure-content \
  "$KIOSK_URL" &

BROWSER_PID=$!
echo "  [kiosk]  Chromium PID=${BROWSER_PID}"

# ── Cleanup on Ctrl+C / exit ─────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "  [stop]   Shutting down OneID POS Kiosk..."
  kill "$BROWSER_PID" 2>/dev/null || true
  kill "${SERVE_PID}"  2>/dev/null || true
  kill "${AI_PID:-0}"  2>/dev/null || true
  kill "${UNCLUTTER_PID:-0}" 2>/dev/null || true
  echo "  [stop]   All processes stopped."
}
trap cleanup EXIT INT TERM

wait "$BROWSER_PID"
