#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  OneID — Kiosk Launcher  (Raspberry Pi 4)
#
#  Usage:  ./run-kiosk.sh [MACBOOK_IP]
#
#  What it does:
#    1. Hides the mouse cursor + disables screensaver/DPMS
#    2. Starts the Vite dev server on port 5173
#    3. Polls HTTP until Vite is actually serving
#    4. Opens Firefox (preferred) or Chromium in true --kiosk fullscreen
#       at http://localhost:5173/kiosk  — no title bar, no address bar,
#       no taskbar, nothing.
#
#  Optional arg: IP of the MacBook running the Python InsightFace server.
#  Default: 192.168.1.100  →  ./run-kiosk.sh 192.168.1.42
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── X display target (critical when launching from SSH) ──────────────────────
# Without this, Firefox/Chromium don't know which screen to open on.
# :0 = the RPi's physical HDMI display.
export DISPLAY="${DISPLAY:-:0}"
# Try common Xauthority locations so xset/unclutter also work over SSH
XAUTH_CANDIDATES=(
  "$HOME/.Xauthority"
  "/home/pi/.Xauthority"
  "/home/oneid/.Xauthority"
  "/run/user/1000/gdm/Xauthority"
)
for xa in "${XAUTH_CANDIDATES[@]}"; do
  if [ -f "$xa" ]; then
    export XAUTHORITY="$xa"
    break
  fi
done

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

# ── Kill any leftover browser kiosk processes ─────────────────────────────────
pkill -f "firefox.*kiosk"           2>/dev/null || true
pkill -f "chromium.*--kiosk"        2>/dev/null || true
pkill -f "google-chrome.*--kiosk"   2>/dev/null || true

# ── Screensaver / DPMS / display blanking off ─────────────────────────────────
# (these are no-ops if not on X11, so safe to run always)
xset s off          2>/dev/null || true   # disable X screensaver
xset s noblank      2>/dev/null || true   # don't blank screen
xset -dpms          2>/dev/null || true   # disable power-saving monitor off

# ── Hide mouse cursor (install unclutter if available) ───────────────────────
if command -v unclutter &>/dev/null; then
  unclutter -idle 0.1 -root &
  UNCLUTTER_PID=$!
else
  UNCLUTTER_PID=""
  echo "  [info]  Install 'unclutter' to hide the cursor: sudo apt install unclutter"
fi

# ── 1. Start Vite dev server ──────────────────────────────────────────────────
cd "$SCRIPT_DIR"
echo "  [vite]  Starting dev server on port ${PORT}..."
npm run dev -- --port "${PORT}" --host &
VITE_PID=$!

# ── 2. Wait for Vite to be ready ─────────────────────────────────────────────
echo "  [wait]  Waiting for Vite to become ready..."
MAX_WAIT=120
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
echo ""

# ── 3. Pick browser: Firefox first, then Chromium ────────────────────────────
BROWSER_BIN=""
BROWSER_TYPE=""

for candidate in firefox firefox-esr; do
  if command -v "$candidate" &>/dev/null; then
    BROWSER_BIN="$candidate"
    BROWSER_TYPE="firefox"
    break
  fi
done

if [ -z "$BROWSER_BIN" ]; then
  for candidate in chromium-browser chromium google-chrome; do
    if command -v "$candidate" &>/dev/null; then
      BROWSER_BIN="$candidate"
      BROWSER_TYPE="chromium"
      break
    fi
  done
fi

if [ -z "$BROWSER_BIN" ]; then
  echo "  [error] No browser found."
  echo "          Install Firefox:  sudo apt install firefox-esr"
  kill "$VITE_PID" 2>/dev/null || true
  exit 1
fi

echo "  [kiosk] Launching ${BROWSER_BIN} (${BROWSER_TYPE}) in fullscreen kiosk..."

BROWSER_PID=""

if [ "$BROWSER_TYPE" = "firefox" ]; then
  # Firefox kiosk mode (available since Firefox 71)
  # --kiosk          → fullscreen, no chrome, no ESC exit
  # --no-remote      → don't reuse existing Firefox instance
  # --new-instance   → force a fresh profile/process
  # Create a throwaway profile so Firefox doesn't show first-run dialogs
  KIOSK_PROFILE_DIR="/tmp/oneid-kiosk-profile"
  rm -rf "$KIOSK_PROFILE_DIR"
  "$BROWSER_BIN" --createProfile "oneid-kiosk $KIOSK_PROFILE_DIR" 2>/dev/null || true

  "$BROWSER_BIN" \
    --kiosk \
    --no-remote \
    --new-instance \
    --profile "$KIOSK_PROFILE_DIR" \
    "$KIOSK_URL" &
  BROWSER_PID=$!

else
  # Chromium fallback
  "$BROWSER_BIN" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --check-for-update-interval=31536000 \
    --incognito \
    "$KIOSK_URL" &
  BROWSER_PID=$!
fi

echo "  [kiosk] ${BROWSER_BIN} PID ${BROWSER_PID}"
echo "  [kiosk] Press Ctrl+C to stop everything."
echo ""

# ── Graceful shutdown ─────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "  [stop]  Shutting down..."
  [ -n "$BROWSER_PID"   ] && kill "$BROWSER_PID"   2>/dev/null || true
  [ -n "$VITE_PID"      ] && kill "$VITE_PID"      2>/dev/null || true
  [ -n "$UNCLUTTER_PID" ] && kill "$UNCLUTTER_PID" 2>/dev/null || true
  echo "  [stop]  Done."
}
trap cleanup EXIT INT TERM

wait "$VITE_PID"
