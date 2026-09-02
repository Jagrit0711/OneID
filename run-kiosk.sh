#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  OneID — Kiosk Launcher  (Raspberry Pi 4 + TFT/HDMI screen)
#  Usage:  ./run-kiosk.sh [MACBOOK_IP]
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=5173
KIOSK_URL="http://localhost:${PORT}/kiosk"
MACBOOK_IP="${1:-192.168.1.100}"
LOG="/tmp/oneid-kiosk.log"

export VITE_FACE_API_URL="http://${MACBOOK_IP}:8000"

# Always log — even if script crashes
exec > >(tee -a "$LOG") 2>&1

echo ""
echo "========================================================"
echo "  OneID Kiosk  —  $(date)"
echo "========================================================"
echo "  InsightFace API  →  ${VITE_FACE_API_URL}"
echo "  Kiosk URL        →  ${KIOSK_URL}"
echo ""

# ── Display setup (X11 on HDMI + fbcp to TFT) ────────────────────────────────
export DISPLAY="${DISPLAY:-:0}"

# Find Xauthority
for xa in \
  "$HOME/.Xauthority" \
  "/home/oneid/.Xauthority" \
  "/home/pi/.Xauthority" \
  "/var/run/lightdm/root/:0"; do
  [ -f "$xa" ] && export XAUTHORITY="$xa" && break
done

echo "  [disp]  DISPLAY=${DISPLAY}  XAUTHORITY=${XAUTHORITY:-unset}"

# Disable screensaver / blanking
xset s off     2>/dev/null || true
xset s noblank 2>/dev/null || true
xset -dpms     2>/dev/null || true

# Hide cursor
command -v unclutter &>/dev/null && unclutter -idle 0.5 -root &

# ── Kill old instances ────────────────────────────────────────────────────────
pkill -f "firefox.*kiosk"    2>/dev/null || true
pkill -f "chromium.*--kiosk" 2>/dev/null || true
sleep 1

# ── Start Vite ────────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
echo "  [vite]  Starting on port ${PORT}..."
npm run dev -- --port "${PORT}" --host &
VITE_PID=$!

# ── Wait for Vite ─────────────────────────────────────────────────────────────
echo "  [wait]  Waiting for Vite..."
ELAPSED=0
until curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo "  [wait]  ${ELAPSED}s..."
  [ "$ELAPSED" -ge 120 ] && echo "  [error] Timeout." && kill "$VITE_PID" 2>/dev/null && exit 1
done
echo "  [vite]  Ready ✓"
echo ""

# ── Find browser ──────────────────────────────────────────────────────────────
BROWSER_BIN=""
for candidate in firefox-esr firefox chromium-browser chromium; do
  command -v "$candidate" &>/dev/null && BROWSER_BIN="$candidate" && break
done

echo "  [browser] Using: ${BROWSER_BIN:-NOT FOUND}"
[ -z "$BROWSER_BIN" ] && echo "  [error] No browser! Run: sudo apt install firefox-esr" && kill "$VITE_PID" 2>/dev/null && exit 1

# ── Launch Firefox in kiosk ───────────────────────────────────────────────────
# --disable-gpu          : required for TFT/fbcp framebuffer setups on RPi
# LIBGL_ALWAYS_SOFTWARE  : use software renderer (no GPU on TFT)
# --kiosk                : fullscreen, no chrome
KIOSK_PROFILE="/tmp/oneid-ff-profile"
rm -rf "$KIOSK_PROFILE" && mkdir -p "$KIOSK_PROFILE"

echo "  [kiosk] Launching ${BROWSER_BIN} --kiosk on DISPLAY=${DISPLAY}..."

if [[ "$BROWSER_BIN" == *firefox* ]]; then
  LIBGL_ALWAYS_SOFTWARE=1 \
  MOZ_DISABLE_COMPOSITION=1 \
  DISPLAY="$DISPLAY" \
  "$BROWSER_BIN" \
    --kiosk \
    --no-remote \
    --new-instance \
    --profile "$KIOSK_PROFILE" \
    --disable-gpu \
    "$KIOSK_URL" &
else
  DISPLAY="$DISPLAY" \
  "$BROWSER_BIN" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-gpu \
    --disable-software-rasterizer \
    --incognito \
    "$KIOSK_URL" &
fi

BROWSER_PID=$!
echo "  [kiosk] PID=${BROWSER_PID} — Ctrl+C to stop"

cleanup() {
  echo "[stop] Shutting down..."
  kill "$BROWSER_PID" 2>/dev/null || true
  kill "$VITE_PID"    2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait "$VITE_PID"
