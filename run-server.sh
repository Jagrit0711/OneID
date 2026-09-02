#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OneID — InsightFace ArcFace Server  (one-click launcher)
#
# Usage:  ./run-server.sh
#
# What it does:
#   1. Locates the virtual-environment inside server/venv
#   2. Installs / upgrades any missing packages from requirements.txt
#   3. Starts the FastAPI server on http://localhost:8000
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Resolve script location so it works from any working directory ────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
VENV_DIR="$SERVER_DIR/venv"
PYTHON="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   OneID  ·  InsightFace ArcFace Server       ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Check that the venv exists ─────────────────────────────────────────────
if [ ! -f "$PYTHON" ]; then
  echo "  [setup] Virtual-environment not found — creating one..."
  python3 -m venv "$VENV_DIR"
  echo "  [setup] venv created at $VENV_DIR"
fi

# ── 2. Install / upgrade requirements ─────────────────────────────────────────
echo "  [deps]  Checking requirements..."
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet -r "$SERVER_DIR/requirements.txt"
echo "  [deps]  All packages ready ✓"

# ── 3. Start the server ────────────────────────────────────────────────────────
# Detect LAN IP so user knows what to pass to run-kiosk.sh on the RPi
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")

echo ""
echo "  [server] Starting on  http://0.0.0.0:8000"
echo "  [server] LAN address  http://${LAN_IP}:8000"
echo "  [server] ──────────────────────────────────────────────"
echo "  [server] Pass this IP to the RPi kiosk launcher:"
echo "           ./run-kiosk.sh ${LAN_IP}"
echo "  [server] ──────────────────────────────────────────────"
echo "  [server] Press  Ctrl+C  to stop"
echo ""

cd "$SERVER_DIR"
"$PYTHON" main.py
