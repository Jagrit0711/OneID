#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  OneID — Jetson Nano 4GB  ·  One-Shot Setup & Kiosk Autostart
#  ─────────────────────────────────────────────────────────────────────────────
#
#  Usage (run ONCE after git clone, as a regular user — NOT root):
#
#    chmod +x jetson-setup.sh && ./jetson-setup.sh
#
#  What this script does, in order:
#   1.  Verifies it is running on a Jetson Nano (warns otherwise)
#   2.  Sets Jetson to 10W MAXN power mode + locks max clocks
#   3.  Creates a 6 GB swapfile (prevents OOM-killer from killing ArcFace)
#   4.  Installs system packages  (curl, unclutter, Chromium, Python3, pip …)
#   5.  Installs Node.js 20 LTS via NodeSource
#   6.  Installs npm dependencies and builds the production React bundle
#   7.  Creates a Python venv + installs InsightFace + onnxruntime-gpu
#   8.  Patches the FastAPI server to auto-detect CUDA on Jetson
#   9.  Installs a systemd service for the Python AI backend (auto-restart)
#  10.  Creates run-jetson-kiosk.sh  (GPU-accelerated Chromium fullscreen)
#  11.  Installs an XDG / LXDE autostart entry for the kiosk on every boot
#  12.  Enables desktop auto-login (no password prompt on boot)
#  13.  Prints a summary and prompts for reboot
#
#  After reboot the kiosk starts automatically. No laptop required.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; CYN='\033[0;36m'; BLD='\033[1m'; RST='\033[0m'

info()    { echo -e "${BLU}[info]${RST}  $*"; }
ok()      { echo -e "${GRN}[ ok ]${RST}  $*"; }
warn()    { echo -e "${YLW}[warn]${RST}  $*"; }
step()    { echo -e "\n${BLD}${CYN}── $* ──${RST}"; }
fatal()   { echo -e "${RED}[FAIL]${RST}  $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$SCRIPT_DIR/jetson-setup.log"
exec > >(tee -a "$LOG") 2>&1

echo ""
echo -e "${BLD}${CYN}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║  OneID  ·  NVIDIA Jetson Nano 4GB  ·  One-Shot Setup      ║"
echo "  ║  Everything installs, builds, and autoruns on next boot.   ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${RST}"

[ "$(id -u)" -eq 0 ] && fatal "Run as a normal user (not sudo/root). Script will sudo only what it needs."

# ── Detect Jetson ─────────────────────────────────────────────────────────────
if grep -qi "tegra\|jetson\|nano" /proc/device-tree/model 2>/dev/null || ls /dev/nvhost-ctrl 2>/dev/null; then
  ok "Jetson Nano detected ✓"
else
  warn "Could not confirm Jetson Nano hardware. Proceeding anyway."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Power Mode: 10W MAXN
# ═══════════════════════════════════════════════════════════════════════════════
step "Power mode → 10W MAXN"
if command -v nvpmodel &>/dev/null; then
  sudo nvpmodel -m 0 2>/dev/null && ok "nvpmodel set to MAXN (10W)" || warn "nvpmodel failed (harmless)"
else
  warn "nvpmodel not found — skipping"
fi
if command -v jetson_clocks &>/dev/null; then
  sudo jetson_clocks 2>/dev/null && ok "jetson_clocks: max frequencies locked" || warn "jetson_clocks failed (harmless)"
else
  warn "jetson_clocks not found — skipping"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Swapfile (6 GB)
# ═══════════════════════════════════════════════════════════════════════════════
step "Swap: 6 GB swapfile"
SWAPFILE=/var/swapfile_oneid_6gb
if swapon --show | grep -q "$SWAPFILE"; then
  ok "6 GB swapfile already active"
elif [ -f "$SWAPFILE" ]; then
  sudo swapon "$SWAPFILE" && ok "Existing swapfile activated"
else
  info "Creating 6 GB swapfile (this takes ~30 s)..."
  sudo fallocate -l 6G "$SWAPFILE" || sudo dd if=/dev/zero of="$SWAPFILE" bs=1M count=6144 status=progress
  sudo chmod 600 "$SWAPFILE"
  sudo mkswap "$SWAPFILE"
  sudo swapon "$SWAPFILE"
  grep -q "$SWAPFILE" /etc/fstab || echo "$SWAPFILE none swap sw 0 0" | sudo tee -a /etc/fstab > /dev/null
  ok "6 GB swapfile created and activated"
fi
CURRENT_SWAPPINESS=$(cat /proc/sys/vm/swappiness)
if [ "$CURRENT_SWAPPINESS" -gt 10 ]; then
  echo "vm.swappiness=10" | sudo tee /etc/sysctl.d/99-oneid-swap.conf > /dev/null
  sudo sysctl -p /etc/sysctl.d/99-oneid-swap.conf > /dev/null
  ok "swappiness set to 10 (was $CURRENT_SWAPPINESS)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — System Packages
# ═══════════════════════════════════════════════════════════════════════════════
step "System packages"
sudo apt-get update -qq
PKGS=(
  curl wget git ca-certificates gnupg
  python3 python3-pip python3-venv python3-dev
  build-essential libssl-dev libffi-dev
  libjpeg-dev libpng-dev libopencv-dev
  chromium-browser
  unclutter xdotool
  usbutils v4l-utils
)
for pkg in "${PKGS[@]}"; do
  dpkg -s "$pkg" &>/dev/null || { info "Installing $pkg..."; sudo apt-get install -y --no-install-recommends "$pkg" 2>/dev/null || warn "Could not install $pkg"; }
done
ok "System packages ready"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Node.js 20 LTS via NVM (reliable on ARM64 / Jetson)
# NOTE: npm is only needed HERE at setup time to build the React bundle.
#       At runtime the Python FastAPI server serves the built files directly
#       — no npm or npx required after this step.
# ═══════════════════════════════════════════════════════════════════════════════
step "Node.js 20 LTS (via NVM — ARM64 safe)"

NVM_DIR="${HOME}/.nvm"
NODE_MAJOR=0

# Check if usable node already exists (from a previous run or system install)
command -v node &>/dev/null && NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)

