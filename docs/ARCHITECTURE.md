# System Architecture — DirectLink Walkie-Talkie 📡

DirectLink is engineered as a low-latency, zero-persistence, peer-to-peer audio intercom system designed to provide real-time hardware-like walkie-talkie communication between mobile devices (smartphones) and personal computers (laptops/desktops).

---

## 🏗 High-Level Component Topology

```mermaid
graph TD
    subgraph "Laptop Station Master (/laptop)"
        UI_Laptop["Station Master HUD (laptop.html)"]
        Audio_In_L["Microphone Input"]
        Audio_Proc_L["Web Audio API DSP Graph (GainNode + Analyser)"]
        DSP_Filter_L["Tactical RF Biquad Filter + Waveshaper"]
        VOX_L["VOX Voice Activation Detector (700ms Hangover)"]
        Replay_L["MediaRecorder Rolling Replay Buffer"]
        SFX_L["Procedural Audio FX (Clicks / Roger Beeps)"]
        PC_L["RTCPeerConnection (DTLS-SRTP Audio)"]
        WS_L["WebSocket Signaling Client"]
    end

    subgraph "Signaling & Discovery Server (:8080 / :8443)"
        Router["Smart Device Router (index.html)"]
        Node_Server["Node.js (Express + HTTPS)"]
        WSS["WebSocket Server (ws)"]
        Room_Mgr["Room & PIN Security Registry"]
        SOS_Relay["Emergency Beacon Relay Engine"]
        QR_Gen["Dynamic QR Code Generator"]
        Tunnel_Mgr["WAN Reverse Proxy Tunnel (localtunnel)"]
    end

    subgraph "Smartphone Transceiver (/phone)"
        UI_Phone["Handheld Radio Transceiver (phone.html)"]
        Audio_In_P["Microphone Input"]
        Audio_Proc_P["Web Audio API Graph (GainNode + Analyser)"]
        VOX_P["VOX Voice Activation Detector"]
        Replay_P["MediaRecorder Rolling Replay Buffer"]
        SFX_P["Haptics + Procedural Audio FX"]
        PC_P["RTCPeerConnection (DTLS-SRTP Audio)"]
        WS_P["WebSocket Signaling Client"]
        BT_PTT["Web Bluetooth & MediaSession Headset Trigger"]
        GPS["GPS Geolocation Engine"]
        WakeLock["Screen Wake Lock API"]
    end

    %% Routing
    Router -.->|Desktop UA| UI_Laptop
    Router -.->|Mobile UA| UI_Phone

    %% Audio and Signaling Paths
    WS_L <-->|WSS (SDP / ICE / PTT / SOS Beacon)| WSS
    WS_P <-->|WSS (SDP / ICE / PTT / SOS Beacon)| WSS
    PC_L <===>|Direct E2EE Audio Stream (DTLS-SRTP)| PC_P
    
    Audio_In_L --> Audio_Proc_L --> DSP_Filter_L --> PC_L
    Audio_In_P --> Audio_Proc_P --> PC_P

    Node_Server --> Router
    Node_Server --> WSS
    Node_Server --> Room_Mgr
    Node_Server --> SOS_Relay
    Node_Server --> QR_Gen
    Node_Server --> Tunnel_Mgr
```

---

## 🎙 Audio Engine Architecture & DSP Processing

DirectLink does **not** rely on static audio asset files (`.mp3` or `.wav`). All acoustic feedback cues and voice shaping are dynamically computed on the client device using the **Web Audio API**:

