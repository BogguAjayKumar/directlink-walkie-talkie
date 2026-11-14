<div align="center">

# 📡 DirectLink Walkie-Talkie
### Instant, Zero-Latency, Two-Way Audio Intercom for Phone & Laptop
#### Split Codebases for Phone & Laptop • 3 Connection Modes • Authentic Tactical Acoustics

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-DTLS--SRTP-blue.svg)](https://webrtc.org/)
[![Android APK](https://img.shields.io/badge/Android-APK%20Ready-green.svg)](https://capacitorjs.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/BogguAjayKumar/directlink-walkie-talkie/pulls)

**DirectLink** is a lightweight, hardware-like Push-to-Talk (PTT) full-duplex audio intercom system exclusively designed to pair your **laptop and phone** over **local Wi-Fi**, **cellular mobile data (4G/5G)**, or **virtual walkie-talkie radio frequencies**.

No ringing, no answering screens, no call pickups—press or hold to talk, and your voice broadcasts instantly through the other device's speaker with authentic tactical radio acoustics (mic clicks, squelch tails, and Motorola/NASA Roger beeps).

[Key Features](#-key-features) • [Separate File Architecture](#-separate-file-architecture) • [Quick Start](#-quick-start) • [How to Test Two-Way Audio](#-how-to-test-two-way-audio) • [3 Connection Modes](#-3-tactical-connection-modes) • [Android APK](#-native-android-app-apk) • [Security](#-security--privacy)

---

</div>

## 🚀 Key Features

* **True Two-Way Real-Time Voice:**
  Instant hardware-like communication. Talk on your laptop → heard instantly on your phone. Talk on your phone → heard instantly on your laptop.
* **Completely Separated Codebases for Phone & Laptop:**
  Independent, modular code files for each device. Easily locate, tweak, and style the phone app or laptop app without interfering with each other:
  * **Phone Walkie-Talkie:** `public/phone.html`, `public/phone.js`, `public/phone.css`
  * **Laptop Command Station:** `public/laptop.html`, `public/laptop.js`, `public/laptop.css`
* **3 Tactical Connection Modes:**
  * **1. Local Wi-Fi (LAN Mode):** Sub-10ms direct peer-to-peer audio over your home or office Wi-Fi. Zero external internet required.
  * **2. Mobile Data + Wi-Fi (WAN Relay Mode):** Built-in encrypted HTTPS/WSS tunnel allowing you to communicate anywhere in the world when your phone is on 4G/5G cellular data and your laptop is at home.
  * **3. Radio Frequency Dialing Mode (Virtual Walkie-Talkie):** Dial standard UHF/FM/FRS walkie-talkie channels (e.g. `462.5625 MHz [CH 01]`, `462.5875 MHz [CH 02]`, `144.3900 MHz [VHF 01]`, or custom MHz). Tuning both devices to the same frequency links them instantly!
* **Distinct Visual Interfaces:**
  * **💻 Laptop Console HUD:** Wide cyberpunk/military terminal in deep navy & cyan with dual real-time oscilloscopes, VU meters (MIC & RX), Spacebar hotkey deck (`PRESS & HOLD SPACEBAR TO BROADCAST`), and audio DSP dials.
  * **📱 Phone Transceiver:** Authentic handheld radio chassis with top antenna, rotary volume/channel knobs, backlit fluorescent green LCD screen showing battery & signal strength, speaker grille, and a giant rubberized Push-To-Talk button.
* **Persistent Zero-Touch Auto-Connect:**
  Pair once—never re-type PINs or manually reconnect again. Devices automatically remember each other, restore the master bonded channel on startup, and auto-reconnect within 1.5 seconds if network drops or changes.
* **Conflict-Free Role Negotiation:**
  The server automatically assigns complimentary roles (`laptop` <-> `phone`) so both devices always link together without kicking each other out.
* **Procedural Acoustic Synthesizer (Web Audio API):**
  Zero external audio downloads. All sound effects are dynamically synthesized on the fly:
  * **Tactical Mic-Open Click** (high-frequency resonant pulse).
  * **Motorola / NASA Quindar Roger Beep** (dual-frequency sine tone on transmission release).
  * **Radio Squelch Tail** (bandpass-filtered white noise burst).

---

## 🗂 Separate File Architecture

DirectLink is cleanly structured into dedicated, modular files for each device:

```text
directlink-walkie-talkie/
├── public/
│   ├── phone.html          # 📱 Dedicated Mobile Walkie-Talkie UI
│   ├── phone.js            # 📱 Phone client logic, touch PTT & mobile WebRTC
│   ├── phone.css           # 📱 Handheld radio chassis & green LCD styles
│   │
│   ├── laptop.html         # 💻 Dedicated Laptop Command Base Station UI
│   ├── laptop.js           # 💻 Laptop client logic, spacebar hotkey & audio DSP
│   ├── laptop.css          # 💻 Military terminal console HUD styles
│   │
│   ├── sound-effects.js    # 🔊 Procedural Web Audio API sound synthesizer
│   ├── app-debug.apk       # 📲 Direct Android APK download file
│   ├── manifest.json       # 📱 PWA manifest configuration
│   └── sw.js               # ⚡ Service Worker for offline caching
│
├── android/                # 🤖 Native Android Studio Capacitor project
├── certs/                  # 🔒 Auto-generated TLS certificates & master bonded pair
├── server.js               # 🌐 Node.js dual HTTP (:8080) & HTTPS (:8443) signaling hub
├── capacitor.config.json   # ⚙️ Android Capacitor bridge configuration
├── package.json            # 📦 Project dependencies & scripts
└── test-signaling.js       # 🧪 Automated protocol & security test suite
```

---

## ⚡ Quick Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* A laptop and a phone connected to the same Wi-Fi network (or mobile data)

### 2. Install & Start Server
```bash
git clone https://github.com/BogguAjayKumar/directlink-walkie-talkie.git
cd directlink-walkie-talkie
npm install
npm start
```
*(On Windows, you can also double-click `start.bat`)*

The server will initialize on both **HTTP (:8080)** and **HTTPS (:8443)**:
```text
===============================================================
   DIRECTLINK TACTICAL INTERCOM SERVER IS ONLINE & READY
===============================================================
💻 LAPTOP ACCESS:
   👉 http://localhost:8080/laptop  (or https://localhost:8443)

📱 PHONE ACCESS (Same Wi-Fi):
   👉 http://192.168.0.142:8080/phone
   👉 Direct APK Download: http://192.168.0.142:8080/app-debug.apk

🌍 MOBILE DATA WAN (4G/5G / Global Internet):
   Click "Mobile Data WAN" on your laptop screen to generate public link.
===============================================================
```

---

## 🎙 How to Test Two-Way Audio

### Step 1: Open on Laptop
1. Open Chrome or Edge on your laptop and navigate to:  
   👉 **`http://localhost:8080/laptop`**
2. The laptop console HUD will load. You will see:  
   `○ PHONE DISCONNECTED (Waiting for Phone to link...)`

### Step 2: Open on Phone
1. Open Chrome or Safari on your phone and navigate to:  
   👉 **`http://192.168.0.142:8080/phone`**  
   *(Or install the Android APK: `http://192.168.0.142:8080/app-debug.apk`)*
2. If prompted, tap the amber **"🎙️ TAP HERE TO ARM PHONE MICROPHONE"** banner to allow microphone access.
3. The phone interface loads the rugged **Handheld Walkie-Talkie** chassis with the green LCD screen.

### Step 3: Connection Confirmation
* **On Laptop:** The banner turns glowing green: `🟢 PHONE CONNECTED: Handheld Phone [LIVE]`
* **On Phone:** The banner turns glowing green: `🟢 LAPTOP CONNECTED: Command Laptop [LIVE]`

### Step 4: Talk Between Devices
* **From Laptop → Hear on Phone:**  
  Press and hold **`SPACEBAR`** on your laptop and speak. Your voice broadcasts out loud through your phone's speaker! Release Spacebar to trigger the Roger Beep.
* **From Phone → Hear on Laptop:**  
  Touch and hold the big circular **`HOLD TO TALK`** button on your phone and speak. Your voice broadcasts out loud through your laptop's speaker! Release to trigger the Roger Beep.

---

## 📶 3 Tactical Connection Modes

Select any mode from the top bar on either device:

| Mode | How it Works | Best For |
| :--- | :--- | :--- |
| **1. Local Wi-Fi** | Direct high-speed local P2P audio over your home/office network. No external internet bandwidth required. | Home, office, warehouse, campus (< 10ms latency) |
| **2. Mobile Data + Wi-Fi** | Built-in encrypted WAN tunnel (`localtunnel`). Enables phone on 4G/5G cellular data to communicate with laptop at home. | Talking while traveling, outdoors, or on cellular data |
| **3. Radio Freq Dial** | Tune to authentic walkie-talkie frequencies (e.g. `462.5625 MHz [CH 01]`, `462.5875 MHz [CH 02]`, `144.3900 MHz [VHF 01]`, or dial custom MHz). Tuning both devices to the same frequency connects them instantly. | Authentic tactical walkie-talkie simulation |

---

## 🤖 Native Android App (APK)

DirectLink includes a full native Android project powered by **Capacitor**:

### Method A: Direct Download to Phone (No Compiling Needed)
1. On your phone's browser, open:  
   👉 **`http://192.168.0.142:8080/app-debug.apk`**
2. Download and tap to install (enable *"Install unknown apps"* if prompted).
3. Open **DirectLink** on your phone—it connects directly to your laptop's intercom!

### Method B: Build from Android Studio
```bash
npx cap open android
```
In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

### Method C: Build via Command Line
```bash
cmd /c "npx cap sync android"
cd android
./gradlew assembleDebug
```
The compiled APK is output at:  
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔒 Security & Privacy

* **Exclusive 2-Device Master Channels:** Each intercom channel is strictly limited to 1 laptop and 1 phone. Third-party devices are rejected automatically.
* **Cryptographic 6-Digit PINs:** Master channels are secured by session PINs and persistent pairing tokens.
* **End-to-End Encrypted (DTLS-SRTP):** WebRTC voice streams travel directly between devices encrypted end-to-end. The signaling server never records, buffers, or inspects audio data.
* **Anti-Brute-Force Rate Limiting:** Automated guessing attempts trigger immediate IP-level cooldown locks.

---

## 🧪 Automated Testing

DirectLink includes an automated end-to-end signaling and security verification test suite:

```bash
node test-signaling.js
```

### Verified Tests:
- [x] WebSocket client connection and handshake
- [x] Room creation and PIN validation
- [x] Peer arrival state notifications
- [x] Real-time Push-To-Talk state synchronization
- [x] Dynamic conflict-free role adaptation
- [x] Rejection of unauthorized PIN attempts
- [x] Rejection of 3rd device intrusion attempts

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Developed by <b>Boggu Ajay Kumar</b>. DirectLink Walkie-Talkie is open source and built with modern WebRTC & Web Audio API technologies.</sub>
</div>
