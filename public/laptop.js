/**
 * DirectLink Laptop Command Base Station
 * Dedicated Client Script for Laptop Station HUD
 */

(() => {
  // --- DOM Elements ---
  const body = document.body;
  const bondBadge = document.getElementById('bondBadge');
  const bondStatusText = document.getElementById('bondStatusText');
  const pingBadge = document.getElementById('pingBadge');
  const pingValue = document.getElementById('pingValue');
  const linkBadge = document.getElementById('linkBadge');

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
  const chkEchoCancel = document.getElementById('chkEchoCancel');
  const chkNoiseSupp = document.getElementById('chkNoiseSupp');
  const valIceState = document.getElementById('valIceState');
  const valLatency = document.getElementById('valLatency');
  const btnModeLaptop = document.getElementById('btnModeLaptop');
  const modeTextLaptop = document.getElementById('modeTextLaptop');
  const btnTunnelLaptop = document.getElementById('btnTunnelLaptop');
  const tunnelTextLaptop = document.getElementById('tunnelTextLaptop');
  const btnPairingLaptop = document.getElementById('btnPairingLaptop');
  const btnResetBondLaptop = document.getElementById('btnResetBondLaptop');
  const activityLog = document.getElementById('activityLog');

  // Pairing Modal
  const pairingModal = document.getElementById('pairingModal');
  const inputServer = document.getElementById('inputServer');
  const inputRoom = document.getElementById('inputRoom');
  const inputPin = document.getElementById('inputPin');
  const qrImage = document.getElementById('qrImage');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnConnect = document.getElementById('btnConnect');

  // Remote Audio Element
  const remoteAudio = document.getElementById('remoteAudio');

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
  let localStream = null;
  let localAudioTrack = null;
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

  // Audio DSP Graph
  let audioCtx = null;
  let localAnalyser = null;
  let remoteAnalyser = null;
  let userGainMultiplier = 1.0;
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

    if (remoteAudio) {
      remoteAudio.muted = false;
      remoteAudio.volume = 1.0;
      const p = remoteAudio.play();
      if (p !== undefined) {
        p.then(() => { if (!remoteAudio.srcObject) remoteAudio.pause(); }).catch(() => {});
      }
    }
  }

  ['keydown', 'mousedown', 'click'].forEach(evt => {
    window.addEventListener(evt, () => {
      unlockAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }, { once: false, passive: true });
  });

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

  // --- Microphone Hardware Initialization ---
  async function initMicrophone() {
    if (localAudioTrack && localAudioTrack.readyState === 'live') {
      return localAudioTrack;
    }

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

      localStream = rawStream;
      localAudioTrack = rawStream.getAudioTracks()[0];
      localAudioTrack.enabled = false; // Standby muted

      setupLocalVisualizer(rawStream);

      // Inject into WebRTC audio sender
      if (pc) {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders.find(s => !s.track);
        if (audioSender) {
          await audioSender.replaceTrack(localAudioTrack);
        } else {
          pc.addTrack(localAudioTrack, localStream);
        }
      }

      logEvent('Microphone hardware armed & ready for broadcast.');
      return localAudioTrack;
    } catch (err) {
      logEvent(`Mic warning: ${err.message}`);
      return null;
    }
  }

  // --- Visualizer & VU Meter Canvas Loop ---
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
        peerStatusHintLaptop.textContent = '● Live Direct Audio Link (Hold SPACEBAR to broadcast)';
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

  // --- WebRTC PeerConnection Setup (Guaranteed Bi-directional Audio) ---
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
    const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

    if (localAudioTrack) {
      try {
        transceiver.sender.replaceTrack(localAudioTrack);
      } catch (e) {}
    }

    // Remote Audio Playout (When Phone Speaks -> Plays on Laptop)
    pc.ontrack = (event) => {
      console.log('[WebRTC Laptop] Incoming audio track from phone:', event.track);
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0] || new MediaStream([event.track]);
        remoteAudio.muted = false;
        remoteAudio.volume = 1.0;
        const p = remoteAudio.play();
        if (p !== undefined) {
          p.catch(e => console.warn('Laptop remote audio play warning:', e));
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

  // --- Push-To-Talk Controller ---
  async function handlePttDown() {
    if (!isConnected || !hasRemotePeer || isTransmitting) return;

    unlockAudio();

    if (!localAudioTrack || localAudioTrack.readyState !== 'live') {
      await initMicrophone();
    }

    isTransmitting = true;
    setAppState('transmitting');
    soundFx.playMicClick();

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
          if (statusLabelLaptop) statusLabelLaptop.textContent = 'ARMED';
          if (statusBannerLaptop) statusBannerLaptop.textContent = `CHANNEL ARMED // ${phoneName.toUpperCase()} READY`;
          if (pttBtnLaptop) pttBtnLaptop.disabled = false;
          if (pttTextLaptop) pttTextLaptop.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
          if (pttSubtextLaptop) pttSubtextLaptop.textContent = 'SPACEBAR ARMED';
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
        if (pttTextLaptop) pttTextLaptop.textContent = 'TALKING';
        if (pttSubtextLaptop) pttSubtextLaptop.textContent = 'RELEASE SPACEBAR TO STOP';
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

      // Join explicitly as 'laptop'
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
          createPeerConnection(data.isInitiator);
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

    if (mode === 'wifi') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (linkBadge) linkBadge.textContent = 'WI-FI LAN';
      if (doReconnect) {
        connectIntercom('directlink-master', '849201', currentPairToken);
      }
    } else if (mode === 'wan') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (linkBadge) linkBadge.textContent = 'WAN RELAY';
      if (doReconnect) {
        connectIntercom('directlink-master', '849201', currentPairToken);
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
    logEvent(`Tuned Walkie-Talkie Frequency: ${mhz} MHz [${channelName}]`);

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

  if (btnModeLaptop) {
    btnModeLaptop.addEventListener('click', () => {
      isToggleMode = !isToggleMode;
      if (modeTextLaptop) modeTextLaptop.textContent = isToggleMode ? 'Toggle Mode' : 'Hold Mode';
      btnModeLaptop.classList.toggle('active', isToggleMode);
      setAppState(isTransmitting ? 'transmitting' : (hasRemotePeer ? 'standby' : 'disconnected'));
    });
  }

  // Audio DSP Sliders
  if (sliderGain) {
    sliderGain.addEventListener('input', (e) => {
      const val = e.target.value;
      userGainMultiplier = val / 100;
      if (gainValueDisplay) gainValueDisplay.textContent = `${val}%`;
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
          updateQrCode();
        }
      } catch (err) {
        alert('Tunnel request failed: ' + err.message);
      }
    });
  }

  // Pairing Modal
  function updateQrCode() {
    if (!qrImage) return;
    const base = serverInfo.tunnelUrl || `http://${window.location.hostname}:8080`;
    const url = `${base}/phone#room=${encodeURIComponent(currentRoomId)}&pin=${encodeURIComponent(currentPin)}&server=${encodeURIComponent(base)}`;
    qrImage.src = `/api/qr?text=${encodeURIComponent(url)}`;
  }

  if (btnPairingLaptop) {
    btnPairingLaptop.addEventListener('click', () => {
      if (pairingModal) pairingModal.classList.remove('hidden');
      updateQrCode();
    });
  }

  if (btnCancelModal) {
    btnCancelModal.addEventListener('click', () => pairingModal && pairingModal.classList.add('hidden'));
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', async () => {
      const base = serverInfo.tunnelUrl || `http://${window.location.hostname}:8080`;
      const url = `${base}/phone#room=${encodeURIComponent(currentRoomId)}&pin=${encodeURIComponent(currentPin)}&server=${encodeURIComponent(base)}`;
      try {
        await navigator.clipboard.writeText(url);
        alert('Phone link copied! Open it on your phone.');
      } catch (e) {
        prompt('Copy this link:', url);
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
    const savedTone = localStorage.getItem('directlink_roger_tone');
    if (savedTone && selectRogerBeep) {
      selectRogerBeep.value = savedTone;
      soundFx.setTone(savedTone);
    }

    const savedMode = localStorage.getItem('directlink_active_mode') || 'wifi';
    const savedRf = localStorage.getItem('directlink_rf_freq') || '462.5625|CH 01';
    currentRfSetting = savedRf;
    if (selectRadioFreq) selectRadioFreq.value = savedRf;

    try {
      const { httpOrigin } = resolveServerEndpoints();
      const res = await fetch(`${httpOrigin}/api/info`);
      if (res.ok) serverInfo = await res.json();
    } catch (e) {}

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
})();
