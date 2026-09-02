#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  OneID — Kiosk Launcher  (Raspberry Pi 4)
#  Usage:  ./run-kiosk.sh [MACBOOK_IP]
# ─────────────────────────────────────────────────────────────────────────────

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

# ── Detect X display + authority ─────────────────────────────────────────────
# When running via SSH, DISPLAY is unset. Force :0 (RPi physical screen).
export DISPLAY="${DISPLAY:-:0}"

# Auto-detect the logged-in desktop user and their .Xauthority
DESKTOP_USER=$(who | grep "(:0)" | awk '{print $1}' | head -1)
[ -z "$DESKTOP_USER" ] && DESKTOP_USER=$(who | awk '{print $1}' | head -1)
[ -z "$DESKTOP_USER" ] && DESKTOP_USER="$(logname 2>/dev/null || echo oneid)"

echo "  [disp]  DISPLAY=${DISPLAY}  desktop_user=${DESKTOP_USER}"

# Find Xauthority
for xa in \
  "/home/${DESKTOP_USER}/.Xauthority" \
  "$HOME/.Xauthority" \
  "/run/user/1000/gdm/Xauthority" \
  "/var/run/lightdm/root/:0"; do
  if [ -f "$xa" ]; then
    export XAUTHORITY="$xa"
    echo "  [disp]  XAUTHORITY=${XAUTHORITY}"
    break
  fi
done

# Quick X connectivity test
if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  echo ""
  echo "  [ERROR] Cannot connect to X display ${DISPLAY}."
  echo "          Make sure the RPi desktop is running (not console-only)."
  echo "          Run this script from a terminal INSIDE the desktop, not SSH."
  echo ""
  echo "  Alternatively, open a terminal on the RPi desktop and run:"
  echo "    DISPLAY=:0 firefox-esr --kiosk ${KIOSK_URL}"
  echo ""
  exit 1
fi
echo "  [disp]  X display OK ✓"

# ── Kill old kiosk instances ──────────────────────────────────────────────────
pkill -f "firefox.*kiosk"         2>/dev/null || true
pkill -f "chromium.*--kiosk"      2>/dev/null || true

# ── Disable screensaver + blanking ───────────────────────────────────────────
DISPLAY="$DISPLAY" xset s off    2>/dev/null || true
DISPLAY="$DISPLAY" xset s noblank 2>/dev/null || true
DISPLAY="$DISPLAY" xset -dpms    2>/dev/null || true

# ── Hide cursor ───────────────────────────────────────────────────────────────
UNCLUTTER_PID=""
if command -v unclutter &>/dev/null; then
  DISPLAY="$DISPLAY" unclutter -idle 0.5 -root &
  UNCLUTTER_PID=$!
fi

# ── Start Vite ────────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
echo "  [vite]  Starting dev server on port ${PORT}..."
npm run dev -- --port "${PORT}" --host &
VITE_PID=$!

# ── Wait for Vite ─────────────────────────────────────────────────────────────
echo "  [wait]  Waiting for Vite..."
MAX_WAIT=120
ELAPSED=0
until curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  [ "$ELAPSED" -ge "$MAX_WAIT" ] && echo "  [error] Timeout." && kill "$VITE_PID" && exit 1
  printf "  [wait]  %ds...\r" "$ELAPSED"
done
echo "  [vite]  Ready ✓                    "
echo ""

# ── Pick browser ──────────────────────────────────────────────────────────────
BROWSER_BIN=""
BROWSER_TYPE=""
for candidate in firefox-esr firefox; do
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

echo "  [browser] Found: ${BROWSER_BIN:-NONE}"

if [ -z "$BROWSER_BIN" ]; then
  echo "  [error] No browser found. Install with: sudo apt install firefox-esr"
  kill "$VITE_PID" 2>/dev/null || true
  exit 1
fi

# ── Launch browser in kiosk ───────────────────────────────────────────────────
KIOSK_PROFILE="/tmp/oneid-ff-kiosk"
rm -rf "$KIOSK_PROFILE"
mkdir -p "$KIOSK_PROFILE"

echo "  [kiosk] Launching ${BROWSER_BIN} --kiosk on DISPLAY=${DISPLAY}..."

if [ "$BROWSER_TYPE" = "firefox" ]; then
  DISPLAY="$DISPLAY" XAUTHORITY="$XAUTHORITY" \
  "$BROWSER_BIN" \
    --kiosk \
    --no-remote \
    --new-instance \
    --profile "$KIOSK_PROFILE" \
    "$KIOSK_URL" &
else
  DISPLAY="$DISPLAY" XAUTHORITY="$XAUTHORITY" \
  "$BROWSER_BIN" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --incognito \
    "$KIOSK_URL" &
fi
BROWSER_PID=$!
echo "  [kiosk] PID=${BROWSER_PID} — press Ctrl+C to stop."

# ── Shutdown ──────────────────────────────────────────────────────────────────
cleanup() {
  echo ""; echo "  [stop]  Shutting down..."
  kill "$BROWSER_PID"   2>/dev/null || true
  kill "$VITE_PID"      2>/dev/null || true
  [ -n "$UNCLUTTER_PID" ] && kill "$UNCLUTTER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait "$VITE_PID"
