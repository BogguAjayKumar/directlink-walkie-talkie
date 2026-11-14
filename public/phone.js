/**
 * DirectLink Mobile Field Walkie-Talkie Transceiver
 * Dedicated Client Script for Phone Units
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

  // PTT Button
  const pttBtnMobile = document.getElementById('pttBtnMobile');
  const pttTextMobile = document.getElementById('pttTextMobile');
  const pttSubtextMobile = document.getElementById('pttSubtextMobile');
  const btnMobileMode = document.getElementById('btnMobileMode');
  const modeTextMobile = document.getElementById('modeTextMobile');

  // Controls & Modals
  const btnMobileSettings = document.getElementById('btnMobileSettings');
  const btnMobileDiag = document.getElementById('btnMobileDiag');
  const btnMobilePair = document.getElementById('btnMobilePair');
  const drawerSettings = document.getElementById('drawerSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const sliderGainMobile = document.getElementById('sliderGainMobile');
  const mobileGainValue = document.getElementById('mobileGainValue');
  const selectRogerMobile = document.getElementById('selectRogerMobile');
  const drawerDiagnostics = document.getElementById('drawerDiagnostics');
  const btnCloseDiag = document.getElementById('btnCloseDiag');
  const mobileValLatency = document.getElementById('mobileValLatency');
  const mobileValIce = document.getElementById('mobileValIce');
  const pairingModal = document.getElementById('pairingModal');
  const inputServer = document.getElementById('inputServer');
  const inputRoom = document.getElementById('inputRoom');
  const inputPin = document.getElementById('inputPin');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnConnect = document.getElementById('btnConnect');

  // Remote Audio Element
  const remoteAudio = document.getElementById('remoteAudio');

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
  let localStream = null;
  let localAudioTrack = null;
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

  // Audio Context & Analyser
  let audioCtx = null;
  let localAnalyser = null;
  let remoteAnalyser = null;
  let audioUnlocked = false;

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

    startSilentKeepAlive();

    if (remoteAudio) {
      remoteAudio.muted = false;
      remoteAudio.volume = 1.0;
      const p = remoteAudio.play();
      if (p !== undefined) {
        p.then(() => { if (!remoteAudio.srcObject) remoteAudio.pause(); }).catch(() => {});
      }
    }
  }

  ['touchstart', 'touchend', 'mousedown', 'click'].forEach(evt => {
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

  // --- Screen Wake Lock ---
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (e) {}
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

  // --- Microphone Hardware Initialization (Rock-Solid for Phone) ---
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
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          latency: 0.01
        },
        video: false
      });

      localStream = rawStream;
      localAudioTrack = rawStream.getAudioTracks()[0];
      localAudioTrack.enabled = false; // Standby muted

      // Connect to Web Audio Analyser for LCD oscilloscope
      setupLocalVisualizer(rawStream);

      // Hide the "Tap to arm microphone" banner
      if (micArmBanner) micArmBanner.classList.add('hidden');

      // CRITICAL FIX: If WebRTC PeerConnection already exists, inject this mic track into the audio sender!
      if (pc) {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
        if (audioSender) {
          console.log('[WebRTC Phone] Inserting microphone track into active audio sender...');
          await audioSender.replaceTrack(localAudioTrack);
        } else {
          console.log('[WebRTC Phone] Adding audio track directly to peer connection...');
          pc.addTrack(localAudioTrack, localStream);
        }
      }

      console.log('✓ Phone Microphone successfully armed & ready to transmit!');
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

  // --- Visualizer Setup ---
  function setupLocalVisualizer(stream) {
    if (!audioCtx) return;
    try {
      localAnalyser = audioCtx.createAnalyser();
      localAnalyser.fftSize = 256;
      localAnalyser.smoothingTimeConstant = 0.8;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(localAnalyser);
      startVisualizerLoop();
    } catch (e) {}
  }

  function setupRemoteVisualizer(stream) {
    if (!audioCtx) return;
    try {
      remoteAnalyser = audioCtx.createAnalyser();
      remoteAnalyser.fftSize = 256;
      remoteAnalyser.smoothingTimeConstant = 0.8;
      const remoteSource = audioCtx.createMediaStreamSource(stream);
      remoteSource.connect(remoteAnalyser);
      startVisualizerLoop();
    } catch (e) {}
  }

  function startVisualizerLoop() {
    if (animFrameId) return;
    const dataArray = new Uint8Array(128);

    function render() {
      animFrameId = requestAnimationFrame(render);
      const activeAnalyser = isTransmitting ? localAnalyser : (hasRemotePeer ? remoteAnalyser : null);

      if (activeAnalyser) {
        try { activeAnalyser.getByteTimeDomainData(dataArray); } catch (e) {}
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
        peerStatusHintMobile.textContent = '● Direct Audio Link Ready (Hold PTT to talk)';
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

  // --- WebRTC PeerConnection Setup (Bi-directional Audio Guaranteed) ---
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

    // CRITICAL: Always create an audio transceiver with direction 'sendrecv'
    // This guarantees that the phone negotiates bidirectional audio even before mic is grabbed!
    const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

    if (localAudioTrack) {
      try {
        transceiver.sender.replaceTrack(localAudioTrack);
        console.log('[WebRTC Phone] Initialized transceiver with local mic track.');
      } catch (e) {
        console.warn('Track initialization note:', e);
      }
    }

    // Remote Audio Playout (When Laptop Speaks -> Plays on Phone)
    pc.ontrack = (event) => {
      console.log('[WebRTC Phone] Remote audio incoming from laptop:', event.track);
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0] || new MediaStream([event.track]);
        remoteAudio.muted = false;
        remoteAudio.volume = 1.0;
        const p = remoteAudio.play();
        if (p !== undefined) {
          p.catch(e => console.warn('Phone autoplay wait:', e));
        }
      }
      setupRemoteVisualizer(event.streams[0] || new MediaStream([event.track]));
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

  // --- Push-To-Talk Controller (Guaranteed Transmit to Laptop) ---
  async function handlePttDown() {
    if (!isConnected || !hasRemotePeer || isTransmitting) return;

    unlockAudio();

    // 1. Ensure phone microphone is acquired
    if (!localAudioTrack || localAudioTrack.readyState !== 'live') {
      await initMicrophone();
    }

    isTransmitting = true;
    setAppState('transmitting');
    soundFx.playMicClick();

    if ('vibrate' in navigator) {
      try { navigator.vibrate(40); } catch (e) {}
    }

    // 2. UNMUTE MICROPHONE HARDWARE TRACK
    if (localAudioTrack) {
      localAudioTrack.enabled = true;
      console.log('[Phone PTT] Microphone UNMUTED and streaming audio to laptop!');
    }

    // 3. Ensure track is actively placed on sender
    if (pc && localAudioTrack) {
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
      if (audioSender && audioSender.track !== localAudioTrack) {
        await audioSender.replaceTrack(localAudioTrack);
      }
    }

    // 4. Notify signaling server
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

    // MUTE MICROPHONE
    if (localAudioTrack) {
      localAudioTrack.enabled = false;
      console.log('[Phone PTT] Microphone MUTED.');
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
          if (statusLabelMobile) statusLabelMobile.textContent = 'ONLINE // ARMED';
          if (pttBtnMobile) pttBtnMobile.disabled = false;
          if (pttTextMobile) pttTextMobile.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
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
        if (pttTextMobile) pttTextMobile.textContent = 'TRANSMITTING';
        if (pttSubtextMobile) pttSubtextMobile.textContent = 'RELEASE TO FINISH';
        break;

      case 'receiving':
        body.classList.add('state-receiving', 'peer-connected');
        if (statusLabelMobile) statusLabelMobile.textContent = 'INCOMING VOICE';
        if (pttTextMobile) pttTextMobile.textContent = 'LISTENING';
        if (pttSubtextMobile) pttSubtextMobile.textContent = `${laptopName.toUpperCase()} TALKING`;
        break;
    }
  }

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

      // Join explicitly as 'phone'
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
          createPeerConnection(data.isInitiator);
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
            } catch (err) {}
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

    if (mode === 'wifi') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (doReconnect) {
        connectIntercom('directlink-master', '849201', currentPairToken);
      }
    } else if (mode === 'wan') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (doReconnect) {
        connectIntercom('directlink-master', '849201', currentPairToken);
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
    if (doReconnect) {
      connectIntercom(rfRoomId, '849201', currentPairToken);
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

  // --- Touch & Click PTT Event Listeners ---
  if (pttBtnMobile) {
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

    window.addEventListener('mouseup', () => {
      if (!isToggleMode && isTransmitting) handlePttUp();
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

  // Drawers & Modals
  if (btnMobileSettings) btnMobileSettings.addEventListener('click', () => drawerSettings && drawerSettings.classList.remove('hidden'));
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => drawerSettings && drawerSettings.classList.add('hidden'));

  if (btnMobileDiag) btnMobileDiag.addEventListener('click', () => drawerDiagnostics && drawerDiagnostics.classList.remove('hidden'));
  if (btnCloseDiag) btnCloseDiag.addEventListener('click', () => drawerDiagnostics && drawerDiagnostics.classList.add('hidden'));

  if (btnMobilePair) btnMobilePair.addEventListener('click', () => pairingModal && pairingModal.classList.remove('hidden'));
  if (btnCancelModal) btnCancelModal.addEventListener('click', () => pairingModal && pairingModal.classList.add('hidden'));

  if (sliderGainMobile) {
    sliderGainMobile.addEventListener('input', (e) => {
      const val = e.target.value;
      if (mobileGainValue) mobileGainValue.textContent = `${val}%`;
      localStorage.setItem('directlink_gain', val);
    });
  }

  if (selectRogerMobile) {
    selectRogerMobile.addEventListener('change', (e) => {
      soundFx.setTone(e.target.value);
      localStorage.setItem('directlink_roger_tone', e.target.value);
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
    const savedTone = localStorage.getItem('directlink_roger_tone');
    if (savedTone && selectRogerMobile) {
      selectRogerMobile.value = savedTone;
      soundFx.setTone(savedTone);
    }

    const savedMode = localStorage.getItem('directlink_active_mode') || 'wifi';
    const savedRf = localStorage.getItem('directlink_rf_freq') || '462.5625|CH 01';
    currentRfSetting = savedRf;
    if (selectRadioFreq) selectRadioFreq.value = savedRf;

    // Fetch server info
    try {
      const { httpOrigin } = resolveServerEndpoints();
      const res = await fetch(`${httpOrigin}/api/info`);
      if (res.ok) serverInfo = await res.json();
    } catch (e) {}

    // Auto-connect to master channel
    const masterRoom = serverInfo.bondedPair ? serverInfo.bondedPair.roomId : (localStorage.getItem('directlink_room') || 'directlink-master');
    const masterPin = serverInfo.bondedPair ? serverInfo.bondedPair.pin : (localStorage.getItem('directlink_pin') || '849201');
    const pairToken = serverInfo.bondedPair ? serverInfo.bondedPair.pairToken : localStorage.getItem('directlink_pair_token');

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