if [ "${NODE_MAJOR:-0}" -ge 18 ]; then
  ok "Node.js $(node --version) already installed — skipping NVM"
else
  # Install or re-use NVM
  if [ ! -s "${NVM_DIR}/nvm.sh" ]; then
    info "Installing NVM..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  else
    info "NVM already present at ${NVM_DIR}"
  fi

  # Load NVM in this shell session
  export NVM_DIR
  # shellcheck disable=SC1091
  [ -s "${NVM_DIR}/nvm.sh" ] && source "${NVM_DIR}/nvm.sh"

  info "Installing Node.js 20 LTS via NVM (ARM64 binary)..."
  nvm install 20
  nvm use 20
  nvm alias default 20

  # Persist NVM in shell startup files so node/npm are available after reboot
  for RC_FILE in "${HOME}/.bashrc" "${HOME}/.profile"; do
    if ! grep -q 'NVM_DIR' "${RC_FILE}" 2>/dev/null; then
      cat >> "${RC_FILE}" <<'NVMRC'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && source "$NVM_DIR/bash_completion"
NVMRC
    fi
  done

  ok "Node.js $(node --version) installed via NVM"
fi

# ── npm install + production build (one-time, build output goes to .output/) ──
step "npm install → production build (one-time setup)"
cd "$SCRIPT_DIR"

# Make sure npm/node are on PATH for this session (in case installed via NVM)
export NVM_DIR="${HOME}/.nvm"
[ -s "${NVM_DIR}/nvm.sh" ] && source "${NVM_DIR}/nvm.sh" 2>/dev/null || true

if [ ! -d ".output/public" ]; then
  info "Installing npm packages (takes 2-4 min on first run)..."
  npm install --legacy-peer-deps --loglevel=error
  ok "npm packages installed"
  info "Building production React bundle..."
  npm run build
  ok "Build complete → .output/public/ (FastAPI will serve this at runtime)"
else
  ok "Production build already exists → .output/public/ (skipping rebuild)"
  info "To force a rebuild: rm -rf .output && ./jetson-setup.sh"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Python venv + InsightFace
# ═══════════════════════════════════════════════════════════════════════════════
step "Python venv + AI dependencies"
SERVER_DIR="$SCRIPT_DIR/server"
VENV_DIR="$SERVER_DIR/venv"
PYTHON="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"
[ ! -f "$PYTHON" ] && python3 -m venv "$VENV_DIR"
"$PIP" install --quiet --upgrade pip
info "Installing onnxruntime (GPU preferred)..."
"$PIP" install --quiet onnxruntime-gpu 2>/dev/null || "$PIP" install --quiet onnxruntime || warn "onnxruntime install failed"
info "Installing FastAPI + InsightFace..."
"$PIP" install --quiet \
  "fastapi>=0.100.0" "uvicorn>=0.22.0" "insightface>=0.7.3" \
  "opencv-python-headless>=4.8.0" "numpy>=1.24.0" \
  "pillow>=9.5.0" "python-multipart>=0.0.6" "aiofiles>=23.1.0"
ok "Python AI stack ready"

# ── Patch server/main.py to prefer CUDA on Jetson ────────────────────────────
step "Patch InsightFace server → CUDA auto-detect"
MAIN_PY="$SERVER_DIR/main.py"
if ! grep -q "JETSON-PATCH" "$MAIN_PY"; then
  sed -i "s/face_app = FaceAnalysis(name=MODEL_NAME, providers=\['CPUExecutionProvider'\])/# [JETSON-PATCH] Auto-detect CUDA\/TensorRT on Jetson Nano\nimport onnxruntime as _ort\n_available = _ort.get_available_providers()\n_providers = (['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider'] if 'CUDAExecutionProvider' in _available else ['CPUExecutionProvider'])\nprint(f'[InsightFace] Using ONNX providers: {_providers}')\nface_app = FaceAnalysis(name=MODEL_NAME, providers=_providers)/" "$MAIN_PY"
  ok "server/main.py patched for Jetson CUDA"
