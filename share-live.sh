#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# OneID — Instant Live Public Sharing (HTTPS Tunnel for Mobile & Remote Testing)
#
# Generates an instant HTTPS URL reachable from ANY phone, tablet, or browser.
# Features:
#   - Real HTTPS (grants mobile camera & biometric permissions automatically)
#   - Zero router port-forwarding or IP configuration required
#   - Generates an instant QR code in your terminal to scan with phone camera
#   - Clean graceful shutdown with Ctrl+C
#
# Usage:
#   ./share-live.sh              # Share frontend on port 8080 (default)
#   ./share-live.sh --port 8000  # Share FastAPI server on port 8000
# ═══════════════════════════════════════════════════════════════════════════════

set -e

PORT="8080"
if [ "$1" = "--port" ] && [ -n "$2" ]; then
  PORT="$2"
fi

GREEN='\033[0;32m'
AMBER='\033[0;33m'
TEAL='\033[0;36m'
VIOLET='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

echo -e "\n${TEAL}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${TEAL}${BOLD}      OneID — Instant Live Public Tunnel for Mobile Testing       ${NC}"
echo -e "${TEAL}${BOLD}══════════════════════════════════════════════════════════════════${NC}\n"

# ── 1. Check if Cloudflare Tunnel or fallback is installed ────────────────────
CLOUDFLARED_BIN=""
if command -v cloudflared >/dev/null 2>&1; then
  CLOUDFLARED_BIN="$(command -v cloudflared)"
elif [ -x "/opt/homebrew/bin/cloudflared" ]; then
  CLOUDFLARED_BIN="/opt/homebrew/bin/cloudflared"
elif [ -x "/usr/local/bin/cloudflared" ]; then
  CLOUDFLARED_BIN="/usr/local/bin/cloudflared"
fi

if [ -z "$CLOUDFLARED_BIN" ]; then
  echo -e "${AMBER}⚠️  cloudflared is not installed.${NC}"
  echo -e "Installing via Homebrew... (or run: brew install cloudflared)"
  if command -v brew >/dev/null 2>&1; then
    brew install cloudflared
    CLOUDFLARED_BIN="$(command -v cloudflared)"
  else
    echo -e "${AMBER}Attempting fallback with npx localtunnel...${NC}"
  fi
fi

# ── 2. Check if local server is running on target port ────────────────────────
echo -e "${DIM}Checking local server on port ${PORT}...${NC}"
if ! lsof -i :${PORT} >/dev/null 2>&1; then
  echo -e "${AMBER}⚠️  Nothing is running on port ${PORT}.${NC}"
  if [ "$PORT" = "8080" ]; then
    echo -e "${TEAL}Starting Vite dev server in background...${NC}"
    npm run dev >/dev/null 2>&1 &
    DEV_PID=$!
    sleep 3
  else
    echo -e "Please start your server on port ${PORT} first and re-run this script."
    exit 1
  fi
else
  echo -e "${GREEN}✓ Local server is active on port ${PORT}${NC}"
fi

# ── 3. Start Cloudflare Quick Tunnel ───────────────────────────────────────────
LOG_FILE="/tmp/oneid_cloudflare_tunnel.log"
rm -f "$LOG_FILE"

echo -e "${TEAL}Starting secure HTTPS tunnel via Cloudflare...${NC}"
if [ -n "$CLOUDFLARED_BIN" ]; then
  "$CLOUDFLARED_BIN" tunnel --url "http://localhost:${PORT}" --no-autoupdate > "$LOG_FILE" 2>&1 &
  TUNNEL_PID=$!
else
  npx -y localtunnel --port "${PORT}" > "$LOG_FILE" 2>&1 &
  TUNNEL_PID=$!
fi

cleanup() {
  echo -e "\n${AMBER}Stopping live tunnel...${NC}"
  if [ -n "$TUNNEL_PID" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE"
  echo -e "${GREEN}✓ Tunnel closed.${NC}"
  exit 0
}
trap cleanup INT TERM EXIT

# Wait up to 15 seconds to parse the generated URL
TUNNEL_URL=""
for i in $(seq 1 30); do
  if [ -f "$LOG_FILE" ]; then
    TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]\+\.trycloudflare\.com' "$LOG_FILE" | head -1 || true)
    if [ -z "$TUNNEL_URL" ]; then
      TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]\+\.loca\.lt' "$LOG_FILE" | head -1 || true)
    fi
  fi
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 0.5
done

if [ -z "$TUNNEL_URL" ]; then
  echo -e "${AMBER}Could not extract URL automatically. Tunnel log:${NC}"
  cat "$LOG_FILE" | tail -10
  exit 1
fi

# ── 4. Output Live URLs and QR Code ───────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}🚀 YOUR KIOSK IS LIVE ON THE INTERNET!${NC}\n"
echo -e "  ${BOLD}Main Portal Selector:${NC}  ${TEAL}${BOLD}${TUNNEL_URL}${NC}"
echo -e "  ${BOLD}Officer Kiosk Terminal:${NC} ${AMBER}${BOLD}${TUNNEL_URL}/kiosk${NC}"
echo -e "  ${BOLD}Citizen Self-Service:${NC}   ${GREEN}${BOLD}${TUNNEL_URL}/consumer${NC}"
echo -e "  ${BOLD}Super Admin Dashboard:${NC}  ${VIOLET}${BOLD}${TUNNEL_URL}/super${NC}"
echo ""
echo -e "${DIM}Scan this QR Code with your iPhone or Android camera to open instantly:${NC}"
echo ""

# Render ASCII QR code in terminal
curl -s "qrenco.de/${TUNNEL_URL}" 2>/dev/null || echo -e "Open on phone: ${TUNNEL_URL}"

echo ""
echo -e "${GREEN}✓ Valid HTTPS active${NC} — Mobile camera & biometric scanning will work immediately."
echo -e "${DIM}Press Ctrl+C anytime to stop sharing.${NC}\n"

# Keep running until Ctrl+C
wait "$TUNNEL_PID"
