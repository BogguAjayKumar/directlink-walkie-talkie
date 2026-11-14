# System Architecture — DirectLink Walkie-Talkie 📡

DirectLink is engineered as a low-latency, zero-persistence, peer-to-peer audio intercom system designed to provide real-time hardware-like walkie-talkie communication between mobile devices (smartphones) and personal computers (laptops/desktops).

---

## 🏗 High-Level Component Topology

```mermaid
graph TD
    subgraph "Laptop / Desktop"
        UI_Laptop["Tactical Web UI / PWA"]
        Audio_In_L["Microphone Input"]
        Audio_Proc_L["Web Audio API Graph (Gate + Analyser)"]
        SFX_L["Procedural Audio FX (Clicks / Roger Beeps)"]
        PC_L["RTCPeerConnection (DTLS-SRTP)"]
        WS_L["WebSocket Signaling Client"]
    end

    subgraph "Signaling & Discovery Server"
        Node_Server["Node.js (Express + HTTPS)"]
        WSS["WebSocket Server (ws)"]
        Room_Mgr["Room & PIN Security Registry"]
        QR_Gen["Dynamic QR Code Generator"]
        Tunnel_Mgr["WAN Reverse Proxy Tunnel (localtunnel)"]
    end

    subgraph "Smartphone (Android / iOS)"
        UI_Phone["Tactical PWA (Fullscreen Standalone)"]
        Audio_In_P["Microphone Input"]
        Audio_Proc_P["Web Audio API Graph"]
        SFX_P["Haptics + Procedural Audio FX"]
        PC_P["RTCPeerConnection (DTLS-SRTP)"]
        WS_P["WebSocket Signaling Client"]
        WakeLock["Screen Wake Lock API"]
    end

    %% Audio and Signaling Paths
    WS_L <-->|WSS (SDP / ICE / PTT Sync)| WSS
    WS_P <-->|WSS (SDP / ICE / PTT Sync)| WSS
    PC_L <===>|Direct E2EE Audio Stream (DTLS-SRTP)| PC_P
    
    Audio_In_L --> Audio_Proc_L --> PC_L
    Audio_In_P --> Audio_Proc_P --> PC_P

    Node_Server --> WSS
    Node_Server --> Room_Mgr
    Node_Server --> QR_Gen
    Node_Server --> Tunnel_Mgr
```

---

## 🎙 Audio Engine Architecture (Procedural Synthesis)

DirectLink does **not** rely on static audio asset files (`.mp3` or `.wav`). All acoustic feedback cues are dynamically synthesized on the client device using the **Web Audio API**:

```
[Microphone MediaStream] 
        │
        ├──> [MediaStreamAudioSourceNode]
        │           │
        │           ├──> [AudioWorklet / GainNode (Muted when idle)]
        │           │           │
        │           │           └──> [RTCPeerConnection Audio Track]  ──> (Remote Peer)
        │           │
        │           └──> [AnalyserNode] ──> [HTML5 Canvas Oscilloscope Waveform]
        │
[AudioContext Destination]
        ▲
        ├─── [Mic Click] : Short 1.2 kHz resonant impulse filter (< 15ms)
        ├─── [Roger Beep]: Dual-tone sinusoidal generator (2.47 kHz & 1.2 kHz NASA tone)
        └─── [Squelch Tail]: Bandpass-filtered Gaussian white noise burst (~60ms)
```

### Benefits of Procedural Audio:
1. **Zero Asset Latency:** Instant response with zero HTTP asset fetch overhead.
2. **Deterministic Tone Frequency:** Precision replication of military and Motorola/NASA tactical radio telemetry tones.
3. **Bandwidth Savings:** Zero static assets required over cellular networks.

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
| **Access Control** | 6-digit channel PIN + Dynamic Room ID | Unauthorized channel joining |
| **Room Concurrency** | Strict 2-Peer Maximum per Room | Eavesdropping via extra listeners |
| **Anti-Brute-Force** | IP rate limiting (5 attempts/30s lockout) | Automated PIN enumeration |
| **Audio Privacy** | Zero disk / memory audio persistence | Data retention, server-side audio leaks |