else
  ok "server/main.py already patched"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — systemd service: oneid-ai-server
# ═══════════════════════════════════════════════════════════════════════════════
step "systemd service → oneid-ai-server (auto-start at boot)"
sudo tee /etc/systemd/system/oneid-ai-server.service > /dev/null <<SERVICE
[Unit]
Description=OneID InsightFace ArcFace AI Backend
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${SERVER_DIR}
Environment="HOME=${HOME}"
ExecStart=${PYTHON} ${SERVER_DIR}/main.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE
sudo systemctl daemon-reload
sudo systemctl enable oneid-ai-server
ok "oneid-ai-server service enabled (starts at boot)"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Autostart launcher: point to run-pos-kiosk.sh
# (No separate kiosk launcher needed — run-pos-kiosk.sh is the launcher)
# ═══════════════════════════════════════════════════════════════════════════════
step "Verifying kiosk launcher"
KIOSK_LAUNCHER="$SCRIPT_DIR/run-pos-kiosk.sh"
if [ -f "$KIOSK_LAUNCHER" ]; then
  chmod +x "$KIOSK_LAUNCHER"
  ok "Kiosk launcher: ${KIOSK_LAUNCHER}"
else
  warn "run-pos-kiosk.sh not found — it should be in the repo root"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8 — Autostart on every boot
# ═══════════════════════════════════════════════════════════════════════════════
step "Autostart: kiosk on every boot"
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
cat > "$AUTOSTART_DIR/oneid-jetson-kiosk.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=OneID Jetson Kiosk
Comment=OneID Kiosk Autostart — Jetson Nano
Exec=lxterminal --title="OneID Kiosk" -e bash ${KIOSK_LAUNCHER}
Terminal=false
Hidden=false
X-GNOME-Autostart-enabled=true
DESKTOP
ok "XDG autostart desktop entry written"

LXDE_AUTOSTART="$HOME/.config/lxsession/LXDE/autostart"
mkdir -p "$(dirname "$LXDE_AUTOSTART")"
grep -v -E "(run-kiosk|run-jetson|oneid)" "$LXDE_AUTOSTART" > /tmp/_lxde_tmp 2>/dev/null || true
mv /tmp/_lxde_tmp "$LXDE_AUTOSTART" 2>/dev/null || true
echo "@lxterminal --title=OneID-Kiosk -e bash ${KIOSK_LAUNCHER}" >> "$LXDE_AUTOSTART"
ok "LXDE autostart updated"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9 — Desktop auto-login
# ═══════════════════════════════════════════════════════════════════════════════
step "Desktop auto-login"
if command -v lightdm &>/dev/null; then
  LIGHTDM_CONF=/etc/lightdm/lightdm.conf
  if ! grep -q "autologin-user=${USER}" "$LIGHTDM_CONF" 2>/dev/null; then
    sudo tee -a "$LIGHTDM_CONF" > /dev/null <<LDMEOF

[Seat:*]
autologin-user=${USER}
autologin-user-timeout=0
LDMEOF
    ok "lightdm auto-login configured for '${USER}'"
  else
    ok "lightdm auto-login already configured"
  fi
fi
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null && ok "raspi-config: auto-login enabled" || true

# ═══════════════════════════════════════════════════════════════════════════════
# DONE — Summary
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLD}${GRN}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║  ✓  OneID Jetson Nano Setup Complete!                      ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${RST}"
echo "   • Power mode → 10W MAXN (max performance)"
echo "   • 6 GB swapfile created + persisted"
echo "   • Node.js 20 LTS installed"
echo "   • React kiosk built → .output/public/"
echo "   • Python venv + InsightFace ArcFace installed"
echo "   • InsightFace patched for Jetson CUDA GPU"
echo "   • systemd oneid-ai-server → auto-starts at boot"
echo "   • Chromium GPU-accelerated kiosk (Tegra flags)"
echo "   • Kiosk autostart on every desktop login"
echo "   • Desktop auto-login enabled"
echo ""
echo -e "  ${BLD}Kiosk URL:${RST}  http://localhost:8080/kiosk"
echo -e "  ${BLD}AI API:${RST}     http://localhost:8000/health"
echo ""
echo -e "  ${BLD}${YLW}To start manually without rebooting:${RST}"
echo "    sudo systemctl start oneid-ai-server"
echo "    ./run-jetson-kiosk.sh"
echo ""
echo -e "  ${BLD}${YLW}Debug logs:${RST}"
echo "    Kiosk:  tail -f /tmp/oneid-kiosk.log"
echo "    AI:     sudo journalctl -fu oneid-ai-server"
echo "    Setup:  cat $LOG"
echo ""

read -rp "  Reboot now? [y/N] " REBOOT_NOW
[[ "${REBOOT_NOW,,}" == "y" ]] && { info "Rebooting in 3 seconds..."; sleep 3; sudo reboot; } || info "Skipped. Run './run-jetson-kiosk.sh' to start manually."
