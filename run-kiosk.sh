#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  OneID — Kiosk Launcher  (Raspberry Pi 4)
#  Usage:  ./run-kiosk.sh [MACBOOK_IP]
#
#  Works on both X11 and Wayland (Raspberry Pi OS Bookworm default).
#  Run from a terminal on the RPi desktop, OR set up autostart with:
#    ./setup-autostart.sh YOUR_MACBOOK_IP
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

# ── Detect display server: Wayland or X11 ────────────────────────────────────
DISPLAY_MODE="unknown"

# Wayland: check for a wayland socket in XDG_RUNTIME_DIR
XDG_RT="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -S "${XDG_RT}/wayland-0" ]; then
  DISPLAY_MODE="wayland"
  export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
  export XDG_RUNTIME_DIR="$XDG_RT"
  export MOZ_ENABLE_WAYLAND=1          # tell Firefox to use Wayland natively
  export GDK_BACKEND=wayland
  unset DISPLAY                        # don't confuse apps with stale DISPLAY
  echo "  [disp]  Mode=Wayland  WAYLAND_DISPLAY=${WAYLAND_DISPLAY}"
  echo "  [disp]  XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR}"

elif [ -n "${DISPLAY}" ] || [ -e "/tmp/.X11-unix/X0" ]; then
  DISPLAY_MODE="x11"
  export DISPLAY="${DISPLAY:-:0}"
  # Find Xauthority
  for xa in \
    "$HOME/.Xauthority" \
    "/home/oneid/.Xauthority" \
    "/home/pi/.Xauthority" \
    "/var/run/lightdm/root/:0" \
    "/run/user/1000/gdm/Xauthority"; do
    if [ -f "$xa" ]; then
      export XAUTHORITY="$xa"
      break
    fi
  done
  echo "  [disp]  Mode=X11  DISPLAY=${DISPLAY}  XAUTHORITY=${XAUTHORITY:-unset}"

else
  echo ""
  echo "  ────────────────────────────────────────────────────────"
  echo "  [ERROR] No display server found (tried Wayland + X11)."
  echo ""
  echo "  This script must run from a terminal on the RPi desktop."
  echo "  SSH sessions cannot launch GUI apps."
  echo ""
  echo "  Fix options:"
  echo "  1) Open a terminal on the RPi screen and re-run this script."
  echo "  2) Set up autostart (runs automatically on desktop boot):"
  echo "       ./setup-autostart.sh ${MACBOOK_IP}"
  echo "  ────────────────────────────────────────────────────────"
  echo ""
  exit 1
fi

# ── Kill old instances ────────────────────────────────────────────────────────
pkill -f "firefox.*kiosk"       2>/dev/null || true
pkill -f "chromium.*--kiosk"    2>/dev/null || true
sleep 1

# ── Screensaver / blanking off ────────────────────────────────────────────────
if [ "$DISPLAY_MODE" = "x11" ]; then
  xset s off     2>/dev/null || true
  xset s noblank 2>/dev/null || true
  xset -dpms     2>/dev/null || true
fi

# ── Hide cursor ───────────────────────────────────────────────────────────────
UNCLUTTER_PID=""
if command -v unclutter &>/dev/null && [ "$DISPLAY_MODE" = "x11" ]; then
  unclutter -idle 0.5 -root &
  UNCLUTTER_PID=$!
fi

# ── Start Vite ────────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
echo "  [vite]  Starting dev server on port ${PORT}..."
npm run dev -- --port "${PORT}" --host &
VITE_PID=$!

# ── Wait for Vite ─────────────────────────────────────────────────────────────
echo "  [wait]  Waiting for Vite to be ready..."
MAX_WAIT=120
ELAPSED=0
until curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "  [error] Timeout waiting for Vite."
    kill "$VITE_PID" 2>/dev/null || true
    exit 1
  fi
  printf "  [wait]  %ds...\r" "$ELAPSED"
done
echo "  [vite]  Ready ✓                    "
echo ""

# ── Find browser ──────────────────────────────────────────────────────────────
BROWSER_BIN=""
BROWSER_TYPE=""
for candidate in firefox-esr firefox; do
  if command -v "$candidate" &>/dev/null; then
    BROWSER_BIN="$candidate"; BROWSER_TYPE="firefox"; break
  fi
done
if [ -z "$BROWSER_BIN" ]; then
  for candidate in chromium-browser chromium google-chrome; do
    if command -v "$candidate" &>/dev/null; then
      BROWSER_BIN="$candidate"; BROWSER_TYPE="chromium"; break
    fi
  done
fi

echo "  [browser] Using: ${BROWSER_BIN:-NONE (not found)}"

if [ -z "$BROWSER_BIN" ]; then
  echo "  [error] No browser. Run: sudo apt install firefox-esr"
  kill "$VITE_PID" 2>/dev/null || true
  exit 1
fi

# ── Launch kiosk ──────────────────────────────────────────────────────────────
KIOSK_PROFILE="/tmp/oneid-kiosk-profile"
rm -rf "$KIOSK_PROFILE"
mkdir -p "$KIOSK_PROFILE"

echo "  [kiosk] Launching ${BROWSER_BIN} --kiosk (${DISPLAY_MODE})..."

if [ "$BROWSER_TYPE" = "firefox" ]; then
  "$BROWSER_BIN" \
    --kiosk \
    --no-remote \
    --new-instance \
    --profile "$KIOSK_PROFILE" \
    "$KIOSK_URL" &
else
  "$BROWSER_BIN" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --incognito \
    "$KIOSK_URL" &
fi
BROWSER_PID=$!
echo "  [kiosk] PID=${BROWSER_PID} — press Ctrl+C to stop."

# ── Shutdown ──────────────────────────────────────────────────────────────────
cleanup() {
  echo ""; echo "  [stop] Shutting down..."
  kill "$BROWSER_PID" 2>/dev/null || true
  kill "$VITE_PID"    2>/dev/null || true
  [ -n "$UNCLUTTER_PID" ] && kill "$UNCLUTTER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait "$VITE_PID"
