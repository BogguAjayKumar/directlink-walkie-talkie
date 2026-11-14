/**
 * DirectLink Tactical Walkie-Talkie Client
 * Multi-Interface WebRTC Intercom with Exclusive Laptop <-> Phone Bonding,
 * Audio DSP Gain Control, Procedural Roger Beeps & Uninterrupted Auto-Reconnection.
 */

(() => {
  // --- DOM Elements ---
  const body = document.body;
  const btnToggleView = document.getElementById('btnToggleView');

  // Header Telemetry
  const bondBadge = document.getElementById('bondBadge');
  const bondStatusText = document.getElementById('bondStatusText');
  const pingBadge = document.getElementById('pingBadge');
  const pingValue = document.getElementById('pingValue');
  const linkBadge = document.getElementById('linkBadge');

  // Laptop Console Elements
  const displayRoomLaptop = document.getElementById('displayRoomLaptop');
  const peerPillLaptop = document.getElementById('peerPillLaptop');
  const peerLabelLaptop = document.getElementById('peerLabelLaptop');
  const statusLabelLaptop = document.getElementById('statusLabelLaptop');
  const statusBannerLaptop = document.getElementById('statusBannerLaptop');
  const oscilloscopeLaptop = document.getElementById('oscilloscopeLaptop');
  const vuMic = document.getElementById('vuMic');
  const vuPeer = document.getElementById('vuPeer');
  const pttBtnLaptop = document.getElementById('pttBtnLaptop');
  const pttTextLaptop = document.getElementById('pttTextLaptop');
  const pttSubtextLaptop = document.getElementById('pttSubtextLaptop');

  // Audio DSP & Controls (Laptop)
  const sliderGain = document.getElementById('sliderGain');
  const gainValueDisplay = document.getElementById('gainValueDisplay');
  const sliderNoiseGate = document.getElementById('sliderNoiseGate');
  const noiseGateDisplay = document.getElementById('noiseGateDisplay');
  const selectRogerBeep = document.getElementById('selectRogerBeep');
  const chkEchoCancel = document.getElementById('chkEchoCancel');
  const chkNoiseSupp = document.getElementById('chkNoiseSupp');

  // Telemetry Values (Laptop)
  const valIceState = document.getElementById('valIceState');
  const valLatency = document.getElementById('valLatency');
  const valTransport = document.getElementById('valTransport');
  const valIntegrity = document.getElementById('valIntegrity');

  // Actions (Laptop)
  const btnPairingLaptop = document.getElementById('btnPairingLaptop');
  const btnTunnelLaptop = document.getElementById('btnTunnelLaptop');
  const tunnelTextLaptop = document.getElementById('tunnelTextLaptop');
  const btnModeLaptop = document.getElementById('btnModeLaptop');
  const modeTextLaptop = document.getElementById('modeTextLaptop');
  const btnResetBondLaptop = document.getElementById('btnResetBondLaptop');
  const activityLog = document.getElementById('activityLog');

  // Mobile Transceiver Elements
  const displayRoomMobile = document.getElementById('displayRoomMobile');
  const statusLabelMobile = document.getElementById('statusLabelMobile');
  const pingMobile = document.getElementById('pingMobile');
  const oscilloscopeMobile = document.getElementById('oscilloscopeMobile');
  const pttBtnMobile = document.getElementById('pttBtnMobile');
  const pttTextMobile = document.getElementById('pttTextMobile');
  const pttSubtextMobile = document.getElementById('pttSubtextMobile');
  const btnMobileMode = document.getElementById('btnMobileMode');
  const modeTextMobile = document.getElementById('modeTextMobile');
  const btnMobileSettings = document.getElementById('btnMobileSettings');
  const btnMobileDiag = document.getElementById('btnMobileDiag');
  const btnMobilePair = document.getElementById('btnMobilePair');

  // Mobile Drawers
  const drawerSettings = document.getElementById('drawerSettings');
  const sliderGainMobile = document.getElementById('sliderGainMobile');
  const mobileGainValue = document.getElementById('mobileGainValue');
  const selectRogerMobile = document.getElementById('selectRogerMobile');
  const btnCloseSettings = document.getElementById('btnCloseSettings');

  const drawerDiagnostics = document.getElementById('drawerDiagnostics');
  const mobileValLatency = document.getElementById('mobileValLatency');
  const mobileValIce = document.getElementById('mobileValIce');
  const btnCloseDiag = document.getElementById('btnCloseDiag');

  // Pairing Modal Elements
  const pairingModal = document.getElementById('pairingModal');
  const groupServer = document.getElementById('groupServer');
  const inputServer = document.getElementById('inputServer');
  const btnPasteLink = document.getElementById('btnPasteLink');
  const inputRoom = document.getElementById('inputRoom');
  const inputPin = document.getElementById('inputPin');
  const selectNetwork = document.getElementById('selectNetwork');
  const qrImage = document.getElementById('qrImage');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnConnect = document.getElementById('btnConnect');

  // Audio Playback Element
  const remoteAudio = document.getElementById('remoteAudio');

  // --- State Variables ---
  const isMobilePlatform = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let currentView = isMobilePlatform ? 'mobile' : 'laptop';
  let deviceRole = isMobilePlatform ? 'phone' : 'laptop';

  let currentRoomId = '';
  let currentPin = '';
  let currentPairToken = null;
  let isBondedMaster = false;

  let ws = null;
  let pc = null;
  let localStream = null;
  let localAudioTrack = null;
  let wakeLock = null;
  let reconnectInterval = null;
  let pingInterval = null;
  let rttLatency = null;

  let isConnected = false;
  let isTransmitting = false;
  let isReceiving = false;
  let isToggleMode = false;
  let hasRemotePeer = false;
  let isSpacePressed = false;

  // Audio DSP Graph
  let audioCtx = null;
  let localAnalyser = null;
  let remoteAnalyser = null;
  let micGainNode = null;
  let dynamicsCompressor = null;
  let mediaStreamDest = null;
  let userGainMultiplier = 1.0;
  let noiseGateLevel = 1; // 0=off, 1=mod, 2=high, 3=ultra
  let audioUnlocked = false;

  let serverInfo = {
    localIps: [],
    httpsPort: 8443,
    tunnelUrl: null,
    isTunneling: false,
    bondedPair: null
  };

  const soundFx = new SoundEffects();
  window.soundEffects = soundFx;

  // --- View Mode Management ---
  function updateViewMode(view) {
    currentView = view;
    if (view === 'laptop') {
      body.classList.remove('view-mobile');
      body.classList.add('view-laptop');
      btnToggleView.textContent = '📱 Handheld UI';
    } else {
      body.classList.remove('view-laptop');
      body.classList.add('view-mobile');
      btnToggleView.textContent = '🖥️ Console HUD';
    }
  }

  btnToggleView.addEventListener('click', () => {
    updateViewMode(currentView === 'laptop' ? 'mobile' : 'laptop');
  });

  // --- Event Audit Logger ---
  function logEvent(msg) {
    const time = new Date().toTimeString().split(' ')[0];
    console.log(`[DirectLink ${time}] ${msg}`);
    if (activityLog) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `<span>${time}</span> ${msg}`;
      activityLog.appendChild(entry);
      activityLog.scrollTop = activityLog.scrollHeight;
    }
  }

  // --- Audio Pipeline Unlocker (Mobile Safari/Chrome) ---
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

    // Start imperceptible silent keep-alive oscillator to prevent mobile OS suspension
    startSilentKeepAlive();

    // Touch remoteAudio element to bypass mobile autoplay policies
    if (remoteAudio) {
      const p = remoteAudio.play();
      if (p !== undefined) {
        p.then(() => { if (!remoteAudio.srcObject) remoteAudio.pause(); }).catch(() => {});
      }
    }
  }

  // Silent Keep-Alive Loop for Background Audio Persistence
  function startSilentKeepAlive() {
    try {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.00001; // inaudible
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
    } catch (e) {}
  }

  // --- Screen Wake Lock (Uninterrupted Screen Standby) ---
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (err) {
        console.warn('Wake Lock request note:', err.message);
      }
    }
  }

  // --- URL & Endpoint Resolution ---
  function resolveServerEndpoints() {
    let raw = (inputServer && inputServer.value.trim()) || localStorage.getItem('directlink_server_url') || '';
    let protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    let host = window.location.host;

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
      clean = clean.replace(/\/+$/, '');
      clean = clean.split('/')[0];
      if (clean) host = clean;
    }

    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    const httpOrigin = `${protocol}//${host}`;
    const wsUrl = `${wsProtocol}//${host}`;
    return { httpOrigin, wsUrl, host };
  }

  // Parse invite links or QR URLs: #room=NAME&pin=123456&server=https://...
  function parseInviteUrl(raw) {
    if (!raw) return null;
    try {
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
      const server = searchParams.get('server') || (serverBase && serverBase.startsWith('http') ? serverBase : null);

      if (room || pin || server || token) {
        return { room, pin, server, token };
      }
    } catch (e) {
      console.warn('Failed to parse URL:', e);
    }
    return null;
  }

  function parseUrlHash() {
    if (!window.location.hash) return null;
    return parseInviteUrl(window.location.href);
  }

  function getShareableUrl() {
    const base = selectNetwork.value || window.location.origin;
    const room = inputRoom.value.trim();
    const pin = inputPin.value.trim();
    const tokenPart = currentPairToken ? `&token=${encodeURIComponent(currentPairToken)}` : '';
    return `${base}/#room=${encodeURIComponent(room)}&pin=${encodeURIComponent(pin)}${tokenPart}&server=${encodeURIComponent(base)}`;
  }

  async function updateQrCode() {
    const url = getShareableUrl();
    try {
      const { httpOrigin } = resolveServerEndpoints();
      const qrApiUrl = `${httpOrigin}/api/qr?text=${encodeURIComponent(url)}`;
      qrImage.src = qrApiUrl;
    } catch (err) {
      console.warn('QR update error:', err);
    }
  }

  // --- Network Info & Master Bond Sync ---
  async function fetchServerInfo() {
    try {
      const { httpOrigin } = resolveServerEndpoints();
      const res = await fetch(`${httpOrigin}/api/info`);
      if (res.ok) {
        serverInfo = await res.json();
        updateNetworkOptions();
        updateTunnelButtonState();

        if (serverInfo.bondedPair) {
          isBondedMaster = true;
          currentPairToken = serverInfo.bondedPair.pairToken;
          bondStatusText.textContent = 'BONDED (PC ↔ PHONE)';
          bondBadge.classList.add('badge-bond');
        }
      }
    } catch (e) {
      console.warn('Could not fetch server info:', e);
    }
  }

  function updateTunnelButtonState() {
    const isTun = !!serverInfo.isTunneling;
    if (btnTunnelLaptop) {
      if (isTun) {
        btnTunnelLaptop.classList.add('active');
        tunnelTextLaptop.textContent = 'WAN Active';
        linkBadge.textContent = 'WAN RELAY';
        linkBadge.style.color = 'var(--accent-ready)';
      } else {
        btnTunnelLaptop.classList.remove('active');
        tunnelTextLaptop.textContent = 'Mobile Data WAN';
        linkBadge.textContent = 'WI-FI LAN';
        linkBadge.style.color = '#fde047';
      }
    }
  }

  function updateNetworkOptions() {
    selectNetwork.innerHTML = '';

    // Tunnel option if active (always top recommended!)
    if (serverInfo.tunnelUrl) {
      const opt = document.createElement('option');
      opt.value = serverInfo.tunnelUrl;
      opt.textContent = `★ Mobile Data / WAN Tunnel (${serverInfo.tunnelUrl})`;
      selectNetwork.appendChild(opt);
      selectNetwork.value = serverInfo.tunnelUrl;
    }

    if (serverInfo.localIps && serverInfo.localIps.length > 0) {
      serverInfo.localIps.forEach(({ name, ip }) => {
        const optHttp = document.createElement('option');
        optHttp.value = `http://${ip}:${serverInfo.httpPort}`;
        optHttp.textContent = `Wi-Fi HTTP (${ip}:${serverInfo.httpPort}) [APK / No SSL warning]`;
        selectNetwork.appendChild(optHttp);

        const optHttps = document.createElement('option');
        optHttps.value = `https://${ip}:${serverInfo.httpsPort}`;
        optHttps.textContent = `Wi-Fi HTTPS (${ip}:${serverInfo.httpsPort}) [Self-Signed]`;
        selectNetwork.appendChild(optHttps);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = window.location.origin;
      opt.textContent = `Current Origin (${window.location.host})`;
      selectNetwork.appendChild(opt);
    }

    updateQrCode();
  }

  // --- Visualizer & VU Meter Canvas Pipeline ---
  function setupLocalVisualizer(stream) {
    if (!audioCtx) return;
    localAnalyser = audioCtx.createAnalyser();
    localAnalyser.fftSize = 256;
    localAnalyser.smoothingTimeConstant = 0.8;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(localAnalyser);
    startVisualizerLoop();
  }

  function setupRemoteVisualizer(stream) {
    if (!audioCtx) return;
    remoteAnalyser = audioCtx.createAnalyser();
    remoteAnalyser.fftSize = 256;
    remoteAnalyser.smoothingTimeConstant = 0.8;

    remoteSource = audioCtx.createMediaStreamSource(stream);
    remoteSource.connect(remoteAnalyser);
    startVisualizerLoop();
  }

  function startVisualizerLoop() {
    if (animFrameId) return;

    const dataArray = new Uint8Array(128);

    function render() {
      animFrameId = requestAnimationFrame(render);

      // Active Analyser Selection
      const activeAnalyser = isTransmitting ? localAnalyser : (hasRemotePeer ? remoteAnalyser : null);

      let peakLevel = 0;
      if (activeAnalyser) {
        activeAnalyser.getByteTimeDomainData(dataArray);
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.abs(dataArray[i] - 128);
          if (val > peakLevel) peakLevel = val;
        }
      }

      const percent = Math.min(100, Math.round((peakLevel / 128) * 100 * 2.2));

      // Update VU Meters
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

      // Draw Laptop Oscilloscope
      if (oscilloscopeLaptop) {
        drawScope(oscilloscopeLaptop, dataArray, isTransmitting, isReceiving);
      }
      // Draw Mobile Oscilloscope
      if (oscilloscopeMobile) {
        drawScope(oscilloscopeMobile, dataArray, isTransmitting, isReceiving);
      }
    }

    render();
  }

  function drawScope(canvas, dataArray, transmitting, receiving) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = transmitting ? 2.5 : 1.8;
    if (transmitting) {
      ctx.strokeStyle = '#ff2a5f';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 42, 95, 0.7)';
    } else if (receiving) {
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowBlur = 10;
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
        // Idle ambient scan line
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

  // --- Microphone & DSP Audio Graph Setup ---
  async function initMicrophone() {
    if (localStream) return localStream;
    try {
      unlockAudio();

      const echo = chkEchoCancel ? chkEchoCancel.checked : true;
      const noise = chkNoiseSupp ? chkNoiseSupp.checked : true;

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: echo,
          noiseSuppression: noise,
          autoGainControl: true,
          latency: 0.01
        },
        video: false
      });

      // DSP Processing: Source -> GainNode -> Compressor -> MediaStreamDestination
      const rawSource = audioCtx.createMediaStreamSource(rawStream);

      micGainNode = audioCtx.createGain();
      micGainNode.gain.value = userGainMultiplier;

      dynamicsCompressor = audioCtx.createDynamicsCompressor();
      dynamicsCompressor.threshold.setValueAtTime(-20, audioCtx.currentTime);
      dynamicsCompressor.knee.setValueAtTime(10, audioCtx.currentTime);
      dynamicsCompressor.ratio.setValueAtTime(6, audioCtx.currentTime);

      mediaStreamDest = audioCtx.createMediaStreamDestination();

      rawSource.connect(micGainNode);
      micGainNode.connect(dynamicsCompressor);
      dynamicsCompressor.connect(mediaStreamDest);

      localStream = mediaStreamDest.stream;
      localAudioTrack = localStream.getAudioTracks()[0];
      localAudioTrack.enabled = false; // Standby muted

      setupLocalVisualizer(rawStream);
      return localStream;
    } catch (err) {
      console.error('Microphone initialization failed:', err);
      alert('Microphone access is required for intercom operation. Please enable permissions.');
      throw err;
    }
  }

  // --- WebRTC PeerConnection Setup ---
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

    pc = new RTCPeerConnection(rtcConfig);

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Remote Audio Playout (Immediate Handsfree WebRTC Stream)
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote media track incoming');
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play().catch(e => console.warn('Autoplay error:', e));
      setupRemoteVisualizer(event.streams[0]);
      hasRemotePeer = true;
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
      if (mobileValIce) mobileValIce.textContent = state.toUpperCase();

      if (state === 'connected' || state === 'completed') {
        hasRemotePeer = true;
        setAppState('standby');
        logEvent('P2P Direct DTLS-SRTP Audio Channel Established.');
      } else if (state === 'disconnected' || state === 'failed') {
        hasRemotePeer = false;
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
      console.error('Failed to create WebRTC offer:', err);
    }
  }

  // --- Push-To-Talk State Controller ---
  function handlePttDown() {
    if (!isConnected || !hasRemotePeer || isTransmitting) return;

    unlockAudio();
    isTransmitting = true;
    setAppState('transmitting');
    soundFx.playMicClick();

    if ('vibrate' in navigator) navigator.vibrate(40);

    if (localAudioTrack) {
      localAudioTrack.enabled = true;
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

    // Play configured Roger Beep
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

  // --- Application State Manager ---
  function setAppState(state) {
    body.classList.remove('state-disconnected', 'state-connecting', 'state-standby', 'state-transmitting', 'state-receiving', 'state-reconnecting', 'peer-connected');

    switch (state) {
      case 'disconnected':
        body.classList.add('state-disconnected');
        statusLabelLaptop.textContent = 'OFFLINE';
        statusBannerLaptop.textContent = 'INTERCOM OFFLINE // TAP TO CONNECT';
        statusLabelMobile.textContent = 'OFFLINE';
        pttBtnLaptop.disabled = true;
        pttBtnMobile.disabled = true;
        pttTextLaptop.textContent = 'OFFLINE';
        pttTextMobile.textContent = 'OFFLINE';
        break;

      case 'connecting':
        body.classList.add('state-connecting');
        statusLabelLaptop.textContent = 'CONNECTING';
        statusBannerLaptop.textContent = 'CONNECTING TO SIGNALING HUB...';
        statusLabelMobile.textContent = 'CONNECTING...';
        pttBtnLaptop.disabled = true;
        pttBtnMobile.disabled = true;
        break;

      case 'reconnecting':
        body.classList.add('state-reconnecting');
        statusLabelLaptop.textContent = 'RECONNECTING';
        statusBannerLaptop.textContent = 'NETWORK SWITCH DETECTED // AUTO-RECONNECTING...';
        statusLabelMobile.textContent = 'RECONNECTING...';
        pttBtnLaptop.disabled = true;
        pttBtnMobile.disabled = true;
        break;

      case 'standby':
        body.classList.add('state-standby');
        if (hasRemotePeer) {
          body.classList.add('peer-connected');
          peerLabelLaptop.textContent = 'PHONE ONLINE';
          statusLabelLaptop.textContent = 'ARMED';
          statusBannerLaptop.textContent = 'CHANNEL ARMED // READY TO TALK';
          statusLabelMobile.textContent = 'LAPTOP ONLINE';
          pttBtnLaptop.disabled = false;
          pttBtnMobile.disabled = false;
          pttTextLaptop.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
          pttTextMobile.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
          pttSubtextLaptop.textContent = 'AUDIO STANDBY';
          pttSubtextMobile.textContent = 'BONDED TO LAPTOP';
        } else {
          peerLabelLaptop.textContent = 'WAITING PEER';
          statusLabelLaptop.textContent = 'STANDBY';
          statusBannerLaptop.textContent = 'WAITING FOR SECOND DEVICE TO CONNECT...';
          statusLabelMobile.textContent = 'WAITING PEER';
          pttBtnLaptop.disabled = true;
          pttBtnMobile.disabled = true;
          pttTextLaptop.textContent = 'WAITING';
          pttTextMobile.textContent = 'WAITING';
        }
        break;

      case 'transmitting':
        body.classList.add('state-transmitting', 'peer-connected');
        statusLabelLaptop.textContent = 'TRANSMITTING';
        statusBannerLaptop.textContent = 'LIVE // YOU ARE BROADCASTING';
        statusLabelMobile.textContent = 'TALKING';
        pttBtnLaptop.classList.add('active');
        pttBtnMobile.classList.add('active');
        pttTextLaptop.textContent = 'TALKING';
        pttTextMobile.textContent = 'TRANSMITTING';
        pttSubtextLaptop.textContent = 'RELEASE SPACEBAR TO STOP';
        pttSubtextMobile.textContent = 'RELEASE TO FINISH';
        break;

      case 'receiving':
        body.classList.add('state-receiving', 'peer-connected');
        statusLabelLaptop.textContent = 'RECEIVING';
        statusBannerLaptop.textContent = 'INCOMING TRANSMISSION FROM PEER';
        statusLabelMobile.textContent = 'INCOMING VOICE';
        pttTextLaptop.textContent = 'LISTENING';
        pttTextMobile.textContent = 'LISTENING';
        pttSubtextLaptop.textContent = 'PEER BROADCASTING';
        pttSubtextMobile.textContent = 'REMOTE DEVICE TALKING';
        break;
    }
  }

  // --- WebSocket Intercom Signaling Engine ---
  async function connectIntercom(roomId, pin, pairToken = null) {
    unlockAudio();
    currentRoomId = roomId;
    currentPin = pin;
    if (pairToken) currentPairToken = pairToken;

    displayRoomLaptop.textContent = roomId.toUpperCase();
    displayRoomMobile.textContent = roomId.toUpperCase();

    setAppState('connecting');
    await initMicrophone();
    requestWakeLock();

    const { wsUrl } = resolveServerEndpoints();
    logEvent(`Connecting to signaling server at ${wsUrl}...`);

    if (ws) {
      try { ws.close(); } catch (e) {}
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      logEvent('Signaling connection established.');
      clearInterval(reconnectInterval);

      // Join with persistent pairToken for uninterrupted auto-reconnect
      ws.send(JSON.stringify({
        type: 'join',
        roomId: currentRoomId,
        pin: currentPin,
        pairToken: currentPairToken,
        role: deviceRole,
        deviceName: isMobilePlatform ? 'Mobile Phone' : 'Command Laptop'
      }));

      // Start Latency Ping Heartbeat
      startPingHeartbeat();
    };

    ws.onmessage = async (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      switch (data.type) {
        case 'joined': {
          isConnected = true;
          pairingModal.classList.add('hidden');
          if (data.isMasterBond) isBondedMaster = true;
          if (data.pairToken) {
            currentPairToken = data.pairToken;
            localStorage.setItem('directlink_pair_token', data.pairToken);
          }

          // Persist bond credentials for instant auto-connect on next launch
          localStorage.setItem('directlink_room', currentRoomId);
          localStorage.setItem('directlink_pin', currentPin);

          logEvent(`Entered channel "${currentRoomId}". Role: ${data.role}`);
          createPeerConnection(data.isInitiator);
          break;
        }

        case 'peer-joined': {
          hasRemotePeer = true;
          setAppState('standby');
          soundFx.playConnectChime();
          logEvent('Remote paired device arrived on channel.');
          createPeerConnection(true); // Initiate clean WebRTC handshake
          break;
        }

        case 'peer-status': {
          hasRemotePeer = true;
          setAppState('standby');
          soundFx.playConnectChime();
          break;
        }

        case 'peer-left': {
          hasRemotePeer = false;
          setAppState('standby');
          logEvent('Remote paired device went offline / standby.');
          break;
        }

        case 'signal': {
          if (!pc) createPeerConnection(false);

          if (data.signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            if (data.signal.sdp.type === 'offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({
                type: 'signal',
                signal: { sdp: pc.localDescription }
              }));
            }
          } else if (data.signal.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            } catch (err) {
              console.warn('ICE Candidate add warning:', err);
            }
          }
          break;
        }

        case 'ptt-status': {
          if (data.state === 'transmitting') {
            isReceiving = true;
            setAppState('receiving');
            soundFx.playMicClick();
          } else if (data.state === 'idle') {
            isReceiving = false;
            soundFx.playRogerBeep();
            setAppState('standby');
          }
          break;
        }

        case 'pong': {
          if (data.clientTime) {
            rttLatency = Math.round(performance.now() - data.clientTime);
            updateLatencyUI(rttLatency);
          }
          break;
        }

        case 'error': {
          logEvent(`Server Alert: ${data.message}`);
          if (data.message.includes('PIN')) {
            alert(data.message);
            pairingModal.classList.remove('hidden');
          }
          break;
        }
      }
    };

    ws.onclose = () => {
      isConnected = false;
      stopPingHeartbeat();
      setAppState('reconnecting');
      logEvent('Signaling connection severed. Reconnecting supervisor active...');

      // UNINTERRUPTED AUTO-RECONNECT LOOP: Retry every 1.5s
      clearInterval(reconnectInterval);
      reconnectInterval = setInterval(() => {
        logEvent('Retrying connection to bonded intercom...');
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
    if (pingMobile) pingMobile.textContent = text;
    if (mobileValLatency) mobileValLatency.textContent = text;

    if (latency < 25) {
      if (pingBadge) pingBadge.style.color = '#4ade80';
    } else if (latency < 80) {
      if (pingBadge) pingBadge.style.color = '#fde047';
    } else {
      if (pingBadge) pingBadge.style.color = '#f87171';
    }
  }

  // --- Controls & Event Listeners ---

  // PTT Spacebar Hotkey (Laptop)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpacePressed) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }
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

  // Laptop PTT Button
  pttBtnLaptop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (isToggleMode) togglePtt();
    else handlePttDown();
  });
  window.addEventListener('mouseup', () => {
    if (!isToggleMode && isTransmitting) handlePttUp();
  });

  // Mobile PTT Button (Touch & Mouse)
  pttBtnMobile.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isToggleMode) togglePtt();
    else handlePttDown();
  }, { passive: false });

  pttBtnMobile.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!isToggleMode && isTransmitting) handlePttUp();
  });

  pttBtnMobile.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (isToggleMode) togglePtt();
    else handlePttDown();
  });

  // Mode Toggles (Hold to Talk vs Handsfree Toggle)
  function togglePttMode() {
    isToggleMode = !isToggleMode;
    const label = isToggleMode ? 'Toggle Mode' : 'Hold Mode';
    if (modeTextLaptop) modeTextLaptop.textContent = label;
    if (modeTextMobile) modeTextMobile.textContent = isToggleMode ? 'Toggle' : 'Hold';
    if (btnModeLaptop) btnModeLaptop.classList.toggle('active', isToggleMode);
    if (btnMobileMode) btnMobileMode.classList.toggle('highlight', isToggleMode);
    setAppState(isTransmitting ? 'transmitting' : (hasRemotePeer ? 'standby' : 'disconnected'));
  }

  if (btnModeLaptop) btnModeLaptop.addEventListener('click', togglePttMode);
  if (btnMobileMode) btnMobileMode.addEventListener('click', togglePttMode);

  // Audio DSP Sliders
  function updateGain(val) {
    userGainMultiplier = val / 100;
    if (micGainNode) micGainNode.gain.value = userGainMultiplier;
    if (gainValueDisplay) gainValueDisplay.textContent = `${val}%`;
    if (mobileGainValue) mobileGainValue.textContent = `${val}%`;
    if (sliderGain) sliderGain.value = val;
    if (sliderGainMobile) sliderGainMobile.value = val;
    localStorage.setItem('directlink_gain', val);
  }

  if (sliderGain) sliderGain.addEventListener('input', (e) => updateGain(e.target.value));
  if (sliderGainMobile) sliderGainMobile.addEventListener('input', (e) => updateGain(e.target.value));

  // Roger Beep Selectors
  function updateRogerBeep(tone) {
    soundFx.setTone(tone);
    if (selectRogerBeep) selectRogerBeep.value = tone;
    if (selectRogerMobile) selectRogerMobile.value = tone;
    localStorage.setItem('directlink_roger_tone', tone);
  }

  if (selectRogerBeep) selectRogerBeep.addEventListener('change', (e) => updateRogerBeep(e.target.value));
  if (selectRogerMobile) selectRogerMobile.addEventListener('change', (e) => updateRogerBeep(e.target.value));

  // Mobile Drawers
  if (btnMobileSettings) btnMobileSettings.addEventListener('click', () => drawerSettings.classList.remove('hidden'));
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => drawerSettings.classList.add('hidden'));

  if (btnMobileDiag) btnMobileDiag.addEventListener('click', () => drawerDiagnostics.classList.remove('hidden'));
  if (btnCloseDiag) btnCloseDiag.addEventListener('click', () => drawerDiagnostics.classList.add('hidden'));

  // Mobile WAN Tunnel Toggle
  if (btnTunnelLaptop) {
    btnTunnelLaptop.addEventListener('click', async () => {
      const shouldEnable = !serverInfo.isTunneling;
      tunnelTextLaptop.textContent = shouldEnable ? 'Connecting...' : 'Closing...';
      try {
        const { httpOrigin } = resolveServerEndpoints();
        const res = await fetch(`${httpOrigin}/api/tunnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable: shouldEnable })
        });
        if (res.ok) {
          await fetchServerInfo();
        }
      } catch (err) {
        alert('Tunnel request failed: ' + err.message);
      } finally {
        updateTunnelButtonState();
      }
    });
  }

  // Pairing Modal & Bond Reset
  function openPairingModal() {
    pairingModal.classList.remove('hidden');
    fetchServerInfo().then(updateQrCode);
  }

  if (btnPairingLaptop) btnPairingLaptop.addEventListener('click', openPairingModal);
  if (btnMobilePair) btnMobilePair.addEventListener('click', openPairingModal);

  if (btnResetBondLaptop) {
    btnResetBondLaptop.addEventListener('click', async () => {
      if (!confirm('Reset the master bond? Both laptop and phone will be disconnected and will need to re-pair once.')) return;
      try {
        const { httpOrigin } = resolveServerEndpoints();
        const res = await fetch(`${httpOrigin}/api/bond/reset`, { method: 'POST' });
        if (res.ok) {
          localStorage.removeItem('directlink_room');
          localStorage.removeItem('directlink_pin');
          localStorage.removeItem('directlink_pair_token');
          window.location.reload();
        }
      } catch (err) {
        alert('Reset error: ' + err.message);
      }
    });
  }

  // Paste Link Button
  if (btnPasteLink) {
    btnPasteLink.addEventListener('click', async () => {
      let text = '';
      try {
        text = await navigator.clipboard.readText();
      } catch (err) {
        text = prompt('Paste your DirectLink invite link or QR URL:');
      }
      if (text) {
        const parsed = parseInviteUrl(text);
        if (parsed) {
          if (parsed.server && inputServer) {
            inputServer.value = parsed.server;
            localStorage.setItem('directlink_server_url', parsed.server);
          }
          if (parsed.room) inputRoom.value = parsed.room;
          if (parsed.pin) inputPin.value = parsed.pin;
          alert('Invite parameters applied! Click "Connect & Bond Intercom" to start.');
        } else {
          alert('Could not parse link. Please check the URL.');
        }
      }
    });
  }

  btnCopyLink.addEventListener('click', async () => {
    const url = getShareableUrl();
    try {
      await navigator.clipboard.writeText(url);
      btnCopyLink.querySelector('span').textContent = 'Copied to Clipboard!';
      setTimeout(() => { btnCopyLink.querySelector('span').textContent = 'Copy Invite Link'; }, 2000);
    } catch (err) {
      prompt('Copy this link:', url);
    }
  });

  btnConnect.addEventListener('click', () => {
    unlockAudio();
    if (inputServer && inputServer.value.trim()) {
      localStorage.setItem('directlink_server_url', inputServer.value.trim());
    }
    const room = inputRoom.value.trim().toLowerCase();
    const pin = inputPin.value.trim();
    if (!room || !pin) {
      alert('Please enter both Channel Name and 6-digit PIN');
      return;
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      alert('PIN must be exactly 6 digits');
      return;
    }
    connectIntercom(room, pin);
  });

  // --- Initial Startup & Auto-Bond Execution ---
  window.addEventListener('DOMContentLoaded', async () => {
    updateViewMode(isMobilePlatform ? 'mobile' : 'laptop');

    // Restore saved settings
    const savedGain = localStorage.getItem('directlink_gain');
    if (savedGain) updateGain(savedGain);

    const savedTone = localStorage.getItem('directlink_roger_tone');
    if (savedTone) updateRogerBeep(savedTone);

    const savedServer = localStorage.getItem('directlink_server_url');
    if (savedServer && inputServer) inputServer.value = savedServer;

    // Check URL Hash first (e.g. Scanned via QR code)
    const hashData = parseUrlHash();
    if (hashData && hashData.room && hashData.pin) {
      inputRoom.value = hashData.room;
      inputPin.value = hashData.pin;
      if (hashData.server && inputServer) {
        inputServer.value = hashData.server;
        localStorage.setItem('directlink_server_url', hashData.server);
      }
      logEvent(`Auto-connecting to scanned frequency "${hashData.room}"...`);
      await fetchServerInfo();
      connectIntercom(hashData.room, hashData.pin, hashData.token);
      return;
    }

    // Check Local Storage for Existing Bond
    const savedRoom = localStorage.getItem('directlink_room');
    const savedPin = localStorage.getItem('directlink_pin');
    const savedToken = localStorage.getItem('directlink_pair_token');

    // Fetch server info and master bond status
    await fetchServerInfo();

    if (savedRoom && savedPin) {
      inputRoom.value = savedRoom;
      inputPin.value = savedPin;
      logEvent(`Connecting to bonded frequency "${savedRoom}"...`);
      connectIntercom(savedRoom, savedPin, savedToken);
    } else if (serverInfo.bondedPair) {
      // Auto-adopt Server Master Bond
      const bp = serverInfo.bondedPair;
      inputRoom.value = bp.roomId;
      inputPin.value = bp.pin;
      logEvent(`Adopting master bonded channel "${bp.roomId}"...`);
      connectIntercom(bp.roomId, bp.pin, bp.pairToken);
    } else {
      // Default initial pairing modal
      openPairingModal();
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (wakeLock) wakeLock.release().catch(() => {});
    if (ws) ws.close();
    if (pc) pc.close();
  });

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
