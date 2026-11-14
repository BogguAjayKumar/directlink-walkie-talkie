<div align="center">

# 📡 DirectLink Walkie-Talkie
### Instant, Zero-Latency, End-to-End Encrypted Intercom for Phone & Laptop

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-DTLS--SRTP-blue.svg)](https://webrtc.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/BogguAjayKumar/directlink-walkie-talkie/pulls)

**DirectLink** is a lightweight, hardware-like Push-to-Talk (PTT) audio intercom system that pairs your **phone and laptop** over **local Wi-Fi** or **cellular mobile data (4G/5G)**. 

No ringing, no answering screens, no call pickups—press or hold to talk, and your voice broadcasts instantly through the speaker with authentic tactical radio acoustics (mic clicks, squelch tails, and NASA Roger beeps).

[Key Features](#-key-features) • [Quick Start](#-quick-start) • [Phone Installation Guide](#-mobile-pwa-installation-guide) • [Architecture](#-architecture) • [Security](#-security--privacy) • [Docs](#-documentation)

---

</div>

## 🚀 Key Features

* **Instant Hardware-like Walkie-Talkie:** 
  Zero pickup friction. Once paired, the two devices maintain a persistent, bidirectional WebRTC audio standby line. Tap or hold to transmit immediately.
* **3 Tactical Connection Modes:**
  * **1. Local Wi-Fi (LAN Mode):** Ultra-fast sub-10ms peer-to-peer audio on the same Wi-Fi network without requiring external internet.
  * **2. Mobile Data + Wi-Fi (WAN Relay Mode):** Encrypted global HTTPS/WSS tunnel allowing phone on 4G/5G mobile data to communicate with laptop anywhere in the world.
  * **3. Radio Frequency Dialing Mode (Virtual Walkie-Talkie):** Tune to authentic UHF/FM/FRS frequencies (e.g. `462.5625 MHz [CH 01]`, `462.5875 MHz [CH 02]`, `144.3900 MHz [VHF 01]`, or dial custom MHz). Tuning both devices to the same frequency links them instantly!
* **Live Device Name & Connection Status Display:**
  Prominent real-time status banners on both Laptop and Phone interfaces displaying live link state and device identity (`PHONE CONNECTED: Handheld Phone` / `LAPTOP CONNECTED: Command Laptop`).
* **Zero-Touch Persistent Auto-Connect:**
  Pair once—never re-type PINs or reconnect manually again. The app automatically restores the master bonded connection on launch and handles network switches seamlessly within 1.5s.
* **Android APK with Auto-Granted Mic Permissions:**
  Capacitor native Android app pre-configured with Android runtime audio permissions and `BridgeWebChromeClient` WebRTC grants to avoid WebView mic permission loops. Direct APK download available directly from the server.
* **Tactical Cyberpunk / Military UI:**
  * Real-time **Oscilloscope Audio Visualizer** rendering outgoing and incoming speech waveforms directly on an HTML5 Canvas.
  * Responsive tactile **Push-to-Talk (PTT)** button with haptic vibration on mobile devices.
  * Desktop **Spacebar Hotkey** support (`Hold Spacebar to Talk`).
  * Seamless mode switcher between **"Hold to Talk"** and **"Handsfree / Toggle Mode"**.
* **Procedural Acoustic Synthesizer (Web Audio API):**
  No static `.mp3` or `.wav` assets. All radio sound effects are dynamically synthesized on the client:
  * **Mic-Open Click** (high-frequency resonant pulse).
  * **NASA/Motorola Roger Beep** (dual-frequency sine tone on transmission release).
  * **Radio Squelch Tail** (bandpass-filtered white noise burst).
* **Zero-Typing Phone Pairing:**
  Laptop screen generates a tactical QR Code encoding the active room channel, security PIN, and server endpoint. Scan with your phone's camera to connect and arm audio instantly.
* **Installable Progressive Web App (PWA):**
  Installs as a native standalone app on Android and iOS with Screen Wake Lock support to prevent mobile devices from sleeping during conversations.
* **End-to-End Encrypted (E2EE):**
  All voice streams are encrypted directly between devices using DTLS-SRTP. Zero voice data is ever saved or buffered on disk or server.

---

## 🛠 System Architecture

```mermaid
graph LR
    subgraph "Laptop / Workstation"
        UI_L[Web Dashboard / PWA]
        Audio_L[Web Audio API Graph]
        PC_L[WebRTC PeerConnection]
    end

    subgraph "Signaling Server (Node.js)"
        WSS[WebSocket Hub :8443]
        HTTPS[Express + Self-Signed TLS]
        Tunnel[localtunnel WAN Proxy]
    end

    subgraph "Smartphone (Android / iOS)"
        UI_P[Mobile Standalone PWA]
        Audio_P[Web Audio API + Haptics]
        PC_P[WebRTC PeerConnection]
    end

    UI_L <-->|WSS Signaling| WSS
    UI_P <-->|WSS Signaling| WSS
    PC_L <===>|Direct DTLS-SRTP Audio (P2P)| PC_P
```

*For an in-depth breakdown of the audio processing pipeline and network topologies, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).*

---

## ⚡ Quick Start

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
* A laptop/PC and a mobile phone connected to the same Wi-Fi network (or mobile data).
* Modern web browser (Chrome, Edge, Brave, or Safari).

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/BogguAjayKumar/directlink-walkie-talkie.git
cd directlink-walkie-talkie
npm install
```

### 2. Launch the Intercom Server
```bash
npm start
```
*(On Windows, you can simply double-click `start.bat`)*

The server will automatically generate fresh self-signed TLS certificates for local HTTPS and print:
```text
===============================================================
   DIRECTLINK WALKIE-TALKIE SERVER INITIALIZED & READY
===============================================================
Local Access (Laptop):
   https://localhost:8443

Local Network (Phone on same Wi-Fi):
   https://192.168.0.142:8443  [Wi-Fi]
===============================================================
```

### 3. Open on Laptop
1. Open your browser and navigate to **`https://localhost:8443`**.
2. Click **Advanced → Proceed to localhost** (bypasses the self-signed developer certificate).
3. Allow **Microphone** permission when requested.
4. Click **"Connect Intercom"**.

---

## 📱 Mobile PWA Installation Guide

DirectLink is built as a **Progressive Web App (PWA)**. You do not need to compile an APK or install an app from the App Store.

### Step 1: Open the Pairing Link on Your Phone

#### Mode A: Both Devices on Local Wi-Fi
1. On your laptop, click **"Pair Phone"** to reveal the pairing QR Code.
2. Ensure the dropdown is set to `Local Wi-Fi Network`.
3. Open your phone's Camera or QR scanner and scan the QR code.
4. Open the link in **Chrome** (Android) or **Safari** (iOS).
5. Tap **Advanced → Proceed to unsafe** (first time only, for local HTTPS certificate approval).
6. The app will auto-fill the channel & PIN and immediately connect!

#### Mode B: Phone on Cellular Data (4G / 5G WAN)
1. On your laptop, click **"Mobile Data WAN"** in the bottom control bar.
2. DirectLink will establish a secure public HTTPS relay tunnel.
3. The QR code automatically updates to the public tunnel link.
4. Scan the QR code over mobile data. Since it uses a verified public SSL certificate, it connects instantly with **zero security warnings**.

---

### Step 2: Install to Home Screen

#### 🤖 Android (Google Chrome)
1. With DirectLink open in Chrome, tap the **three dots menu (⋮)** in the top-right corner.
2. Tap **"Install app"** or **"Add to Home screen"**.
3. Tap **Install** to confirm.
4. DirectLink is now accessible as a standalone fullscreen app on your home screen and launcher.

#### 🍏 iPhone / iPad (Safari)
1. Open the pairing URL in **Safari** (Apple requires Safari for PWA installation).
2. Tap the **Share** button (square with an arrow pointing up at the bottom).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top-right corner.

---

## 🤖 Native Android App (Capacitor & Android Studio)

DirectLink is also packaged as a **native Android project** powered by **Capacitor**. You can open it in Android Studio to build and export a standalone `.apk` or `.aab`.

### 1. Open in Android Studio
Launch Android Studio and open the `android/` directory:
```bash
npx cap open android
```
*(Or launch Android Studio directly and select `Open` -> select the `L2PC/android` folder).*

### 2. Build APK in Android Studio
1. Wait for Gradle sync to complete.
2. In the top menu, go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Once completed, Android Studio will display a notification: *"APK(s) generated successfully"*.
4. Click **locate** to reveal the output `app-debug.apk`.

### 3. Build APK via Command Line
If you prefer building directly from the terminal without opening Android Studio:
```bash
# Sync any web assets:
npx cap sync android

# Build debug APK using the Gradle wrapper:
cd android
./gradlew assembleDebug
```
The generated APK will be output at:
`android/app/build/outputs/apk/debug/app-debug.apk`

Transfer this `.apk` to your phone and tap to install! (Ensure *Install unknown apps* permission is enabled).

---

## 🎙 How to Operate

| Action | Laptop / Desktop | Smartphone (PWA) |
| :--- | :--- | :--- |
| **Push-to-Talk (PTT)** | Hold **`SPACEBAR`** or hold central button | Hold the circular **"Hold to Talk"** button |
| **End Transmission** | Release Spacebar (Triggers Roger Beep) | Release button (Triggers Roger Beep) |
| **Handsfree / Toggle Mode** | Click **"Hold Mode"** to toggle to **"Toggle Mode"** | Tap mode button to toggle mic on / off |
| **Mute Roger Beeps** | Click the **"Roger Beep"** icon | Tap the **"Roger Beep"** icon |
| **Screen Wake Lock** | N/A | Kept awake automatically during active sessions |

---

## 🔒 Security & Privacy

* **Strict 2-Device Channels:** Each channel strictly limits participation to exactly 1 laptop and 1 phone. Any 3rd party attempting to connect is immediately blocked.
* **Cryptographic 6-Digit PINs:** Rooms are protected by random 6-digit session PINs.
* **Anti-Brute-Force Rate Limiting:** Automated PIN guessing triggers immediate IP-level rate limiting and cooldown locks.
* **DTLS-SRTP Audio Encryption:** Direct WebRTC media tracks are encrypted point-to-point. The signaling server never decrypts or inspects voice streams.
* **Zero Audio Persistence:** No voice recordings, transcripts, or user media are ever recorded or written to disk.

---

## 🧪 Automated Testing

DirectLink includes an automated end-to-end signaling and security verification test suite:

```bash
# Make sure server is running, then run in another terminal:
npm test
```

### Test Coverage:
- [x] WebSocket client connection and handshake
- [x] Room creation and PIN validation
- [x] Peer arrival state notifications
- [x] Real-time Push-To-Talk state synchronization
- [x] Rejection of unauthorized PIN attempts
- [x] Rejection of 3rd device intrusion attempts

---

## 📚 Documentation

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Comprehensive technical architecture, Web Audio synthesis graph, and network models.
* [docs/SIGNALING_PROTOCOL.md](docs/SIGNALING_PROTOCOL.md) — Complete WebSocket message schema and REST API specifications.

---

## 📁 Repository Structure

```text
directlink-walkie-talkie/
├── certs/                 # Cached self-signed TLS certificates (generated on first boot)
├── docs/
│   ├── ARCHITECTURE.md    # Detailed audio graph and network architecture
│   └── SIGNALING_PROTOCOL.md # WebSocket event schema & REST endpoints
├── public/                # Client PWA Assets
│   ├── app.js             # WebRTC engine, PTT controller & audio router
│   ├── index.html         # Cyberpunk tactical intercom UI
│   ├── manifest.json      # PWA manifest for standalone home-screen installation
│   ├── sound-effects.js   # Procedural Web Audio API sound synthesizer
│   ├── style.css          # Tactical visual design & responsive layout
│   └── sw.js              # PWA Service Worker for offline caching
├── server.js              # Express + HTTPS + WebSocket signaling hub
├── start.bat              # 1-Click launcher for Windows
├── test-signaling.js      # Automated protocol & security test suite
├── package.json           # Dependencies and project metadata
└── README.md              # Project documentation
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Developed by <b>Boggu Ajay Kumar</b>. DirectLink Walkie-Talkie is open source and built with modern WebRTC & Web Audio API technologies.</sub>
</div>
