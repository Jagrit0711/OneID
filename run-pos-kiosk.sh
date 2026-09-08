#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  OneID — POS Kiosk Launcher  (Jetson Nano 4GB)
#  Zero npm/Node.js required at runtime.
#  FastAPI (Python) serves BOTH the AI API and the React frontend on :8000.
#
#  Usage:
#    ./run-pos-kiosk.sh              # /kiosk   (Officer terminal)
#    ./run-pos-kiosk.sh --consumer   # /consumer (Citizen self-service)
#    ./run-pos-kiosk.sh --admin      # /super    (Admin dashboard)
#    ./run-pos-kiosk.sh --home       # /         (Portal selector)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Robust script directory resolution ────────────────────────────────────────
# Works when called as: ./run-pos-kiosk.sh, bash run-pos-kiosk.sh,
# /full/path/run-pos-kiosk.sh, or via LXDE/XDG autostart.
_resolve_dir() {
  local src="${BASH_SOURCE[0]:-$0}"
  # Resolve symlinks
  while [ -L "$src" ]; do src="$(readlink "$src")"; done
  # If relative, make absolute using pwd
  case "$src" in
    /*) echo "$(dirname "$src")" ;;
    *)  echo "$(cd "$(dirname "$src")" && pwd)" ;;
  esac
}
SCRIPT_DIR="$(_resolve_dir)"

# ── Sanity check: make sure we resolved a real directory ──────────────────────
if [ ! -f "${SCRIPT_DIR}/server/main.py" ]; then
  echo "[FAIL] Cannot find server/main.py relative to SCRIPT_DIR=${SCRIPT_DIR}"
  echo "       Try running from the project root: cd /path/to/OneID && ./run-pos-kiosk.sh"
  exit 1
fi

SERVER_PORT=8000
LOG="/tmp/oneid-pos-kiosk.log"
SERVER_DIR="${SCRIPT_DIR}/server"
VENV_DIR="${SERVER_DIR}/venv"
PYTHON="${VENV_DIR}/bin/python"
PIP="${VENV_DIR}/bin/pip"

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
echo "  Project dir →  ${SCRIPT_DIR}"
echo "  Kiosk URL   →  ${KIOSK_URL}"
echo ""

# ── Auto-create Python venv if missing ────────────────────────────────────────
if [ ! -f "$PYTHON" ]; then
  echo "  [venv]   Python venv not found at ${VENV_DIR}"
  echo "  [venv]   Creating venv and installing dependencies..."
  python3 -m venv "$VENV_DIR"
  "$PIP" install --quiet --upgrade pip
  "$PIP" install --quiet \
    "fastapi>=0.100.0" "uvicorn>=0.22.0" \
    "insightface>=0.7.3" \
    "opencv-python-headless>=4.8.0" "numpy>=1.24.0" \
    "pillow>=9.5.0" "python-multipart>=0.0.6" "aiofiles>=23.1.0"
  # Try GPU onnxruntime, fall back to CPU
  "$PIP" install --quiet onnxruntime-gpu 2>/dev/null || \
  "$PIP" install --quiet onnxruntime || \
  echo "  [warn]   onnxruntime install failed — face matching may be slow"
  echo "  [venv]   Venv created ✓"
fi
echo "  [check]  Python venv     ✓  ${PYTHON}"

# ── Check React build exists ──────────────────────────────────────────────────
if [ ! -d "${SCRIPT_DIR}/.output/public" ]; then
  echo ""
  echo "  [FAIL]   React build not found: ${SCRIPT_DIR}/.output/public"
  echo ""
  echo "  The .output/public/ folder must be built on your dev machine"
  echo "  (Mac/Linux with Node.js) and committed/copied to the Jetson."
  echo ""
  echo "  On your Mac, in the project folder:"
  echo "    npm run build"
  echo "    git add .output/public && git commit -m 'build' && git push"
  echo "  On Jetson:"
  echo "    git pull"
  echo ""
  exit 1
fi
echo "  [check]  React build     ✓  .output/public/"

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
pkill -f "main\.py"          2>/dev/null || true
sleep 1

# ── Start the OneID Python server (API + React SPA in one process) ─────────-─
echo "  [server] Starting OneID server (API + frontend) on :${SERVER_PORT}..."
cd "${SERVER_DIR}"
"$PYTHON" main.py &
SERVER_PID=$!
cd "${SCRIPT_DIR}"
echo "  [server] PID=${SERVER_PID}"

# ── Wait for server to be ready ───────────────────────────────────────────────
echo "  [wait]   Waiting for server..."
echo "           (InsightFace model loads in ~30s on first boot)"
ELAPSED=0
until curl -sf "http://localhost:${SERVER_PORT}/health" > /dev/null 2>&1; do
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  printf "  [wait]   %ds...\r" "$ELAPSED"
  if [ "$ELAPSED" -ge 180 ]; then
    echo ""
    echo "  [FAIL]   Server did not start after ${ELAPSED}s"
    echo "           Tail logs: tail -f /tmp/oneid-pos-kiosk.log"
    kill "${SERVER_PID}" 2>/dev/null || true
    exit 1
  fi
done
echo ""
echo "  [server] Ready ✓"

# ── Find Chromium ─────────────────────────────────────────────────────────────
CHROMIUM_BIN=""
for candidate in chromium-browser chromium google-chrome-stable google-chrome; do
  command -v "$candidate" &>/dev/null && CHROMIUM_BIN="$candidate" && break
done

if [ -z "$CHROMIUM_BIN" ]; then
  echo "  [FAIL]   Chromium not found!"
  echo "           Install: sudo apt install chromium-browser"
  kill "${SERVER_PID}" 2>/dev/null || true
  exit 1
fi
echo "  [browser] ${CHROMIUM_BIN}"

PROFILE_DIR="/tmp/oneid-chromium-profile"
rm -rf "$PROFILE_DIR" && mkdir -p "$PROFILE_DIR"

echo ""
echo "  Launching → ${KIOSK_URL}"
echo "  Ctrl+C to stop"
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
  echo "  [stop]   Shutting down..."
  kill "${BROWSER_PID}" 2>/dev/null || true
  kill "${SERVER_PID}"  2>/dev/null || true
  kill "${UNCLUTTER_PID:-0}" 2>/dev/null || true
  echo "  [stop]   Done."
}
trap cleanup EXIT INT TERM
wait "${BROWSER_PID}"
