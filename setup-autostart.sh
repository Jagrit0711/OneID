#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  OneID — Autostart Setup  (run ONCE on the RPi desktop terminal)
#
#  Usage:  ./setup-autostart.sh [MACBOOK_IP]
#
#  After this runs, just reboot the RPi — the kiosk opens automatically.
#  No SSH needed ever again.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACBOOK_IP="${1:-192.168.1.100}"
KIOSK_CMD="bash $SCRIPT_DIR/run-kiosk.sh $MACBOOK_IP"

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   OneID  ·  Autostart Setup  (Raspberry Pi 4)       ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""
echo "  MacBook IP  →  ${MACBOOK_IP}"
echo "  Script      →  ${KIOSK_CMD}"
echo ""

# ── 1. Install firefox-esr if missing ────────────────────────────────────────
if ! command -v firefox-esr &>/dev/null && ! command -v firefox &>/dev/null; then
  echo "  [deps]  Installing firefox-esr..."
  sudo apt-get install -y firefox-esr
  echo "  [deps]  firefox-esr installed ✓"
else
  echo "  [deps]  Browser found: $(command -v firefox-esr || command -v firefox) ✓"
fi

# ── 2. Install unclutter (cursor hider) ──────────────────────────────────────
if ! command -v unclutter &>/dev/null; then
  echo "  [deps]  Installing unclutter..."
  sudo apt-get install -y unclutter
fi

# ── 3. Detect session type and install autostart ──────────────────────────────
XDG_RT="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

if [ -S "${XDG_RT}/wayland-0" ] || [ "$XDG_SESSION_TYPE" = "wayland" ]; then
  echo "  [mode]  Wayland detected — using wayfire/labwc autostart"
  SESSION_MODE="wayland"
else
  echo "  [mode]  X11 detected — using LXDE autostart"
  SESSION_MODE="x11"
fi

# ── LXDE autostart (X11) ──────────────────────────────────────────────────────
if [ "$SESSION_MODE" = "x11" ]; then
  AUTOSTART_DIR="$HOME/.config/lxsession/LXDE-pi"
  mkdir -p "$AUTOSTART_DIR"
  AUTOSTART_FILE="$AUTOSTART_DIR/autostart"

  # Remove any old OneID entry
  if [ -f "$AUTOSTART_FILE" ]; then
    grep -v "run-kiosk" "$AUTOSTART_FILE" > /tmp/_as_tmp || true
    mv /tmp/_as_tmp "$AUTOSTART_FILE"
  fi

  # Add new entry (@ prefix = restart on crash)
  echo "@$KIOSK_CMD" >> "$AUTOSTART_FILE"
  echo "  [autostart] Written to ${AUTOSTART_FILE}"
  cat "$AUTOSTART_FILE"
fi

# ── Wayfire autostart (Wayland / RPi OS Bookworm) ────────────────────────────
if [ "$SESSION_MODE" = "wayland" ]; then
  WAYFIRE_INI="$HOME/.config/wayfire.ini"

  if [ ! -f "$WAYFIRE_INI" ]; then
    # Copy system default if exists
    cp /etc/wayfire/template.ini "$WAYFIRE_INI" 2>/dev/null || touch "$WAYFIRE_INI"
  fi

  # Remove old OneID autostart line
  grep -v "run-kiosk" "$WAYFIRE_INI" > /tmp/_wf_tmp || true
  mv /tmp/_wf_tmp "$WAYFIRE_INI"

  # Add [autostart] section entry
  if grep -q "^\[autostart\]" "$WAYFIRE_INI"; then
    # Insert after [autostart] header
    sed -i "/^\[autostart\]/a oneid = $KIOSK_CMD" "$WAYFIRE_INI"
  else
    printf "\n[autostart]\noneid = %s\n" "$KIOSK_CMD" >> "$WAYFIRE_INI"
  fi

  echo "  [autostart] Written to ${WAYFIRE_INI}"
fi

# ── 4. Disable screensaver + auto-login (raspi-config) ───────────────────────
# Make sure RPi boots straight to desktop without asking for password
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null || true

echo ""
echo "  ──────────────────────────────────────────────────────"
echo "  ✓  Autostart installed."
echo "     Reboot the RPi — the kiosk will open automatically."
echo ""
echo "     sudo reboot"
echo "  ──────────────────────────────────────────────────────"
echo ""
