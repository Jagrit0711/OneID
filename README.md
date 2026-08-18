# 🛡️ OneID — Human-First Offline Identity & Document Vault

**OneID** is a 100% offline, privacy-first biometric identity verification kiosk and citizen document locker system. It combines UIDAI cryptographic RSA 2048-bit Secure QR decoding, client-side Web Crypto verification, and local **InsightFace ArcFace 512-dimensional neural AI face comparison** (99.86% LFW benchmark accuracy) with zero external cloud dependencies.

Designed for desktop, mobile, embedded hardware, and **Raspberry Pi 3.5-inch Touchscreen (480×320)** kiosk terminals.

---

## 🌟 Key Features

- 🔐 **UIDAI Cryptographic QR Verification**: Decodes and verifies 2048-bit RSA digital signatures client-side using Web Crypto API.
- 👤 **InsightFace ArcFace 512-Dim Biometrics**: Local Python FastAPI microservice running ONNX ArcFace neural models for 99.86% true biometric match verification.
- 📁 **Citizen Document Locker (`/user`)**: Inline storage for PAN Card, Driving License, Ration Card, and Board Marksheets with interactive document previews.
- 🛂 **Official Verification Station (`/official`)**: Officer authentication portal, live citizen inspection, permission management, and real-time searchable/exportable Audit Logs.
- 🖥️ **Raspberry Pi 3.5" Touchscreen Kiosk Mode (`?kiosk=true`)**: Fullscreen touch-optimized layout formatted specifically for 480×320 TFT displays.
- 📱 **Portrait Kiosk Terminal View (`?kiosk=portrait`)**: High-impact vertical kiosk interface for portrait displays.

---

## 🏗️ Architecture & Technology Stack

- **Frontend**: React 19, TanStack Start / TanStack Router, Vite, Tailwind CSS, Framer Motion, MediaPipe Vision, Lucide Icons.
- **Biometric AI Backend**: Python 3.10+, FastAPI, Uvicorn, InsightFace (`buffalo_sc` 512-dim ArcFace ONNX model), OpenCV, NumPy.

---

## 🚀 Quick Start Guide

Follow these steps to run **both** the Python AI Backend Server and the Web Kiosk Application locally.

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **npm** (or **bun** / **yarn**)

---

### 2. Setup & Run the Python InsightFace AI Backend

The Python backend handles 512-dimensional ArcFace face embedding extraction and L2-normalized cosine distance matching.

```bash
# 1. Navigate to the server directory
cd server

# 2. Create a Python virtual environment
python3 -m venv venv

# 3. Activate the virtual environment
# On macOS / Linux:
source venv/bin/activate
# On Windows (Command Prompt):
# venv\Scripts\activate

# 4. Install backend dependencies
pip install -r requirements.txt

# 5. Start the InsightFace FastAPI server
python main.py
```

> **Note**: On first launch, InsightFace will automatically download the lightweight `buffalo_sc` ArcFace ONNX model (~15MB).  
> The server runs at **`http://localhost:8000`**.  
> You can verify health status at **`http://localhost:8000/health`**.

> 💡 **Troubleshooting `[Errno 48] Address already in use`**:  
> If port 8000 is occupied by a previously running process, kill it before launching `python main.py`:
> ```bash
> lsof -ti :8000 | xargs kill -9
> ```

---

### 3. Setup & Run the OneID Web Application

Open a **new terminal tab/window** in the project root directory:

```bash
# 1. Install frontend dependencies
npm install --legacy-peer-deps

# 2. Start the Vite development server on port 5173
npm run dev
```

> The web application will launch at **`http://localhost:5173`**.

---

## 📱 Kiosk Modes & Raspberry Pi Deployment

OneID includes built-in modes for embedded hardware and kiosks:

1. **Standard Desktop / Tablet Mode**:  
   Access directly at `http://localhost:5173/`

2. **Raspberry Pi 3.5" Touchscreen Kiosk Mode (480×320)**:  
   - Click **`Pi Kiosk Mode`** in the header on any page, or navigate to `http://localhost:5173/official?kiosk=true`
   - Activates HTML5 Fullscreen API, compact camera containers (max 180px height), and disables heavy CSS blur filters for 60fps performance on ARM GPUs.

3. **Portrait Kiosk Terminal View**:  
   - Click **`Portrait Kiosk`** on the landing page header, or navigate to `http://localhost:5173/?kiosk=portrait`
   - Presents a clean vertical terminal UI featuring big touch buttons for Citizen Login and Official Login.

---

## 📡 API Endpoints (Python Backend)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Returns server health, InsightFace status, and loaded model name |
| `POST` | `/verify` | Accepts `reference_image` and sampled `live_images` (base64 JPEG/PNG); returns 512-dim ArcFace match percentage & verification verdict |

---

## 🛠️ Production Build

To create a production-ready build of the web application:

```bash
npm run build
```

This compiles client assets, SSR bundles, and Nitro server outputs inside `.output/`.

---

## 📄 License

MIT License. Designed for privacy-first, 100% offline identity verification.
