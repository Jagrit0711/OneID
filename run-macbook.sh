#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  OneID — MacBook Launcher
#
#  Usage:  ./run-macbook.sh
#
#  What it does:
#    1. Starts the Python InsightFace server (run-server.sh) in background
#    2. Starts the Vite dev server on port 5173
#    3. Waits for Vite to be ready
#    4. Opens Chrome with two tabs: /official and /consumer
#
#  All three processes share this terminal. Ctrl+C stops everything.
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=5173

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   OneID  ·  MacBook Launcher (Official + Consumer)   ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Start Python InsightFace server ───────────────────────────────────────
echo "  [python] Starting InsightFace server on port 8000..."
"$SCRIPT_DIR/run-server.sh" &
PYTHON_PID=$!
echo "  [python] PID ${PYTHON_PID}"

# Give the Python server a moment to initialise the model
sleep 3

# ── 2. Start Vite ─────────────────────────────────────────────────────────────
echo "  [vite]   Starting dev server on port ${PORT}..."
cd "$SCRIPT_DIR"
npm run dev -- --port "${PORT}" --host &
VITE_PID=$!
echo "  [vite]   PID ${VITE_PID}"

# ── 3. Wait for Vite ──────────────────────────────────────────────────────────
echo "  [wait]   Waiting for Vite to become ready..."
MAX_WAIT=90
ELAPSED=0
until curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "  [error]  Vite did not start within ${MAX_WAIT}s — aborting."
    kill "$VITE_PID"   2>/dev/null || true
    kill "$PYTHON_PID" 2>/dev/null || true
    exit 1
  fi
  printf "  [wait]   %ds...\r" "$ELAPSED"
done
echo "  [vite]   Ready ✓                    "
echo ""

# ── 4. Open Chrome with both portals ──────────────────────────────────────────
OFFICIAL_URL="http://localhost:${PORT}/official"
CONSUMER_URL="http://localhost:${PORT}/consumer"

echo "  [chrome] Opening portals..."
echo "           Official  →  ${OFFICIAL_URL}"
echo "           Consumer  →  ${CONSUMER_URL}"
echo ""

# macOS: open Chrome with multiple URLs (each becomes a new tab in the same window)
if [[ "$OSTYPE" == "darwin"* ]]; then
  open -a "Google Chrome" "$OFFICIAL_URL" "$CONSUMER_URL"
else
  # Linux fallback
  CHROME_BIN=""
  for candidate in google-chrome google-chrome-stable chromium-browser chromium; do
    if command -v "$candidate" &>/dev/null; then
      CHROME_BIN="$candidate"
      break
    fi
  done
  if [ -n "$CHROME_BIN" ]; then
    "$CHROME_BIN" "$OFFICIAL_URL" "$CONSUMER_URL" &
  else
    echo "  [warn]  Could not detect Chrome. Open manually: ${OFFICIAL_URL}"
  fi
fi

echo "  Press Ctrl+C to stop all services."
echo ""

# ── Graceful shutdown ─────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "  [stop]  Shutting down all services..."
  kill "$VITE_PID"   2>/dev/null || true
  kill "$PYTHON_PID" 2>/dev/null || true
  echo "  [stop]  Done."
}
trap cleanup EXIT INT TERM

wait "$VITE_PID"