```text
[Microphone MediaStream] 
        │
        ├──> [MediaStreamAudioSourceNode]
        │           │
        │           ├──> [GainNode (Muted when PTT is idle)]
        │           │           │
        │           │           ├──> [BiquadFilterNode: Bandpass (350Hz - 3400Hz)] (Tactical RF)
        │           │           │           │
        │           │           │           ├──> [BiquadFilterNode: Peaking (+4dB @ 1800Hz)]
        │           │           │           │           │
        │           │           │           │           ├──> [WaveShaperNode (Soft Saturation Curve)]
        │           │           │           │           │           │
        │           │           │           │           │           └──> [RTCPeerConnection Track] ──> (Remote Peer)
        │           │           │
        │           │           └──> [MediaStreamDestination] (Clean PTT feed)
        │           │
        │           └──> [Local AnalyserNode] ──> [HTML5 Canvas Oscilloscope + VOX RMS Speech Detection]
        │
[Incoming Peer AudioStream]
        │
        ├──> [MediaRecorder Engine] ──> [30s Rolling Replay Buffer Blobs] ──> [Instant Replay Output]
        │
        ├──> [Remote AnalyserNode] ──> [Remote Oscilloscope & Audio VU Meter]
        │
        └──> [HTMLAudioElement / Destination] (Ducked to 0% during local TX to eliminate feedback)

[AudioContext Procedural Synthesis]
        ▲
        ├─── [Mic Click]       : Short 1.2 kHz resonant impulse filter (< 15ms)
        ├─── [Roger Beep]      : Dual-tone sinusoidal generator (2.47 kHz & 1.2 kHz NASA Quindar tone)
        ├─── [Squelch Tail]    : Bandpass-filtered Gaussian white noise burst (~60ms)
        └─── [Emergency Siren] : Alternating dual-frequency warble generator (960 Hz / 770 Hz)
```

### Advanced Subsystems:
1. **VOX Voice-Activated Transmission:** Continuously computes root-mean-square (RMS) energy levels on the `AnalyserNode`. Once energy exceeds the selected threshold (Low/Med/High), PTT automatically keys on. A 700ms decay hangover prevents speech clipping during natural sentence pauses.
2. **Tactical Replay Buffer:** Captures incoming audio into timestamped binary WebM chunks. When the user taps "Play Last", an isolated HTMLAudioElement playback pipeline plays back the transmission.
3. **Hardware Bluetooth PTT & Headset Integration:** Listens to external Bluetooth LE button characteristics (`navigator.bluetooth`) and intercepts `navigator.mediaSession` headset hardware action events (`play`, `pause`, `stop`, `nexttrack`).
4. **SOS Emergency Beacon:** Generates a 960Hz/770Hz piercing siren while querying high-accuracy GPS coordinates (`navigator.geolocation`). Transmits an `{ type: "sos-beacon" }` emergency packet across the WebSocket signaling mesh to trigger a visual modal and audible alert on the linked device.

---

## 🌐 Network Traversal & Topologies

DirectLink operates across two primary network topologies:

### 1. Local Area Network (LAN / Wi-Fi)
* **Direct Subnet Link:** Both devices reside on the same Wi-Fi router.
* **Auto-Discovery:** Server discovers local IPv4 interface (e.g., `192.168.x.x`).
* **ICE Gathering:** ICE candidates resolve directly to local RFC 1918 addresses.
* **Latency:** Sub-10ms packet transmission.

### 2. Wide Area Network (WAN / Cellular 4G/5G)
* **NAT Traversal:** Cellular carrier-grade NAT (CGNAT) prevents inbound connections to laptops.
* **Reverse Proxy Tunnel:** Server establishes a secure HTTPS tunnel via public relays.
* **STUN Fallback:** `stun:stun.l.google.com:19302` enables public IP and port discovery.
* **Seamless Handover:** QR code and invitation URLs dynamically adapt to the active network link.

---

## 🔒 Security Architecture

| Security Layer | Implementation | Threat Mitigated |
| :--- | :--- | :--- |
| **Transport Encryption** | TLS 1.3 / HTTPS + WSS | Eavesdropping, Man-in-the-Middle (MITM) |
| **Media Encryption** | WebRTC DTLS-SRTP | In-transit audio packet tampering or wiretapping |
| **End-to-End Cryptography** | WebCrypto AES-256-GCM | Host or relay server eavesdropping |
| **Access Control** | 6-digit channel PIN + Dynamic Room ID | Unauthorized channel joining |
| **Room Concurrency** | Strict 2-Peer Maximum per Room | Eavesdropping via extra listeners |
| **Anti-Brute-Force** | IP rate limiting (5 attempts/30s lockout) | Automated PIN enumeration |
| **Audio Privacy** | Zero disk / memory audio persistence | Data retention, server-side audio leaks |
| **Acoustic Ducking** | Half-Duplex Receiver Muting | High-gain acoustic feedback howl loops |
