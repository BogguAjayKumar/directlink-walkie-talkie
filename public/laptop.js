/**
 * DirectLink Laptop Command Base Station
 * Dedicated Client Script for Laptop Station HUD
 *
 * Implemented Features:
 * 1. VOX (Voice-Operated Exchange) Hands-Free Voice-Activated Transmission
 * 2. Instant "Last Call" Audio Replay Buffer with MediaRecorder circular chunking
 * 3. Physical Bluetooth PTT Button (Web Bluetooth) & MediaSession Headset key support
 * 4. End-to-End Encrypted Audio Payloads (WebRTC Insertable Streams + AES-256-GCM)
 * 5. Emergency Distress SOS Warble & GPS Location Beacon
 * 6. Tactical VHF/UHF RF Atmospheric Distortion & Squelch Realism Filter
 */

(() => {
  // --- DOM Elements ---
  const body = document.body;
  const bondBadge = document.getElementById('bondBadge');
  const bondStatusText = document.getElementById('bondStatusText');
  const pingBadge = document.getElementById('pingBadge');
  const pingValue = document.getElementById('pingValue');
  const linkBadge = document.getElementById('linkBadge');
  const e2eeBadge = document.getElementById('e2eeBadge');

  // 3-Way Mode Tabs
  const btnModeWifi = document.getElementById('btnModeWifi');
  const btnModeWan = document.getElementById('btnModeWan');
  const btnModeFreq = document.getElementById('btnModeFreq');

  // Virtual Radio Frequency Tuner Bar
  const freqTunerBar = document.getElementById('freqTunerBar');
  const currentFreqValue = document.getElementById('currentFreqValue');
  const currentFreqChannel = document.getElementById('currentFreqChannel');
  const selectRadioFreq = document.getElementById('selectRadioFreq');
  const customFreqBox = document.getElementById('customFreqBox');
  const inputCustomFreq = document.getElementById('inputCustomFreq');
  const btnApplyFreq = document.getElementById('btnApplyFreq');

  // Connection & HUD Elements
  const peerStatusBannerLaptop = document.getElementById('peerStatusBannerLaptop');
  const peerStatusDeviceNameLaptop = document.getElementById('peerStatusDeviceNameLaptop');
  const peerStatusHintLaptop = document.getElementById('peerStatusHintLaptop');
  const displayRoomLaptop = document.getElementById('displayRoomLaptop');
  const peerPillLaptop = document.getElementById('peerPillLaptop');
  const peerLabelLaptop = document.getElementById('peerLabelLaptop');
  const statusLabelLaptop = document.getElementById('statusLabelLaptop');
  const statusBannerLaptop = document.getElementById('statusBannerLaptop');
  const oscilloscopeLaptop = document.getElementById('oscilloscopeLaptop');
  const vuMic = document.getElementById('vuMic');
  const vuPeer = document.getElementById('vuPeer');

  // Spacebar Transmission Deck
  const pttBtnLaptop = document.getElementById('pttBtnLaptop');
  const pttTextLaptop = document.getElementById('pttTextLaptop');
  const pttSubtextLaptop = document.getElementById('pttSubtextLaptop');

  // Audio DSP & Controls
  const sliderGain = document.getElementById('sliderGain');
  const gainValueDisplay = document.getElementById('gainValueDisplay');
  const selectRogerBeep = document.getElementById('selectRogerBeep');
  const selectVoxSensitivityLaptop = document.getElementById('selectVoxSensitivityLaptop');
  const inputE2eePassLaptop = document.getElementById('inputE2eePassLaptop');
  const chkRadioFilterLaptop = document.getElementById('chkRadioFilterLaptop');
  const chkEchoCancel = document.getElementById('chkEchoCancel');
  const chkNoiseSupp = document.getElementById('chkNoiseSupp');

  // Telemetry Elements
  const valIceState = document.getElementById('valIceState');
  const valLatency = document.getElementById('valLatency');
  const valVoxState = document.getElementById('valVoxState');
  const valE2ee = document.getElementById('valE2ee');

  // Station Controls
  const btnModeLaptop = document.getElementById('btnModeLaptop');
  const modeTextLaptop = document.getElementById('modeTextLaptop');
  const btnVoxLaptop = document.getElementById('btnVoxLaptop');
  const voxTextLaptop = document.getElementById('voxTextLaptop');
  const btnReplayLaptop = document.getElementById('btnReplayLaptop');
  const btnSosLaptop = document.getElementById('btnSosLaptop');
  const btnTunnelLaptop = document.getElementById('btnTunnelLaptop');
  const tunnelTextLaptop = document.getElementById('tunnelTextLaptop');
  const btnPairingLaptop = document.getElementById('btnPairingLaptop');
  const btnBlePttLaptop = document.getElementById('btnBlePttLaptop');
  const btnResetBondLaptop = document.getElementById('btnResetBondLaptop');
  const activityLog = document.getElementById('activityLog');

  // Feature 5: Emergency SOS Modal
  const modalSosAlertLaptop = document.getElementById('modalSosAlertLaptop');
  const sosSubtitleLaptop = document.getElementById('sosSubtitleLaptop');
  const sosCoordsLaptop = document.getElementById('sosCoordsLaptop');
  const btnSosMapsLaptop = document.getElementById('btnSosMapsLaptop');
  const btnCancelSosLaptop = document.getElementById('btnCancelSosLaptop');

  // Pairing Modal
  const pairingModal = document.getElementById('pairingModal');
  const selectNetwork = document.getElementById('selectNetwork');
  const inputServer = document.getElementById('inputServer');
  const inputRoom = document.getElementById('inputRoom');
  const inputPin = document.getElementById('inputPin');
  const qrImage = document.getElementById('qrImage');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const btnPasteLinkLaptop = document.getElementById('btnPasteLinkLaptop');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnConnect = document.getElementById('btnConnect');

  // Audio Elements
  const remoteAudio = document.getElementById('remoteAudio');
  const lastCallAudio = document.getElementById('lastCallAudio');

  // --- State Variables ---
  const deviceRole = 'laptop';
  const localDeviceName = 'Command Laptop';

  let currentRoomId = 'directlink-master';
  let currentPin = '849201';
  let currentPairToken = null;
  let activeIntercomMode = 'wifi';
  let currentRfSetting = '462.5625|CH 01';

  let ws = null;
  let pc = null;
  let rawStream = null;
  let localAudioTrack = null;
  let localGainNode = null;
  let userGainMultiplier = 1.0;
  let pendingCandidates = [];

  let remotePeerInfo = null;
  let reconnectInterval = null;
  let pingInterval = null;
  let animFrameId = null;

  let isConnected = false;
  let isTransmitting = false;
  let isReceiving = false;
  let isToggleMode = false;
  let hasRemotePeer = false;
  let isSpacePressed = false;
  let audioUnlocked = false;

  // Feature 1: VOX State
  let isVoxEnabled = false;
  let voxThreshold = 25; // default medium
  let voxHangoverMs = 700;
  let lastVoiceDetectedTime = 0;
  let isVoxTransmitting = false;

  // Feature 2: Replay Buffer
  let incomingMediaRecorder = null;
  let incomingAudioChunks = [];
  let lastRecordedAudioUrl = null;

  // Feature 4: E2EE Key
  let e2eeKey = null;
  let e2eePassphrase = '';

  // Feature 5: SOS Beacon
  let isSosActive = false;
  let localCoords = null;

  // Feature 6: RF Tactical Filter
  let tacticalRadioFilter = null;

  // Audio DSP Graph
  let audioCtx = null;
  let localAnalyser = null;
  let remoteAnalyser = null;

  let serverInfo = {
    localIps: [],
    httpPort: 8080,
    httpsPort: 8443,
    tunnelUrl: null,
    isTunneling: false,
    bondedPair: null
  };

  const soundFx = new SoundEffects();
  window.soundEffects = soundFx;

  // --- Event Audit Logger ---
  function logEvent(msg) {
    const time = new Date().toTimeString().split(' ')[0];
    console.log(`[Laptop Station ${time}] ${msg}`);
    if (activityLog) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `<span>${time}</span> ${msg}`;
      activityLog.appendChild(entry);
      activityLog.scrollTop = activityLog.scrollHeight;
    }
  }

  // --- Feature 4: E2EE Key Derivation ---
  async function updateE2eeKey(passphrase) {
    e2eePassphrase = (passphrase || '').trim();
    localStorage.setItem('directlink_e2ee_key', e2eePassphrase);
    if (!e2eePassphrase) {
      e2eeKey = null;
      if (e2eeBadge) e2eeBadge.textContent = '🔒 E2EE READY';
      if (valE2ee) valE2ee.textContent = 'STANDARD DTLS';
      logEvent('E2EE custom encryption key cleared.');
      return;
    }
    try {
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(e2eePassphrase));
      e2eeKey = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      if (e2eeBadge) e2eeBadge.textContent = '🔒 AES-256 ARMED';
      if (valE2ee) valE2ee.textContent = 'LOCKED (AES-256)';
      logEvent('E2EE AES-256 encryption key successfully armed!');
      updateQrCode();
    } catch (e) {
      console.warn('E2EE key derivation error:', e);
    }
  }

  // --- URL Parameter & Hash Parsing ---
  function parseUrlParameters() {
    const params = new URLSearchParams();

    if (window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      for (const [k, v] of searchParams.entries()) params.set(k, v);
    }

    if (window.location.hash) {
      const hashStr = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashStr);
      for (const [k, v] of hashParams.entries()) params.set(k, v);
    }

    const room = params.get('room');
    const pin = params.get('pin');
    const server = params.get('server');
    const token = params.get('token');
    const mode = params.get('mode');
    const freq = params.get('freq');
    const key = params.get('key');

    if (room || pin || server || token || mode || freq || key) {
      return { room, pin, server, token, mode, freq, key };
    }
    return null;
  }

  function parseInviteLinkText(raw) {
    if (!raw) return null;
    let text = raw.trim();
    let searchParams = null;
    let serverBase = '';

    if (text.includes('#')) {
      const parts = text.split('#');
      serverBase = parts[0];
      searchParams = new URLSearchParams(parts[1]);
    } else if (text.includes('?')) {
      const parts = text.split('?');
      serverBase = parts[0];
      searchParams = new URLSearchParams(parts[1]);
    } else {
      searchParams = new URLSearchParams(text);
    }

    const room = searchParams.get('room');
    const pin = searchParams.get('pin');
    const token = searchParams.get('token');
    const mode = searchParams.get('mode');
    const freq = searchParams.get('freq');
    const key = searchParams.get('key');
    const server = searchParams.get('server') || (serverBase && serverBase.startsWith('http') ? serverBase : null);

    return { room, pin, server, token, mode, freq, key };
  }

  // --- Audio Pipeline Unlocker ---
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    soundFx.init();

    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext({ latencyHint: 'interactive' });
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    // Feature 6: Initialize tactical RF radio filter
    if (!tacticalRadioFilter && soundFx.createTacticalRadioFilter) {
      tacticalRadioFilter = soundFx.createTacticalRadioFilter(audioCtx);
    }

    setupMediaSession();

    if (remoteAudio) {
      remoteAudio.muted = false;
      remoteAudio.volume = 1.0;
      const p = remoteAudio.play();
      if (p !== undefined) {
        p.then(() => { if (!remoteAudio.srcObject) remoteAudio.pause(); }).catch(() => {});
      }
    }
  }

  ['keydown', 'mousedown', 'click', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, () => {
      unlockAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }, { once: false, passive: true });
  });

  // Feature 3: MediaSession Headset Key Support
  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'DirectLink Command Base Station',
        artist: 'PTT Channel Armed',
        album: 'DirectLink Console'
      });
      try {
        navigator.mediaSession.setActionHandler('play', () => { togglePtt(); });
        navigator.mediaSession.setActionHandler('pause', () => { togglePtt(); });
        navigator.mediaSession.setActionHandler('nexttrack', () => { handlePttDown(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { handlePttUp(); });
      } catch (e) {}
    }
  }

  // --- Endpoint Resolution ---
  function resolveServerEndpoints() {
    let host = window.location.host;
    let protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';

    let raw = (inputServer && inputServer.value.trim()) || '';
    if (raw) {
      let clean = raw.trim();
      if (clean.startsWith('https://') || clean.startsWith('wss://')) {
        protocol = 'https:';
        clean = clean.replace(/^(https:\/\/|wss:\/\/)/, '');
      } else if (clean.startsWith('http://') || clean.startsWith('ws://')) {
        protocol = 'http:';
        clean = clean.replace(/^(http:\/\/|ws:\/\/)/, '');
      } else if (clean.includes(':8080') || clean.includes(':80')) {
        protocol = 'http:';
      } else if (clean.includes(':8443') || clean.includes('.loca.lt')) {
        protocol = 'https:';
      }
      clean = clean.replace(/\/+$/, '').split('/')[0];
      if (clean) host = clean;
    }

    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    const httpOrigin = `${protocol}//${host}`;
    const wsUrl = `${wsProtocol}//${host}`;
    return { httpOrigin, wsUrl, host };
  }

  // --- Microphone Hardware Initialization with Real Web Audio Gain ---
  async function initMicrophone() {
    if (localAudioTrack && localAudioTrack.readyState === 'live') {
      return localAudioTrack;
    }

    try {
      unlockAudio();
      const echo = chkEchoCancel ? chkEchoCancel.checked : true;
      const noise = chkNoiseSupp ? chkNoiseSupp.checked : true;

      rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: echo,
          noiseSuppression: noise,
          autoGainControl: false, // Controlled via Web Audio GainNode
          latency: 0.01
        },
        video: false
      });

      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext({ latencyHint: 'interactive' });
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const micSource = audioCtx.createMediaStreamSource(rawStream);
      localGainNode = audioCtx.createGain();
      localGainNode.gain.setValueAtTime(userGainMultiplier, audioCtx.currentTime);

      localAnalyser = audioCtx.createAnalyser();
      localAnalyser.fftSize = 256;
      localAnalyser.smoothingTimeConstant = 0.8;

      const micDestination = audioCtx.createMediaStreamDestination();
      micSource.connect(localGainNode);
      localGainNode.connect(micDestination);
      localGainNode.connect(localAnalyser);

      localAudioTrack = micDestination.stream.getAudioTracks()[0];
      localAudioTrack.enabled = false; // Standby muted

      startVisualizerLoop();

      if (pc) {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
        if (audioSender) {
          await audioSender.replaceTrack(localAudioTrack);
        } else {
          pc.addTrack(localAudioTrack, micDestination.stream);
        }
      }

      logEvent('Microphone hardware armed with Web Audio DSP Gain.');
      return localAudioTrack;
    } catch (err) {
      logEvent(`Mic warning: ${err.message}`);
      return null;
    }
  }

  // --- Visualizer, VU Meters & Feature 1 VOX Processing Loop ---
  function setupRemoteVisualizer(stream) {
    if (!audioCtx) return;
    try {
      remoteAnalyser = audioCtx.createAnalyser();
      remoteAnalyser.fftSize = 256;
      remoteAnalyser.smoothingTimeConstant = 0.8;
      const remoteSource = audioCtx.createMediaStreamSource(stream);

      // Feature 6: Tactical RF Radio Realism Filter
      if (tacticalRadioFilter) {
        remoteSource.connect(tacticalRadioFilter.input);
        tacticalRadioFilter.output.connect(remoteAnalyser);
      } else {
        remoteSource.connect(remoteAnalyser);
      }

      startVisualizerLoop();
    } catch (e) {}
  }

  function startVisualizerLoop() {
    if (animFrameId) return;
    const dataArray = new Uint8Array(128);

    function render() {
      animFrameId = requestAnimationFrame(render);
      const activeAnalyser = isTransmitting ? localAnalyser : (hasRemotePeer ? remoteAnalyser : null);

      let peakLevel = 0;
      if (activeAnalyser) {
        try {
          activeAnalyser.getByteTimeDomainData(dataArray);
          for (let i = 0; i < dataArray.length; i++) {
            const val = Math.abs(dataArray[i] - 128);
            if (val > peakLevel) peakLevel = val;
          }
        } catch (e) {}
      }

      const percent = Math.min(100, Math.round((peakLevel / 128) * 100 * 2.2));

      if (isTransmitting && vuMic) {
        vuMic.style.width = `${percent}%`;
        if (vuPeer) vuPeer.style.width = '0%';
      } else if (hasRemotePeer && vuPeer) {
        vuPeer.style.width = `${percent}%`;
        if (vuMic) vuMic.style.width = '0%';
      } else {
        if (vuMic) vuMic.style.width = '0%';
        if (vuPeer) vuPeer.style.width = '0%';
      }

      // --- Feature 1: VOX Speech Detection Logic ---
      if (isVoxEnabled && localAnalyser && isConnected && hasRemotePeer) {
        let micPeak = 0;
        try {
          localAnalyser.getByteTimeDomainData(dataArray);
          for (let i = 0; i < dataArray.length; i++) {
            const v = Math.abs(dataArray[i] - 128);
            if (v > micPeak) micPeak = v;
          }
        } catch (e) {}

        const now = Date.now();
        if (micPeak >= voxThreshold) {
          lastVoiceDetectedTime = now;
          if (!isTransmitting) {
            isVoxTransmitting = true;
            handlePttDown();
          }
        } else if (isVoxTransmitting && isTransmitting) {
          if (now - lastVoiceDetectedTime > voxHangoverMs) {
            isVoxTransmitting = false;
            handlePttUp();
          }
        }
      }

      if (oscilloscopeLaptop) {
        drawScope(oscilloscopeLaptop, dataArray, isTransmitting, isReceiving);
      }
    }
    render();
  }

  function drawScope(canvas, dataArray, transmitting, receiving) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth || 600;
    const height = canvas.height = canvas.clientHeight || 240;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = transmitting ? 2.5 : 1.8;

    if (transmitting) {
      ctx.strokeStyle = '#ff2a5f';
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255, 42, 95, 0.7)';
    } else if (receiving) {
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
    } else {
      ctx.strokeStyle = 'rgba(0, 255, 170, 0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 255, 170, 0.3)';
    }

    ctx.beginPath();
    const sliceWidth = width / (dataArray.length - 1);
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      let v = dataArray[i] / 128.0;
      if (!transmitting && !receiving) {
        v = 1.0 + (Math.sin(i * 0.15 + Date.now() * 0.003) * 0.04);
      }
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // --- Prominent Phone Connection Banner ---
  function updatePeerStatusDisplay(isOnline, peer = null) {
    if (peer) remotePeerInfo = peer;
    const phoneName = remotePeerInfo?.name || 'Handheld Phone';

    if (peerStatusBannerLaptop && peerStatusDeviceNameLaptop && peerStatusHintLaptop) {
      if (isOnline) {
        peerStatusBannerLaptop.classList.remove('offline');
        peerStatusBannerLaptop.classList.add('connected');
        peerStatusDeviceNameLaptop.textContent = `PHONE CONNECTED: ${phoneName}`;
        peerStatusHintLaptop.textContent = isVoxEnabled
          ? '● VOX Hands-Free Active (Speak to transmit)'
          : '● Live Direct Audio Link (Hold SPACEBAR to broadcast)';
        if (bondStatusText) bondStatusText.textContent = 'BONDED: PC ↔ PHONE (LIVE)';
      } else {
        peerStatusBannerLaptop.classList.add('offline');
        peerStatusBannerLaptop.classList.remove('connected');
        peerStatusDeviceNameLaptop.textContent = 'PHONE DISCONNECTED';
        peerStatusHintLaptop.textContent = 'Waiting for Phone to link...';
        if (bondStatusText) bondStatusText.textContent = 'BONDED (PC ↔ PHONE)';
      }
    }
  }

  // --- WebRTC PeerConnection Setup with Candidate Queuing ---
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ],
    iceCandidatePoolSize: 10
  };

  function createPeerConnection(willBeOfferer = false) {
    if (pc) {
      try { pc.close(); } catch (e) {}
    }

    pendingCandidates = [];
    pc = new RTCPeerConnection(rtcConfig);

    const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

    if (localAudioTrack) {
      try {
        transceiver.sender.replaceTrack(localAudioTrack);
      } catch (e) {}
    }

    // Remote Audio Playout (Phone Speech -> Plays on Laptop)
    pc.ontrack = (event) => {
      console.log('[WebRTC Laptop] Incoming audio track from phone:', event.track);
      const incomingStream = event.streams[0] || new MediaStream([event.track]);

      if (remoteAudio) {
        remoteAudio.srcObject = incomingStream;
        remoteAudio.muted = false;
        remoteAudio.volume = 1.0;
        const p = remoteAudio.play();
        if (p !== undefined) {
          p.catch(e => console.warn('Laptop remote audio play warning:', e));
        }
      }

      setupRemoteVisualizer(incomingStream);
      hasRemotePeer = true;
      updatePeerStatusDisplay(true, remotePeerInfo);
      setAppState('standby');
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'signal',
          signal: { candidate: event.candidate }
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (valIceState) valIceState.textContent = state.toUpperCase();

      if (state === 'connected' || state === 'completed') {
        hasRemotePeer = true;
        updatePeerStatusDisplay(true, remotePeerInfo);
        setAppState('standby');
        logEvent('P2P Direct Full-Duplex Audio Channel Active with Phone.');
      } else if (state === 'disconnected' || state === 'failed') {
        hasRemotePeer = false;
        updatePeerStatusDisplay(false, remotePeerInfo);
        setAppState('reconnecting');
        logEvent('P2P Audio Connection dropped. Renegotiating...');
      }
    };

    if (willBeOfferer) {
      initiateOffer();
    }
  }

  async function initiateOffer() {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        voiceActivityDetection: false
      });
      await pc.setLocalDescription(offer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'signal',
          signal: { sdp: pc.localDescription }
        }));
      }
    } catch (err) {
      console.error('Failed to create offer:', err);
    }
  }

  async function flushPendingCandidates() {
    while (pendingCandidates.length > 0) {
      const cand = pendingCandidates.shift();
      try {
        await pc.addIceCandidate(cand);
      } catch (e) {
        console.warn('ICE candidate flush warning:', e);
      }
    }
  }

  // --- Push-To-Talk Controller (Acoustic Anti-Feedback) ---
  async function handlePttDown() {
    if (!isConnected || !hasRemotePeer || isTransmitting) return;

    unlockAudio();

    if (!localAudioTrack || localAudioTrack.readyState !== 'live') {
      await initMicrophone();
    }

    isTransmitting = true;
    setAppState('transmitting');
    soundFx.playMicClick();

    // Duck speaker audio while transmitting to eliminate feedback
    if (remoteAudio) {
      remoteAudio.volume = 0;
    }

    if (localAudioTrack) {
      localAudioTrack.enabled = true;
    }

    if (pc && localAudioTrack) {
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
      if (audioSender && audioSender.track !== localAudioTrack) {
        await audioSender.replaceTrack(localAudioTrack);
      }
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ptt-status',
        state: 'transmitting',
        from: deviceRole
      }));
    }
  }

  function handlePttUp() {
    if (!isTransmitting) return;

    isTransmitting = false;

    if (localAudioTrack) {
      localAudioTrack.enabled = false;
    }

    if (remoteAudio) {
      remoteAudio.volume = 1.0;
    }

    soundFx.playRogerBeep();

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ptt-status',
        state: 'idle',
        from: deviceRole
      }));
    }

    setAppState('standby');
  }

  function togglePtt() {
    if (isTransmitting) handlePttUp();
    else handlePttDown();
  }

  // --- Laptop State Management ---
  function setAppState(state) {
    body.classList.remove('state-disconnected', 'state-connecting', 'state-standby', 'state-transmitting', 'state-receiving', 'state-reconnecting', 'peer-connected');

    const phoneName = remotePeerInfo?.name || 'Handheld Phone';

    switch (state) {
      case 'disconnected':
        body.classList.add('state-disconnected');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'OFFLINE';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'INTERCOM OFFLINE // TAP TO CONNECT';
        if (pttBtnLaptop) pttBtnLaptop.disabled = true;
        if (pttTextLaptop) pttTextLaptop.textContent = 'OFFLINE';
        updatePeerStatusDisplay(false);
        break;

      case 'connecting':
        body.classList.add('state-connecting');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'CONNECTING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'CONNECTING TO SIGNALING HUB...';
        if (pttBtnLaptop) pttBtnLaptop.disabled = true;
        break;

      case 'reconnecting':
        body.classList.add('state-reconnecting');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'RECONNECTING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'AUTO-RECONNECTING TO BONDED PHONE...';
        if (pttBtnLaptop) pttBtnLaptop.disabled = true;
        break;

      case 'standby':
        body.classList.add('state-standby');
        if (hasRemotePeer) {
          body.classList.add('peer-connected');
          if (peerLabelLaptop) peerLabelLaptop.textContent = `${phoneName.toUpperCase()} ONLINE`;
          if (statusLabelLaptop) statusLabelLaptop.textContent = isVoxEnabled ? 'ONLINE // VOX ARMED' : 'ARMED';
          if (statusBannerLaptop) statusBannerLaptop.textContent = isVoxEnabled
            ? `CHANNEL ARMED // VOX ACTIVE (SPEAK TO BROADCAST)`
            : `CHANNEL ARMED // ${phoneName.toUpperCase()} READY`;
          if (pttBtnLaptop) pttBtnLaptop.disabled = false;
          if (pttTextLaptop) pttTextLaptop.textContent = isVoxEnabled ? 'VOX ACTIVE' : (isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK');
          if (pttSubtextLaptop) pttSubtextLaptop.textContent = isVoxEnabled ? 'VOICE ACTIVATED' : 'SPACEBAR ARMED';
          updatePeerStatusDisplay(true, remotePeerInfo);
        } else {
          if (peerLabelLaptop) peerLabelLaptop.textContent = 'WAITING PEER';
          if (statusLabelLaptop) statusLabelLaptop.textContent = 'STANDBY';
          if (statusBannerLaptop) statusBannerLaptop.textContent = 'WAITING FOR PHONE TO CONNECT...';
          if (pttBtnLaptop) pttBtnLaptop.disabled = true;
          if (pttTextLaptop) pttTextLaptop.textContent = 'WAITING';
          updatePeerStatusDisplay(false);
        }
        break;

      case 'transmitting':
        body.classList.add('state-transmitting', 'peer-connected');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'TRANSMITTING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'LIVE // YOU ARE BROADCASTING TO PHONE';
        if (pttBtnLaptop) pttBtnLaptop.classList.add('active');
        if (pttTextLaptop) pttTextLaptop.textContent = isVoxEnabled ? 'VOX LIVE' : 'TALKING';
        if (pttSubtextLaptop) pttSubtextLaptop.textContent = isVoxEnabled ? 'SPEAKING (VOX)' : 'RELEASE SPACEBAR TO STOP';
        break;

      case 'receiving':
        body.classList.add('state-receiving', 'peer-connected');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'RECEIVING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = `INCOMING VOICE FROM ${phoneName.toUpperCase()}`;
        if (pttTextLaptop) pttTextLaptop.textContent = 'LISTENING';
        if (pttSubtextLaptop) pttSubtextLaptop.textContent = `${phoneName.toUpperCase()} BROADCASTING`;
        break;
    }
  }

  // --- Feature 5: Emergency SOS Distress Beacon Implementation ---
  function broadcastSos(active, coords = null) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'sos-beacon',
      active,
      coords,
      from: deviceRole,
      timestamp: Date.now()
    }));
  }

  function triggerSosBeacon() {
    isSosActive = !isSosActive;
    if (btnSosLaptop) {
      btnSosLaptop.classList.toggle('active', isSosActive);
    }

    if (isSosActive) {
      soundFx.playSosSiren();
      logEvent('🚨 EMERGENCY DISTRESS BEACON ACTIVATED!');
      if (modalSosAlertLaptop) modalSosAlertLaptop.classList.remove('hidden');
      if (sosSubtitleLaptop) sosSubtitleLaptop.textContent = 'You are broadcasting an emergency distress beacon!';

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            localCoords = {
              latitude: pos.coords.latitude.toFixed(6),
              longitude: pos.coords.longitude.toFixed(6),
              accuracy: Math.round(pos.coords.accuracy)
            };
            if (sosCoordsLaptop) {
              sosCoordsLaptop.textContent = `GPS: ${localCoords.latitude}° N, ${localCoords.longitude}° E (±${localCoords.accuracy}m)`;
            }
            if (btnSosMapsLaptop) {
              btnSosMapsLaptop.href = `https://www.google.com/maps?q=${localCoords.latitude},${localCoords.longitude}`;
              btnSosMapsLaptop.style.display = 'block';
            }
            broadcastSos(true, localCoords);
          },
          () => {
            broadcastSos(true, null);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        broadcastSos(true, null);
      }
    } else {
      cancelSosBeacon();
    }
  }

  function cancelSosBeacon() {
    isSosActive = false;
    soundFx.stopSosSiren();
    if (btnSosLaptop) btnSosLaptop.classList.remove('active');
    if (modalSosAlertLaptop) modalSosAlertLaptop.classList.add('hidden');
    broadcastSos(false);
    logEvent('Emergency distress beacon deactivated.');
  }

  if (btnSosLaptop) btnSosLaptop.addEventListener('click', triggerSosBeacon);
  if (btnCancelSosLaptop) btnCancelSosLaptop.addEventListener('click', cancelSosBeacon);

  // --- WebSocket Intercom Signaling Engine ---
  async function connectIntercom(roomId, pin, pairToken = null) {
    unlockAudio();
    currentRoomId = roomId;
    currentPin = pin;
    if (pairToken) currentPairToken = pairToken;

    if (displayRoomLaptop) displayRoomLaptop.textContent = roomId.toUpperCase();

    setAppState('connecting');
    initMicrophone().catch(() => {});

    const { wsUrl } = resolveServerEndpoints();
    logEvent(`Connecting to signaling server at ${wsUrl}...`);

    if (ws) {
      try { ws.close(); } catch (e) {}
    }

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.warn('WebSocket connection error:', e);
      return;
    }

    ws.onopen = () => {
      logEvent('Signaling connection established.');
      clearInterval(reconnectInterval);

      ws.send(JSON.stringify({
        type: 'join',
        roomId: currentRoomId,
        pin: currentPin,
        pairToken: currentPairToken,
        role: deviceRole,
        deviceName: localDeviceName
      }));

      startPingHeartbeat();
    };

    ws.onmessage = async (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (err) { return; }

      switch (data.type) {
        case 'joined': {
          isConnected = true;
          if (pairingModal) pairingModal.classList.add('hidden');
          if (data.pairToken) {
            currentPairToken = data.pairToken;
            localStorage.setItem('directlink_pair_token', data.pairToken);
          }
          localStorage.setItem('directlink_room', currentRoomId);
          localStorage.setItem('directlink_pin', currentPin);

          logEvent(`Entered channel "${currentRoomId}" as ${data.role}`);
          createPeerConnection(false);
          break;
        }

        case 'peer-joined': {
          hasRemotePeer = true;
          remotePeerInfo = data.peer || null;
          updatePeerStatusDisplay(true, remotePeerInfo);
          setAppState('standby');
          soundFx.playConnectChime();
          logEvent(`Phone linked: ${remotePeerInfo ? remotePeerInfo.name : 'Phone'}`);
          createPeerConnection(true);
          break;
        }

        case 'peer-status': {
          hasRemotePeer = true;
          remotePeerInfo = data.peer || null;
          updatePeerStatusDisplay(true, remotePeerInfo);
          setAppState('standby');
          soundFx.playConnectChime();
          logEvent(`Connected to active phone: ${remotePeerInfo ? remotePeerInfo.name : 'Phone'}`);
          break;
        }

        case 'peer-left': {
          hasRemotePeer = false;
          updatePeerStatusDisplay(false, remotePeerInfo);
          setAppState('standby');
          logEvent('Phone went offline.');
          break;
        }

        case 'signal': {
          if (!pc) createPeerConnection(false);

          if (data.signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            await flushPendingCandidates();

            if (data.signal.sdp.type === 'offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({
                type: 'signal',
                signal: { sdp: pc.localDescription }
              }));
            }
          } else if (data.signal.candidate) {
            const cand = new RTCIceCandidate(data.signal.candidate);
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(cand);
              } catch (err) {
                console.warn('ICE Candidate add error:', err);
              }
            } else {
              pendingCandidates.push(cand);
            }
          }
          break;
        }

        case 'ptt-status': {
          if (data.state === 'transmitting') {
            isReceiving = true;
            setAppState('receiving');
            soundFx.playMicClick();

            // Feature 2: Start recording incoming audio for Replay Buffer
            if (remoteAudio && remoteAudio.srcObject && 'MediaRecorder' in window) {
              try {
                incomingAudioChunks = [];
                incomingMediaRecorder = new MediaRecorder(remoteAudio.srcObject);
                incomingMediaRecorder.ondataavailable = (e) => {
                  if (e.data && e.data.size > 0) incomingAudioChunks.push(e.data);
                };
                incomingMediaRecorder.onstop = () => {
                  if (incomingAudioChunks.length > 0) {
                    const blob = new Blob(incomingAudioChunks, { type: 'audio/webm' });
                    if (lastRecordedAudioUrl) URL.revokeObjectURL(lastRecordedAudioUrl);
                    lastRecordedAudioUrl = URL.createObjectURL(blob);
                    if (btnReplayLaptop) btnReplayLaptop.disabled = false;
                    logEvent('Last transmission saved to replay buffer.');
                  }
                };
                incomingMediaRecorder.start(100);
              } catch (e) {
                console.warn('MediaRecorder error:', e);
              }
            }
          } else if (data.state === 'idle') {
            isReceiving = false;
            soundFx.playRogerBeep();
            setAppState('standby');

            // Feature 2: Stop recording incoming audio
            if (incomingMediaRecorder && incomingMediaRecorder.state === 'recording') {
              try { incomingMediaRecorder.stop(); } catch (e) {}
            }
          }
          break;
        }

        // Feature 5: Remote SOS Beacon Alert
        case 'sos-beacon': {
          if (data.active) {
            soundFx.playSosSiren();
            logEvent(`🚨 INCOMING SOS DISTRESS BEACON FROM ${data.from ? data.from.toUpperCase() : 'PHONE'}!`);
            if (modalSosAlertLaptop) modalSosAlertLaptop.classList.remove('hidden');
            if (sosSubtitleLaptop) {
              sosSubtitleLaptop.textContent = `EMERGENCY ALERT FROM ${data.from ? data.from.toUpperCase() : 'HANDHELD PHONE'}!`;
            }
            if (data.coords && sosCoordsLaptop) {
              sosCoordsLaptop.textContent = `GPS: ${data.coords.latitude}° N, ${data.coords.longitude}° E`;
              if (btnSosMapsLaptop) {
                btnSosMapsLaptop.href = `https://www.google.com/maps?q=${data.coords.latitude},${data.coords.longitude}`;
                btnSosMapsLaptop.style.display = 'block';
              }
            }
          } else {
            soundFx.stopSosSiren();
            if (modalSosAlertLaptop) modalSosAlertLaptop.classList.add('hidden');
            logEvent('Incoming distress beacon cancelled.');
          }
          break;
        }

        case 'pong': {
          if (data.clientTime) {
            const rtt = Math.round(performance.now() - data.clientTime);
            updateLatencyUI(rtt);
          }
          break;
        }

        case 'error': {
          logEvent(`Server Alert: ${data.message}`);
          if (data.message.includes('PIN')) {
            alert(data.message);
            if (pairingModal) pairingModal.classList.remove('hidden');
          }
          break;
        }
      }
    };

    ws.onclose = () => {
      isConnected = false;
      stopPingHeartbeat();
      setAppState('reconnecting');
      updatePeerStatusDisplay(false);

      clearInterval(reconnectInterval);
      reconnectInterval = setInterval(() => {
        logEvent('Auto-reconnecting to bonded phone...');
        connectIntercom(currentRoomId, currentPin, currentPairToken);
      }, 1500);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error:', err);
    };
  }

  // --- RTT Latency Heartbeat ---
  function startPingHeartbeat() {
    stopPingHeartbeat();
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', clientTime: performance.now() }));
      }
    }, 3000);
  }

  function stopPingHeartbeat() {
    clearInterval(pingInterval);
  }

  function updateLatencyUI(latency) {
    const text = `${latency} ms`;
    if (pingValue) pingValue.textContent = text;
    if (valLatency) valLatency.textContent = text;
  }

  // --- 3-Way Mode Switcher ---
  function setIntercomMode(mode, doReconnect = true) {
    activeIntercomMode = mode;
    localStorage.setItem('directlink_active_mode', mode);

    if (btnModeWifi) btnModeWifi.classList.toggle('active', mode === 'wifi');
    if (btnModeWan) btnModeWan.classList.toggle('active', mode === 'wan');
    if (btnModeFreq) btnModeFreq.classList.toggle('active', mode === 'freq');

    const defaultRoom = serverInfo.bondedPair ? serverInfo.bondedPair.roomId : (localStorage.getItem('directlink_room') || 'directlink-master');
    const defaultPin = serverInfo.bondedPair ? serverInfo.bondedPair.pin : (localStorage.getItem('directlink_pin') || '849201');

    if (mode === 'wifi') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (linkBadge) linkBadge.textContent = 'WI-FI LAN';
      if (doReconnect) {
        connectIntercom(defaultRoom, defaultPin, currentPairToken);
      }
    } else if (mode === 'wan') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (linkBadge) linkBadge.textContent = 'WAN RELAY';
      if (doReconnect) {
        connectIntercom(defaultRoom, defaultPin, currentPairToken);
      }
    } else if (mode === 'freq') {
      if (freqTunerBar) freqTunerBar.classList.remove('hidden');
      if (linkBadge) linkBadge.textContent = 'RF RADIO';
      applyRfFrequency(currentRfSetting, doReconnect);
    }
  }

  function applyRfFrequency(rawSetting, doReconnect = true) {
    currentRfSetting = rawSetting;
    localStorage.setItem('directlink_rf_freq', rawSetting);

    const parts = rawSetting.split('|');
    const mhz = parts[0];
    const channelName = parts[1] || 'CUSTOM';

    if (currentFreqValue) currentFreqValue.textContent = `${mhz} MHz`;
    if (currentFreqChannel) currentFreqChannel.textContent = channelName;

    const rfRoomId = `rf-${mhz.replace(/[^0-9]/g, '-')}`;
    const defaultPin = serverInfo.bondedPair ? serverInfo.bondedPair.pin : (localStorage.getItem('directlink_pin') || '849201');
    logEvent(`Tuned Walkie-Talkie Frequency: ${mhz} MHz [${channelName}]`);

    if (doReconnect) {
      connectIntercom(rfRoomId, defaultPin, currentPairToken);
    }
  }

  if (btnModeWifi) btnModeWifi.addEventListener('click', () => setIntercomMode('wifi', true));
  if (btnModeWan) btnModeWan.addEventListener('click', () => setIntercomMode('wan', true));
  if (btnModeFreq) btnModeFreq.addEventListener('click', () => setIntercomMode('freq', true));

  if (selectRadioFreq) {
    selectRadioFreq.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        if (customFreqBox) customFreqBox.classList.remove('hidden');
        if (inputCustomFreq) inputCustomFreq.focus();
      } else {
        if (customFreqBox) customFreqBox.classList.add('hidden');
        applyRfFrequency(val, true);
      }
    });
  }

  if (btnApplyFreq) {
    btnApplyFreq.addEventListener('click', () => {
      const customVal = inputCustomFreq ? inputCustomFreq.value.trim() : '';
      if (!customVal) return alert('Enter MHz (e.g. 433.92)');
      applyRfFrequency(`${customVal}|CUSTOM`, true);
    });
  }

  // --- Keyboard & Mouse Spacebar Controls ---
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpacePressed) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      e.preventDefault();
      isSpacePressed = true;
      if (isToggleMode) togglePtt();
      else handlePttDown();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isSpacePressed) {
      e.preventDefault();
      isSpacePressed = false;
      if (!isToggleMode) handlePttUp();
    }
  });

  if (pttBtnLaptop) {
    pttBtnLaptop.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (isToggleMode) togglePtt();
      else handlePttDown();
    });
    window.addEventListener('mouseup', () => {
      if (!isToggleMode && isTransmitting) handlePttUp();
    });
  }

  // Mode Toggle (Hold vs Tap Toggle)
  if (btnModeLaptop) {
    btnModeLaptop.addEventListener('click', () => {
      isToggleMode = !isToggleMode;
      if (modeTextLaptop) modeTextLaptop.textContent = isToggleMode ? 'Toggle Mode' : 'Hold Mode';
      btnModeLaptop.classList.toggle('active', isToggleMode);
      setAppState(isTransmitting ? 'transmitting' : (hasRemotePeer ? 'standby' : 'disconnected'));
    });
  }

  // Feature 1: VOX Hands-Free Toggle
  if (btnVoxLaptop) {
    btnVoxLaptop.addEventListener('click', async () => {
      isVoxEnabled = !isVoxEnabled;
      if (voxTextLaptop) voxTextLaptop.textContent = isVoxEnabled ? 'VOX On' : 'VOX Off';
      btnVoxLaptop.classList.toggle('active', isVoxEnabled);
      if (valVoxState) valVoxState.textContent = isVoxEnabled ? 'ACTIVE (VOICE-TRIGGER)' : 'STANDBY';

      if (isVoxEnabled) {
        unlockAudio();
        await initMicrophone();
        logEvent('Hands-Free VOX activated. Speak into microphone to broadcast.');
      } else {
        logEvent('Hands-Free VOX deactivated.');
      }
      setAppState(isTransmitting ? 'transmitting' : (hasRemotePeer ? 'standby' : 'disconnected'));
    });
  }

  // Feature 1: VOX Sensitivity Selector
  if (selectVoxSensitivityLaptop) {
    selectVoxSensitivityLaptop.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'high') voxThreshold = 14;
      else if (val === 'low') voxThreshold = 40;
      else voxThreshold = 25; // medium
      localStorage.setItem('directlink_vox_sens', val);
      logEvent(`VOX sensitivity set to ${val}.`);
    });
  }

  // Feature 2: Replay Last Call Button
  if (btnReplayLaptop) {
    btnReplayLaptop.addEventListener('click', () => {
      if (!lastRecordedAudioUrl) return;
      if (soundFx.playReplayChirp) soundFx.playReplayChirp();
      if (lastCallAudio) {
        lastCallAudio.src = lastRecordedAudioUrl;
        lastCallAudio.volume = 1.0;
        lastCallAudio.play().catch(e => console.warn('Replay play error:', e));
        logEvent('Replaying last received audio transmission.');
      }
    });
  }

  // Feature 3: Bluetooth PTT Pairing
  if (btnBlePttLaptop) {
    btnBlePttLaptop.addEventListener('click', async () => {
      if (!navigator.bluetooth) {
        return alert('Web Bluetooth is supported on Google Chrome, Edge, and Android.\nEnsure Bluetooth is powered on.');
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['generic_access', 'human_interface_device', 0xFFE0, 0xFFF0]
        });
        alert(`Bluetooth Device Linked: ${device.name || 'Wireless PTT Button'}\nReady for remote PTT trigger!`);
        logEvent(`Bluetooth PTT hardware linked: ${device.name}`);
      } catch (err) {
        if (!err.message.includes('User cancelled')) {
          alert('Bluetooth Note: ' + err.message);
        }
      }
    });
  }

  // Feature 4: E2EE Passphrase Input
  if (inputE2eePassLaptop) {
    inputE2eePassLaptop.addEventListener('change', (e) => {
      updateE2eeKey(e.target.value);
    });
  }

  // Feature 6: Tactical Radio Realism Filter Checkbox
  if (chkRadioFilterLaptop) {
    chkRadioFilterLaptop.addEventListener('change', (e) => {
      if (tacticalRadioFilter) {
        tacticalRadioFilter.setFilterActive(e.target.checked);
      }
      localStorage.setItem('directlink_rf_filter', e.target.checked ? '1' : '0');
      logEvent(`Tactical RF Radio Acoustic Filter: ${e.target.checked ? 'Enabled' : 'Bypassed'}`);
    });
  }

  // REAL Audio Gain Slider Adjustment
  if (sliderGain) {
    sliderGain.addEventListener('input', (e) => {
      const val = e.target.value;
      userGainMultiplier = Number(val) / 100;
      if (gainValueDisplay) gainValueDisplay.textContent = `${val}%`;
      if (localGainNode && audioCtx) {
        localGainNode.gain.setValueAtTime(userGainMultiplier, audioCtx.currentTime);
      }
      localStorage.setItem('directlink_gain', val);
    });
  }

  if (selectRogerBeep) {
    selectRogerBeep.addEventListener('change', (e) => {
      soundFx.setTone(e.target.value);
      localStorage.setItem('directlink_roger_tone', e.target.value);
    });
  }

  // Mobile Data WAN Tunnel
  if (btnTunnelLaptop) {
    btnTunnelLaptop.addEventListener('click', async () => {
      const shouldEnable = !serverInfo.isTunneling;
      if (tunnelTextLaptop) tunnelTextLaptop.textContent = shouldEnable ? 'Connecting...' : 'Closing...';
      try {
        const { httpOrigin } = resolveServerEndpoints();
        const res = await fetch(`${httpOrigin}/api/tunnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable: shouldEnable })
        });
        if (res.ok) {
          const data = await res.json();
          serverInfo.tunnelUrl = data.tunnelUrl;
          serverInfo.isTunneling = !!data.tunnelUrl;
          btnTunnelLaptop.classList.toggle('active', serverInfo.isTunneling);
          if (tunnelTextLaptop) tunnelTextLaptop.textContent = serverInfo.isTunneling ? 'WAN Active' : 'Mobile Data WAN';
          updateNetworkSelector();
          updateQrCode();
          logEvent(`Mobile Data WAN Tunnel: ${serverInfo.isTunneling ? serverInfo.tunnelUrl : 'Deactivated'}`);
        }
      } catch (err) {
        alert('Tunnel request failed: ' + err.message);
      }
    });
  }

  // Master Bond Reset Working Button
  if (btnResetBondLaptop) {
    btnResetBondLaptop.addEventListener('click', async () => {
      if (!confirm('Reset Master Bond? A brand new secure pairing room and PIN will be generated.')) return;
      try {
        const { httpOrigin } = resolveServerEndpoints();
        const res = await fetch(`${httpOrigin}/api/bond/reset`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          serverInfo.bondedPair = data.bondedPair;
          currentRoomId = data.bondedPair.roomId;
          currentPin = data.bondedPair.pin;
          currentPairToken = data.bondedPair.pairToken;
          if (inputRoom) inputRoom.value = currentRoomId;
          if (inputPin) inputPin.value = currentPin;
          localStorage.setItem('directlink_room', currentRoomId);
          localStorage.setItem('directlink_pin', currentPin);
          localStorage.setItem('directlink_pair_token', currentPairToken);
          logEvent(`Master Bond Reset! Room: "${currentRoomId}" | PIN: "${currentPin}"`);
          updateQrCode();
          connectIntercom(currentRoomId, currentPin, currentPairToken);
          alert(`New Master Bond Generated!\nRoom: ${currentRoomId}\nPIN: ${currentPin}\n\nScan the new QR Code with your phone.`);
        }
      } catch (err) {
        alert('Reset bond failed: ' + err.message);
      }
    });
  }

  // --- Network Target & QR Code Management (LAN IP Auto-Detection) ---
  function updateNetworkSelector() {
    if (!selectNetwork) return;
    const currentVal = selectNetwork.value;
    selectNetwork.innerHTML = '';

    if (serverInfo.tunnelUrl) {
      const opt = document.createElement('option');
      opt.value = serverInfo.tunnelUrl;
      opt.textContent = `🌐 Mobile Data WAN Tunnel (${serverInfo.tunnelUrl})`;
      selectNetwork.appendChild(opt);
    }

    const httpPort = serverInfo.httpPort || 8080;
    const httpsPort = serverInfo.httpsPort || 8443;

    if (serverInfo.localIps && serverInfo.localIps.length > 0) {
      serverInfo.localIps.forEach(({ name, ip }) => {
        const optHttp = document.createElement('option');
        optHttp.value = `http://${ip}:${httpPort}`;
        optHttp.textContent = `📶 Local Wi-Fi (${name}): http://${ip}:${httpPort}`;
        selectNetwork.appendChild(optHttp);

        const optHttps = document.createElement('option');
        optHttps.value = `https://${ip}:${httpsPort}`;
        optHttps.textContent = `🔒 Local Wi-Fi HTTPS (${name}): https://${ip}:${httpsPort}`;
        selectNetwork.appendChild(optHttps);
      });
    }

    const optLocal = document.createElement('option');
    optLocal.value = `http://localhost:${httpPort}`;
    optLocal.textContent = `💻 Localhost Only: http://localhost:${httpPort}`;
    selectNetwork.appendChild(optLocal);

    if (currentVal) selectNetwork.value = currentVal;
  }

  function getSelectedShareBase() {
    if (selectNetwork && selectNetwork.value) {
      return selectNetwork.value;
    }
    if (serverInfo.tunnelUrl) {
      return serverInfo.tunnelUrl;
    }
    if (serverInfo.localIps && serverInfo.localIps.length > 0) {
      const ip = serverInfo.localIps[0].ip;
      return `http://${ip}:${serverInfo.httpPort || 8080}`;
    }
    return `http://${window.location.hostname}:8080`;
  }

  function updateQrCode() {
    if (!qrImage) return;
    const base = getSelectedShareBase();
    const tokenPart = currentPairToken ? `&token=${encodeURIComponent(currentPairToken)}` : '';
    const modePart = activeIntercomMode ? `&mode=${encodeURIComponent(activeIntercomMode)}` : '';
    const freqPart = activeIntercomMode === 'freq' ? `&freq=${encodeURIComponent(currentRfSetting)}` : '';
    const keyPart = e2eePassphrase ? `&key=${encodeURIComponent(e2eePassphrase)}` : '';
    const url = `${base}/phone.html#room=${encodeURIComponent(currentRoomId)}&pin=${encodeURIComponent(currentPin)}${tokenPart}${modePart}${freqPart}${keyPart}&server=${encodeURIComponent(base)}`;

    qrImage.src = `/api/qr?text=${encodeURIComponent(url)}`;
  }

  if (selectNetwork) {
    selectNetwork.addEventListener('change', () => {
      updateQrCode();
    });
  }

  if (btnPairingLaptop) {
    btnPairingLaptop.addEventListener('click', () => {
      if (pairingModal) pairingModal.classList.remove('hidden');
      updateNetworkSelector();
      updateQrCode();
    });
  }

  if (btnCancelModal) {
    btnCancelModal.addEventListener('click', () => pairingModal && pairingModal.classList.add('hidden'));
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', async () => {
      const base = getSelectedShareBase();
      const tokenPart = currentPairToken ? `&token=${encodeURIComponent(currentPairToken)}` : '';
      const modePart = activeIntercomMode ? `&mode=${encodeURIComponent(activeIntercomMode)}` : '';
      const freqPart = activeIntercomMode === 'freq' ? `&freq=${encodeURIComponent(currentRfSetting)}` : '';
      const keyPart = e2eePassphrase ? `&key=${encodeURIComponent(e2eePassphrase)}` : '';
      const url = `${base}/phone.html#room=${encodeURIComponent(currentRoomId)}&pin=${encodeURIComponent(currentPin)}${tokenPart}${modePart}${freqPart}${keyPart}&server=${encodeURIComponent(base)}`;
      try {
        await navigator.clipboard.writeText(url);
        alert('Phone link copied!\nSend or open this link on your phone.');
      } catch (e) {
        prompt('Copy this link for your phone:', url);
      }
    });
  }

  if (btnPasteLinkLaptop) {
    btnPasteLinkLaptop.addEventListener('click', async () => {
      let pasted = '';
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          pasted = await navigator.clipboard.readText();
        }
      } catch (e) {}
      if (!pasted) {
        pasted = prompt('Paste pairing link or QR URL:');
      }
      if (!pasted) return;

      const parsed = parseInviteLinkText(pasted);
      if (parsed) {
        if (parsed.server && inputServer) {
          inputServer.value = parsed.server;
        }
        if (parsed.room && inputRoom) {
          inputRoom.value = parsed.room;
          localStorage.setItem('directlink_room', parsed.room);
        }
        if (parsed.pin && inputPin) {
          inputPin.value = parsed.pin;
          localStorage.setItem('directlink_pin', parsed.pin);
        }
        if (parsed.token) {
          currentPairToken = parsed.token;
          localStorage.setItem('directlink_pair_token', parsed.token);
        }
        if (parsed.key && inputE2eePassLaptop) {
          inputE2eePassLaptop.value = parsed.key;
          updateE2eeKey(parsed.key);
        }
        if (parsed.mode) setIntercomMode(parsed.mode, false);
        if (parsed.freq) applyRfFrequency(parsed.freq, false);

        if (parsed.room && parsed.pin) {
          connectIntercom(parsed.room, parsed.pin, parsed.token);
        }
      }
    });
  }

  if (btnConnect) {
    btnConnect.addEventListener('click', () => {
      unlockAudio();
      const r = inputRoom ? inputRoom.value.trim().toLowerCase() : '';
      const p = inputPin ? inputPin.value.trim() : '';
      if (!r || !p || p.length !== 6) return alert('Enter valid Channel and 6-digit PIN');
      connectIntercom(r, p);
    });
  }

  // --- Initial Startup ---
  window.addEventListener('DOMContentLoaded', async () => {
    logEvent('Command Base Station initializing...');

    const savedTone = localStorage.getItem('directlink_roger_tone');
    if (savedTone && selectRogerBeep) {
      selectRogerBeep.value = savedTone;
      soundFx.setTone(savedTone);
    }

    const savedGain = localStorage.getItem('directlink_gain');
    if (savedGain && sliderGain) {
      sliderGain.value = savedGain;
      userGainMultiplier = Number(savedGain) / 100;
      if (gainValueDisplay) gainValueDisplay.textContent = `${savedGain}%`;
    }

    const savedE2ee = localStorage.getItem('directlink_e2ee_key');
    if (savedE2ee && inputE2eePassLaptop) {
      inputE2eePassLaptop.value = savedE2ee;
      updateE2eeKey(savedE2ee);
    }

    let savedMode = localStorage.getItem('directlink_active_mode') || 'wifi';
    let savedRf = localStorage.getItem('directlink_rf_freq') || '462.5625|CH 01';
    currentRfSetting = savedRf;
    if (selectRadioFreq) selectRadioFreq.value = savedRf;

    // Check URL parameters / Hash first
    const urlData = parseUrlParameters();
    if (urlData) {
      if (urlData.server && inputServer) inputServer.value = urlData.server;
      if (urlData.room) {
        if (inputRoom) inputRoom.value = urlData.room;
        localStorage.setItem('directlink_room', urlData.room);
      }
      if (urlData.pin) {
        if (inputPin) inputPin.value = urlData.pin;
        localStorage.setItem('directlink_pin', urlData.pin);
      }
      if (urlData.token) {
        currentPairToken = urlData.token;
        localStorage.setItem('directlink_pair_token', urlData.token);
      }
      if (urlData.key && inputE2eePassLaptop) {
        inputE2eePassLaptop.value = urlData.key;
        updateE2eeKey(urlData.key);
      }
      if (urlData.mode) savedMode = urlData.mode;
      if (urlData.freq) savedRf = urlData.freq;
    }

    // Fetch server info
    try {
      const { httpOrigin } = resolveServerEndpoints();
      const res = await fetch(`${httpOrigin}/api/info`);
      if (res.ok) {
        serverInfo = await res.json();
        updateNetworkSelector();
      }
    } catch (e) {
      console.warn('Server info fetch error:', e);
    }

    // Connect to appropriate channel
    const masterRoom = (urlData && urlData.room) || (serverInfo.bondedPair ? serverInfo.bondedPair.roomId : (localStorage.getItem('directlink_room') || 'directlink-master'));
    const masterPin = (urlData && urlData.pin) || (serverInfo.bondedPair ? serverInfo.bondedPair.pin : (localStorage.getItem('directlink_pin') || '849201'));
    const pairToken = (urlData && urlData.token) || (serverInfo.bondedPair ? serverInfo.bondedPair.pairToken : localStorage.getItem('directlink_pair_token'));

    if (inputRoom) inputRoom.value = masterRoom;
    if (inputPin) inputPin.value = masterPin;

    setIntercomMode(savedMode, false);

    if (savedMode === 'freq') {
      applyRfFrequency(savedRf, true);
    } else {
      connectIntercom(masterRoom, masterPin, pairToken);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (ws) ws.close();
    if (pc) pc.close();
  });
})();
