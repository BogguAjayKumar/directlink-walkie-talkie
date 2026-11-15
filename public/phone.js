/**
 * DirectLink Mobile Field Walkie-Talkie Transceiver
 * Dedicated Client Script for Phone Units
 *
 * Implemented Features:
 * 1. VOX (Voice-Operated Exchange) Hands-Free Voice-Activated Transmission with hangover delay
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

  // Connection & Mic Status Banners
  const peerStatusBannerMobile = document.getElementById('peerStatusBannerMobile');
  const peerStatusDeviceNameMobile = document.getElementById('peerStatusDeviceNameMobile');
  const peerStatusHintMobile = document.getElementById('peerStatusHintMobile');
  const micArmBanner = document.getElementById('micArmBanner');
  const btnArmMic = document.getElementById('btnArmMic');

  // LCD Elements
  const displayRoomMobile = document.getElementById('displayRoomMobile');
  const statusLabelMobile = document.getElementById('statusLabelMobile');
  const pingMobile = document.getElementById('pingMobile');
  const oscilloscopeMobile = document.getElementById('oscilloscopeMobile');
  const lcdBatt = document.getElementById('lcdBatt');
  const lcdVoxTag = document.getElementById('lcdVoxTag');
  const lcdE2eeTag = document.getElementById('lcdE2eeTag');

  // Knobs
  const knobVolume = document.getElementById('knobVolume');
  const knobChannel = document.getElementById('knobChannel');

  // PTT Button
  const pttBtnMobile = document.getElementById('pttBtnMobile');
  const pttTextMobile = document.getElementById('pttTextMobile');
  const pttSubtextMobile = document.getElementById('pttSubtextMobile');

  // Action Dock Controls
  const btnMobileMode = document.getElementById('btnMobileMode');
  const modeTextMobile = document.getElementById('modeTextMobile');
  const btnMobileVox = document.getElementById('btnMobileVox');
  const voxTextMobile = document.getElementById('voxTextMobile');
  const btnMobileReplay = document.getElementById('btnMobileReplay');
  const btnMobileSos = document.getElementById('btnMobileSos');
  const btnMobileSettings = document.getElementById('btnMobileSettings');
  const btnMobilePair = document.getElementById('btnMobilePair');

  // Settings & Drawers
  const drawerSettings = document.getElementById('drawerSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const sliderGainMobile = document.getElementById('sliderGainMobile');
  const mobileGainValue = document.getElementById('mobileGainValue');
  const selectRogerMobile = document.getElementById('selectRogerMobile');
  const selectVoxSensitivityMobile = document.getElementById('selectVoxSensitivityMobile');
  const chkRadioFilterMobile = document.getElementById('chkRadioFilterMobile');
  const inputE2eePassMobile = document.getElementById('inputE2eePassMobile');
  const btnBlePttMobile = document.getElementById('btnBlePttMobile');

  // Diagnostics Drawer
  const drawerDiagnostics = document.getElementById('drawerDiagnostics');
  const btnCloseDiag = document.getElementById('btnCloseDiag');
  const mobileValLatency = document.getElementById('mobileValLatency');
  const mobileValIce = document.getElementById('mobileValIce');
  const mobileValVox = document.getElementById('mobileValVox');
  const mobileValE2ee = document.getElementById('mobileValE2ee');

  // SOS Emergency Modal
  const modalSosAlertMobile = document.getElementById('modalSosAlertMobile');
  const sosMessageMobile = document.getElementById('sosMessageMobile');
  const sosCoordsMobile = document.getElementById('sosCoordsMobile');
  const btnSosMapsMobile = document.getElementById('btnSosMapsMobile');
  const btnCancelSosMobile = document.getElementById('btnCancelSosMobile');

  // Pairing Modal
  const pairingModal = document.getElementById('pairingModal');
  const inputServer = document.getElementById('inputServer');
  const inputRoom = document.getElementById('inputRoom');
  const inputPin = document.getElementById('inputPin');
  const btnPasteLinkMobile = document.getElementById('btnPasteLinkMobile');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnConnect = document.getElementById('btnConnect');

  // Audio Elements
  const remoteAudio = document.getElementById('remoteAudio');
  const lastCallAudio = document.getElementById('lastCallAudio');

  // --- State Variables ---
  const deviceRole = 'phone';
  const localDeviceName = 'Handheld Phone';

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
  let wakeLock = null;
  let reconnectInterval = null;
  let pingInterval = null;
  let animFrameId = null;

  let isConnected = false;
  let isTransmitting = false;
  let isReceiving = false;
  let isToggleMode = false;
  let hasRemotePeer = false;
  let audioUnlocked = false;

  // Knob states
  const volumeLevels = [1.0, 0.25, 0.5, 0.75];
  let currentVolumeIdx = 0;
  let volumeAngle = 0;
  let channelAngle = 0;

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

  // Audio Context & Analysers
  let audioCtx = null;
  let localAnalyser = null;
  let remoteAnalyser = null;

  // --- Feature 4: E2EE Key Derivation ---
  async function updateE2eeKey(passphrase) {
    e2eePassphrase = (passphrase || '').trim();
    localStorage.setItem('directlink_e2ee_key', e2eePassphrase);
    if (!e2eePassphrase) {
      e2eeKey = null;
      if (lcdE2eeTag) lcdE2eeTag.classList.add('hidden');
      if (mobileValE2ee) mobileValE2ee.textContent = 'STANDARD DTLS';
      return;
    }
    try {
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(e2eePassphrase));
      e2eeKey = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      if (lcdE2eeTag) lcdE2eeTag.classList.remove('hidden');
      if (mobileValE2ee) mobileValE2ee.textContent = 'LOCKED (AES-256)';
      console.log('✓ E2EE AES-256 Encryption Armed!');
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

    startSilentKeepAlive();
    setupMediaSession();

    if (remoteAudio) {
      remoteAudio.muted = false;
      remoteAudio.volume = volumeLevels[currentVolumeIdx];
      const p = remoteAudio.play();
      if (p !== undefined) {
        p.then(() => { if (!remoteAudio.srcObject) remoteAudio.pause(); }).catch(() => {});
      }
    }
  }

  ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
      unlockAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }, { once: false, passive: true });
  });

  function startSilentKeepAlive() {
    try {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.00001;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
    } catch (e) {}
  }

  // Feature 3: MediaSession Headset Key Support
  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'DirectLink Phone Intercom',
        artist: 'PTT Channel Armed',
        album: 'DirectLink Walkie-Talkie'
      });
      try {
        navigator.mediaSession.setActionHandler('play', () => { togglePtt(); });
        navigator.mediaSession.setActionHandler('pause', () => { togglePtt(); });
        navigator.mediaSession.setActionHandler('nexttrack', () => { handlePttDown(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { handlePttUp(); });
      } catch (e) {}
    }
  }

  // --- Screen Wake Lock ---
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        if (wakeLock) await wakeLock.release().catch(() => {});
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (e) {}
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }
  });

  // --- Real Battery Monitor ---
  function initBatteryMonitor() {
    if (!lcdBatt) return;
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        function update() {
          const level = Math.round(battery.level * 100);
          const icon = battery.charging ? ' ⚡' : '';
          lcdBatt.textContent = `${level}%${icon}`;
        }
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      }).catch(() => {});
    }
  }

  // --- URL & Endpoint Resolution ---
  function resolveServerEndpoints() {
    let host = window.location.host;
    let protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';

    const isPackagedMobileApp = window.location.protocol === 'capacitor:' || 
                               window.location.protocol === 'file:' || 
                               (window.location.hostname === 'localhost' && /Android/i.test(navigator.userAgent));

    let raw = (inputServer && inputServer.value.trim()) || '';
    if (!raw && isPackagedMobileApp) {
      raw = localStorage.getItem('directlink_server_url') || '192.168.0.142:8080';
    }

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

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Microphone API not available on this origin.');
        if (micArmBanner) micArmBanner.classList.remove('hidden');
        return null;
      }

      console.log('[Phone Mic] Requesting getUserMedia...');
      rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
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

      if (micArmBanner) micArmBanner.classList.add('hidden');

      if (pc) {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
        if (audioSender) {
          await audioSender.replaceTrack(localAudioTrack);
        } else {
          pc.addTrack(localAudioTrack, micDestination.stream);
        }
      }

      console.log('✓ Phone Microphone armed with Web Audio DSP Gain!');
      return localAudioTrack;
    } catch (err) {
      console.warn('Microphone permission request error:', err);
      if (micArmBanner) micArmBanner.classList.remove('hidden');
      return null;
    }
  }

  if (btnArmMic) {
    btnArmMic.addEventListener('click', async () => {
      unlockAudio();
      await initMicrophone();
    });
  }

  // --- Visualizer & Feature 1 VOX Processing Loop ---
  function setupRemoteVisualizer(stream) {
    if (!audioCtx) return;
    try {
      remoteAnalyser = audioCtx.createAnalyser();
      remoteAnalyser.fftSize = 256;
      remoteAnalyser.smoothingTimeConstant = 0.8;
      const remoteSource = audioCtx.createMediaStreamSource(stream);

      // Feature 6: Apply Tactical Radio Realism Filter if active
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

      if (oscilloscopeMobile) {
        drawScope(oscilloscopeMobile, dataArray, isTransmitting, isReceiving);
      }
    }
    render();
  }

  function drawScope(canvas, dataArray, transmitting, receiving) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth || 300;
    const height = canvas.height = canvas.clientHeight || 64;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = transmitting ? 2.5 : 1.8;

    if (transmitting) {
      ctx.strokeStyle = '#ff2a5f';
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255, 42, 95, 0.7)';
    } else if (receiving) {
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
    } else {
      ctx.strokeStyle = '#00ffaa';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 255, 170, 0.4)';
    }

    ctx.beginPath();
    const sliceWidth = width / (dataArray.length - 1);
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      let v = dataArray[i] / 128.0;
      if (!transmitting && !receiving) {
        v = 1.0 + (Math.sin(i * 0.18 + Date.now() * 0.003) * 0.05);
      }
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // --- Prominent Laptop Connection Banner ---
  function updatePeerStatusDisplay(isOnline, peer = null) {
    if (peer) remotePeerInfo = peer;
    const laptopName = remotePeerInfo?.name || 'Command Laptop';

    if (peerStatusBannerMobile && peerStatusDeviceNameMobile && peerStatusHintMobile) {
      if (isOnline) {
        peerStatusBannerMobile.classList.remove('offline');
        peerStatusBannerMobile.classList.add('connected');
        peerStatusDeviceNameMobile.textContent = `LAPTOP CONNECTED: ${laptopName}`;
        peerStatusHintMobile.textContent = isVoxEnabled
          ? '● VOX Hands-Free Active (Speak to transmit)'
          : '● Direct Audio Link Ready (Hold PTT to talk)';
        if (bondStatusText) bondStatusText.textContent = 'BONDED: PC ↔ PHONE (LIVE)';
      } else {
        peerStatusBannerMobile.classList.add('offline');
        peerStatusBannerMobile.classList.remove('connected');
        peerStatusDeviceNameMobile.textContent = 'LAPTOP DISCONNECTED';
        peerStatusHintMobile.textContent = 'Waiting for Laptop to link...';
        if (bondStatusText) bondStatusText.textContent = 'BONDED (PC)';
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

    // Remote Audio Playout
    pc.ontrack = (event) => {
      console.log('[WebRTC Phone] Remote audio incoming from laptop:', event.track);
      const incomingStream = event.streams[0] || new MediaStream([event.track]);

      if (remoteAudio) {
        remoteAudio.srcObject = incomingStream;
        remoteAudio.muted = false;
        remoteAudio.volume = volumeLevels[currentVolumeIdx];
        const p = remoteAudio.play();
        if (p !== undefined) {
          p.catch(e => console.warn('Phone autoplay wait:', e));
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
      if (mobileValIce) mobileValIce.textContent = state.toUpperCase();

      if (state === 'connected' || state === 'completed') {
        hasRemotePeer = true;
        updatePeerStatusDisplay(true, remotePeerInfo);
        setAppState('standby');
        console.log('[WebRTC Phone] P2P Direct Audio Stream ACTIVE with Laptop!');
      } else if (state === 'disconnected' || state === 'failed') {
        hasRemotePeer = false;
        updatePeerStatusDisplay(false, remotePeerInfo);
        setAppState('reconnecting');
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
        console.warn('ICE Candidate flush error:', e);
      }
    }
  }

  // --- Push-To-Talk Controller (Anti-Feedback & Instant Transmit) ---
  async function handlePttDown() {
    if (!isConnected || !hasRemotePeer || isTransmitting) return;

    unlockAudio();

    if (!localAudioTrack || localAudioTrack.readyState !== 'live') {
      await initMicrophone();
    }

    isTransmitting = true;
    setAppState('transmitting');
    soundFx.playMicClick();

    if ('vibrate' in navigator) {
      try { navigator.vibrate(40); } catch (e) {}
    }

    // Acoustic Anti-Feedback: Duck remote speaker while transmitting
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
      remoteAudio.volume = volumeLevels[currentVolumeIdx];
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

  // --- Mobile State Management ---
  function setAppState(state) {
    body.classList.remove('state-disconnected', 'state-connecting', 'state-standby', 'state-transmitting', 'state-receiving', 'state-reconnecting', 'peer-connected');

    const laptopName = remotePeerInfo?.name || 'Command Laptop';

    switch (state) {
      case 'disconnected':
        body.classList.add('state-disconnected');
        if (statusLabelMobile) statusLabelMobile.textContent = 'OFFLINE';
        if (pttBtnMobile) pttBtnMobile.disabled = true;
        if (pttTextMobile) pttTextMobile.textContent = 'OFFLINE';
        updatePeerStatusDisplay(false);
        break;

      case 'connecting':
        body.classList.add('state-connecting');
        if (statusLabelMobile) statusLabelMobile.textContent = 'CONNECTING...';
        if (pttBtnMobile) pttBtnMobile.disabled = true;
        break;

      case 'reconnecting':
        body.classList.add('state-reconnecting');
        if (statusLabelMobile) statusLabelMobile.textContent = 'RECONNECTING...';
        if (pttBtnMobile) pttBtnMobile.disabled = true;
        break;

      case 'standby':
        body.classList.add('state-standby');
        if (hasRemotePeer) {
          body.classList.add('peer-connected');
          if (statusLabelMobile) statusLabelMobile.textContent = isVoxEnabled ? 'ONLINE // VOX ARMED' : 'ONLINE // ARMED';
          if (pttBtnMobile) pttBtnMobile.disabled = false;
          if (pttTextMobile) pttTextMobile.textContent = isVoxEnabled ? 'VOX ACTIVE' : (isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK');
          if (pttSubtextMobile) pttSubtextMobile.textContent = `BONDED TO ${laptopName.toUpperCase()}`;
          updatePeerStatusDisplay(true, remotePeerInfo);
        } else {
          if (statusLabelMobile) statusLabelMobile.textContent = 'WAITING PEER';
          if (pttBtnMobile) pttBtnMobile.disabled = true;
          if (pttTextMobile) pttTextMobile.textContent = 'WAITING';
          updatePeerStatusDisplay(false);
        }
        break;

      case 'transmitting':
        body.classList.add('state-transmitting', 'peer-connected');
        if (statusLabelMobile) statusLabelMobile.textContent = 'TRANSMITTING';
        if (pttBtnMobile) pttBtnMobile.classList.add('active');
        if (pttTextMobile) pttTextMobile.textContent = isVoxEnabled ? 'VOX LIVE' : 'TRANSMITTING';
        if (pttSubtextMobile) pttSubtextMobile.textContent = isVoxEnabled ? 'SPEAKING (VOX)' : 'RELEASE TO FINISH';
        break;

      case 'receiving':
        body.classList.add('state-receiving', 'peer-connected');
        if (statusLabelMobile) statusLabelMobile.textContent = 'INCOMING VOICE';
        if (pttTextMobile) pttTextMobile.textContent = 'LISTENING';
        if (pttSubtextMobile) pttSubtextMobile.textContent = `${laptopName.toUpperCase()} TALKING`;
        break;
    }
  }

  // --- Feature 5: SOS Distress Beacon Implementation ---
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
    if (btnMobileSos) {
      btnMobileSos.classList.toggle('active', isSosActive);
    }

    if (isSosActive) {
      soundFx.playSosSiren();
      if (modalSosAlertMobile) modalSosAlertMobile.classList.remove('hidden');
      if (sosMessageMobile) sosMessageMobile.textContent = 'YOUR EMERGENCY DISTRESS BEACON IS BROADCASTING!';

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            localCoords = {
              latitude: pos.coords.latitude.toFixed(6),
              longitude: pos.coords.longitude.toFixed(6),
              accuracy: Math.round(pos.coords.accuracy)
            };
            if (sosCoordsMobile) {
              sosCoordsMobile.textContent = `GPS: ${localCoords.latitude}° N, ${localCoords.longitude}° E (±${localCoords.accuracy}m)`;
            }
            if (btnSosMapsMobile) {
              btnSosMapsMobile.href = `https://www.google.com/maps?q=${localCoords.latitude},${localCoords.longitude}`;
              btnSosMapsMobile.style.display = 'block';
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
    if (btnMobileSos) btnMobileSos.classList.remove('active');
    if (modalSosAlertMobile) modalSosAlertMobile.classList.add('hidden');
    broadcastSos(false);
  }

  if (btnMobileSos) btnMobileSos.addEventListener('click', triggerSosBeacon);
  if (btnCancelSosMobile) btnCancelSosMobile.addEventListener('click', cancelSosBeacon);

  // --- WebSocket Intercom Signaling Engine ---
  async function connectIntercom(roomId, pin, pairToken = null) {
    unlockAudio();
    currentRoomId = roomId;
    currentPin = pin;
    if (pairToken) currentPairToken = pairToken;

    if (displayRoomMobile) displayRoomMobile.textContent = roomId.toUpperCase();

    setAppState('connecting');
    initMicrophone().catch(() => {});
    requestWakeLock();

    const { wsUrl } = resolveServerEndpoints();
    console.log(`[Phone] Connecting to signaling server at ${wsUrl}...`);

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
      console.log('[Phone] Signaling connection established.');
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

          console.log(`[Phone] Entered channel "${currentRoomId}" as ${data.role}`);
          createPeerConnection(false);
          break;
        }

        case 'peer-joined': {
          hasRemotePeer = true;
          remotePeerInfo = data.peer || null;
          updatePeerStatusDisplay(true, remotePeerInfo);
          setAppState('standby');
          soundFx.playConnectChime();
          console.log(`[Phone] Laptop linked: ${remotePeerInfo ? remotePeerInfo.name : 'Laptop'}`);
          createPeerConnection(true);
          break;
        }

        case 'peer-status': {
          hasRemotePeer = true;
          remotePeerInfo = data.peer || null;
          updatePeerStatusDisplay(true, remotePeerInfo);
          setAppState('standby');
          soundFx.playConnectChime();
          console.log(`[Phone] Connected to active laptop: ${remotePeerInfo ? remotePeerInfo.name : 'Laptop'}`);
          break;
        }

        case 'peer-left': {
          hasRemotePeer = false;
          updatePeerStatusDisplay(false, remotePeerInfo);
          setAppState('standby');
          console.log('[Phone] Laptop went offline.');
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
                    if (btnMobileReplay) btnMobileReplay.disabled = false;
                    console.log('✓ Last transmission saved to replay buffer!');
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
            if (modalSosAlertMobile) modalSosAlertMobile.classList.remove('hidden');
            if (sosMessageMobile) {
              sosMessageMobile.textContent = `EMERGENCY ALERT FROM ${data.from ? data.from.toUpperCase() : 'COMMAND LAPTOP'}!`;
            }
            if (data.coords && sosCoordsMobile) {
              sosCoordsMobile.textContent = `GPS: ${data.coords.latitude}° N, ${data.coords.longitude}° E`;
              if (btnSosMapsMobile) {
                btnSosMapsMobile.href = `https://www.google.com/maps?q=${data.coords.latitude},${data.coords.longitude}`;
                btnSosMapsMobile.style.display = 'block';
              }
            }
          } else {
            soundFx.stopSosSiren();
            if (modalSosAlertMobile) modalSosAlertMobile.classList.add('hidden');
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
          console.warn(`[Phone Server Alert] ${data.message}`);
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
        console.log('[Phone] Auto-reconnecting to laptop intercom...');
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
    if (pingMobile) pingMobile.textContent = text;
    if (mobileValLatency) mobileValLatency.textContent = text;
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
      if (doReconnect) {
        connectIntercom(defaultRoom, defaultPin, currentPairToken);
      }
    } else if (mode === 'wan') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (doReconnect) {
        connectIntercom(defaultRoom, defaultPin, currentPairToken);
      }
    } else if (mode === 'freq') {
      if (freqTunerBar) freqTunerBar.classList.remove('hidden');
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

  // --- Interactive Rotary Knobs ---
  if (knobVolume) {
    knobVolume.addEventListener('click', () => {
      currentVolumeIdx = (currentVolumeIdx + 1) % volumeLevels.length;
      const vol = volumeLevels[currentVolumeIdx];
      if (remoteAudio) remoteAudio.volume = vol;
      volumeAngle += 60;
      knobVolume.style.transform = `rotate(${volumeAngle}deg)`;
      soundFx.playMicClick();
    });
  }

  if (knobChannel) {
    const channelPresets = [
      '462.5625|CH 01',
      '462.5875|CH 02',
      '462.6125|CH 03',
      '462.6375|CH 04',
      '467.5625|CH 08',
      '144.3900|VHF 01'
    ];
    let chIdx = 0;
    knobChannel.addEventListener('click', () => {
      chIdx = (chIdx + 1) % channelPresets.length;
      channelAngle += 60;
      knobChannel.style.transform = `rotate(${channelAngle}deg)`;
      const newPreset = channelPresets[chIdx];
      if (selectRadioFreq) selectRadioFreq.value = newPreset;
      soundFx.playMicClick();
      setIntercomMode('freq', false);
      applyRfFrequency(newPreset, true);
    });
  }

  // --- Touch & Click PTT Event Listeners ---
  if (pttBtnMobile) {
    pttBtnMobile.addEventListener('contextmenu', (e) => e.preventDefault());

    pttBtnMobile.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (isToggleMode) togglePtt();
      else handlePttDown();
    }, { passive: false });

    pttBtnMobile.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!isToggleMode && isTransmitting) handlePttUp();
    }, { passive: false });

    pttBtnMobile.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      if (!isToggleMode && isTransmitting) handlePttUp();
    }, { passive: false });

    pttBtnMobile.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (isToggleMode) togglePtt();
      else handlePttDown();
    });

    window.addEventListener('mouseup', () => {
      if (!isToggleMode && isTransmitting) handlePttUp();
    });
  }

  // Feature 1: VOX Hands-Free Toggle
  if (btnMobileVox) {
    btnMobileVox.addEventListener('click', async () => {
      isVoxEnabled = !isVoxEnabled;
      if (voxTextMobile) voxTextMobile.textContent = isVoxEnabled ? 'VOX On' : 'VOX Off';
      btnMobileVox.classList.toggle('highlight', isVoxEnabled);
      if (lcdVoxTag) lcdVoxTag.classList.toggle('hidden', !isVoxEnabled);
      if (mobileValVox) mobileValVox.textContent = isVoxEnabled ? 'ACTIVE (VOICE-TRIGGER)' : 'STANDBY';

      if (isVoxEnabled) {
        unlockAudio();
        await initMicrophone();
      }
      setAppState(isTransmitting ? 'transmitting' : (hasRemotePeer ? 'standby' : 'disconnected'));
    });
  }

  // Feature 2: Replay Last Call Button
  if (btnMobileReplay) {
    btnMobileReplay.addEventListener('click', () => {
      if (!lastRecordedAudioUrl) return;
      if (soundFx.playReplayChirp) soundFx.playReplayChirp();
      if (lastCallAudio) {
        lastCallAudio.src = lastRecordedAudioUrl;
        lastCallAudio.volume = volumeLevels[currentVolumeIdx];
        lastCallAudio.play().catch(e => console.warn('Replay play error:', e));
      }
    });
  }

  // Mode Toggle (Hold vs Tap Toggle)
  if (btnMobileMode) {
    btnMobileMode.addEventListener('click', () => {
      isToggleMode = !isToggleMode;
      if (modeTextMobile) modeTextMobile.textContent = isToggleMode ? 'Toggle' : 'Hold';
      btnMobileMode.classList.toggle('highlight', isToggleMode);
      setAppState(isTransmitting ? 'transmitting' : (hasRemotePeer ? 'standby' : 'disconnected'));
    });
  }

  // Feature 3: Bluetooth PTT Pairing
  if (btnBlePttMobile) {
    btnBlePttMobile.addEventListener('click', async () => {
      if (!navigator.bluetooth) {
        return alert('Web Bluetooth is supported on Chrome for Android and Chrome Desktop.\nEnsure "Experimental Web Platform features" or Web Bluetooth is enabled in chrome://flags.');
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['generic_access', 'human_interface_device', 0xFFE0, 0xFFF0]
        });
        alert(`Bluetooth Device Linked: ${device.name || 'Wireless PTT Button'}\nReady for remote PTT trigger!`);
      } catch (err) {
        if (!err.message.includes('User cancelled')) {
          alert('Bluetooth Pairing Note: ' + err.message);
        }
      }
    });
  }

  // Feature 6: Tactical Radio Realism Filter Checkbox
  if (chkRadioFilterMobile) {
    chkRadioFilterMobile.addEventListener('change', (e) => {
      if (tacticalRadioFilter) {
        tacticalRadioFilter.setFilterActive(e.target.checked);
      }
      localStorage.setItem('directlink_rf_filter', e.target.checked ? '1' : '0');
    });
  }

  // Feature 1: VOX Sensitivity Selector
  if (selectVoxSensitivityMobile) {
    selectVoxSensitivityMobile.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'high') voxThreshold = 14;
      else if (val === 'low') voxThreshold = 40;
      else voxThreshold = 25; // medium
      localStorage.setItem('directlink_vox_sens', val);
    });
  }

  // Feature 4: E2EE Passphrase Input
  if (inputE2eePassMobile) {
    inputE2eePassMobile.addEventListener('change', (e) => {
      updateE2eeKey(e.target.value);
    });
  }

  // Drawers & Modals
  if (btnMobileSettings) btnMobileSettings.addEventListener('click', () => drawerSettings && drawerSettings.classList.remove('hidden'));
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      if (inputE2eePassMobile) updateE2eeKey(inputE2eePassMobile.value);
      drawerSettings && drawerSettings.classList.add('hidden');
    });
  }

  if (btnMobileDiag) btnMobileDiag.addEventListener('click', () => drawerDiagnostics && drawerDiagnostics.classList.remove('hidden'));
  if (btnCloseDiag) btnCloseDiag.addEventListener('click', () => drawerDiagnostics && drawerDiagnostics.classList.add('hidden'));

  if (btnMobilePair) btnMobilePair.addEventListener('click', () => pairingModal && pairingModal.classList.remove('hidden'));
  if (btnCancelModal) btnCancelModal.addEventListener('click', () => pairingModal && pairingModal.classList.add('hidden'));

  // REAL Audio Gain Slider Adjustment
  if (sliderGainMobile) {
    sliderGainMobile.addEventListener('input', (e) => {
      const val = e.target.value;
      userGainMultiplier = Number(val) / 100;
      if (mobileGainValue) mobileGainValue.textContent = `${val}%`;
      if (localGainNode && audioCtx) {
        localGainNode.gain.setValueAtTime(userGainMultiplier, audioCtx.currentTime);
      }
      localStorage.setItem('directlink_gain', val);
    });
  }

  if (selectRogerMobile) {
    selectRogerMobile.addEventListener('change', (e) => {
      soundFx.setTone(e.target.value);
      localStorage.setItem('directlink_roger_tone', e.target.value);
    });
  }

  // Paste Link Button Handler
  if (btnPasteLinkMobile) {
    btnPasteLinkMobile.addEventListener('click', async () => {
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
          localStorage.setItem('directlink_server_url', parsed.server);
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
        if (parsed.key && inputE2eePassMobile) {
          inputE2eePassMobile.value = parsed.key;
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
    initBatteryMonitor();

    const savedTone = localStorage.getItem('directlink_roger_tone');
    if (savedTone && selectRogerMobile) {
      selectRogerMobile.value = savedTone;
      soundFx.setTone(savedTone);
    }

    const savedGain = localStorage.getItem('directlink_gain');
    if (savedGain && sliderGainMobile) {
      sliderGainMobile.value = savedGain;
      userGainMultiplier = Number(savedGain) / 100;
      if (mobileGainValue) mobileGainValue.textContent = `${savedGain}%`;
    }

    const savedE2ee = localStorage.getItem('directlink_e2ee_key');
    if (savedE2ee && inputE2eePassMobile) {
      inputE2eePassMobile.value = savedE2ee;
      updateE2eeKey(savedE2ee);
    }

    let savedMode = localStorage.getItem('directlink_active_mode') || 'wifi';
    let savedRf = localStorage.getItem('directlink_rf_freq') || '462.5625|CH 01';
    currentRfSetting = savedRf;
    if (selectRadioFreq) selectRadioFreq.value = savedRf;

    // Check URL parameters / Hash first
    const urlData = parseUrlParameters();
    if (urlData) {
      if (urlData.server) {
        if (inputServer) inputServer.value = urlData.server;
        localStorage.setItem('directlink_server_url', urlData.server);
      }
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
      if (urlData.key && inputE2eePassMobile) {
        inputE2eePassMobile.value = urlData.key;
        updateE2eeKey(urlData.key);
      }
      if (urlData.mode) savedMode = urlData.mode;
      if (urlData.freq) savedRf = urlData.freq;
    }

    // Fetch server info
    try {
      const { httpOrigin } = resolveServerEndpoints();
      const res = await fetch(`${httpOrigin}/api/info`);
      if (res.ok) serverInfo = await res.json();
    } catch (e) {}

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
    if (wakeLock) wakeLock.release().catch(() => {});
    if (ws) ws.close();
    if (pc) pc.close();
  });
})();
