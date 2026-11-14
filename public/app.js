/**
 * DirectLink Walkie-Talkie Client
 * WebRTC P2P + Low-Latency Intercom Engine
 */

(() => {
  // --- DOM Elements ---
  const body = document.body;
  const displayRoom = document.getElementById('displayRoom');
  const statusLabel = document.getElementById('statusLabel');
  const statusBanner = document.getElementById('statusBanner');
  const deviceBadge = document.getElementById('deviceBadge');
  const oscilloscope = document.getElementById('oscilloscope');
  const pttBtn = document.getElementById('pttBtn');
  const pttText = document.getElementById('pttText');
  const pttSubtext = document.getElementById('pttSubtext');
  const keyboardHint = document.getElementById('keyboardHint');

  const btnPairing = document.getElementById('btnPairing');
  const btnModeToggle = document.getElementById('btnModeToggle');
  const modeText = document.getElementById('modeText');
  const btnSoundFx = document.getElementById('btnSoundFx');
  const btnTunnel = document.getElementById('btnTunnel');
  const tunnelText = document.getElementById('tunnelText');

  const pairingModal = document.getElementById('pairingModal');
  const inputRoom = document.getElementById('inputRoom');
  const inputPin = document.getElementById('inputPin');
  const selectNetwork = document.getElementById('selectNetwork');
  const qrImage = document.getElementById('qrImage');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnConnect = document.getElementById('btnConnect');

  const remoteAudio = document.getElementById('remoteAudio');

  // --- State Variables ---
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let isLaptop = !isMobile;
  let currentRoomId = '';
  let currentPin = '';
  let ws = null;
  let pc = null;
  let dataChannel = null;
  let localStream = null;
  let localAudioTrack = null;
  let wakeLock = null;
  let pendingCandidates = [];
  let stopTimer = null;

  let isConnected = false;
  let isTransmitting = false;
  let isReceiving = false;
  let isToggleMode = false; // false = Hold-to-Talk, true = Tap-to-Talk toggle
  let hasRemotePeer = false;

  let serverInfo = {
    localIps: [],
    httpsPort: 8443,
    tunnelUrl: null,
    isTunneling: false
  };

  // --- Web Audio & Visualizer Setup ---
  let audioCtx = null;
  let localAnalyser = null;
  let remoteAnalyser = null;
  let localSource = null;
  let remoteSource = null;
  let animFrameId = null;
  let audioUnlocked = false;

  // Global Audio Unlocker for Mobile Safari / Android Autoplay Policies
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    if (window.soundEffects) {
      window.soundEffects.init();
    }

    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    // Touch remoteAudio so subsequent automatic playouts are permitted by the browser
    if (remoteAudio) {
      const playPromise = remoteAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (!remoteAudio.srcObject) remoteAudio.pause();
        }).catch(() => {});
      }
    }
  }

  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });

  // --- Initialize UI & Device Detection ---
  deviceBadge.textContent = isMobile ? 'Mobile Phone' : 'Laptop / PC';
  if (isMobile) {
    keyboardHint.style.display = 'none';
  }

  // Parse URL hash if scanning a QR code: #room=NAME&pin=123456
  function parseUrlHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const room = params.get('room');
    const pin = params.get('pin');
    if (room && pin) {
      return { room, pin };
    }
    return null;
  }

  // Generate random room & 6-digit PIN if not already set
  function generateDefaultCredentials() {
    const randomHex = Math.random().toString(16).substring(2, 6);
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    return {
      room: `tactical-${randomHex}`,
      pin: randomPin
    };
  }

  // --- Network Info & QR Code ---
  async function fetchServerInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        serverInfo = await res.json();
        updateNetworkOptions();
        updateTunnelButtonState();
      }
    } catch (e) {
      console.warn('Could not fetch server info:', e);
    }
  }

  function updateTunnelButtonState() {
    if (serverInfo.isTunneling) {
      btnTunnel.classList.add('active');
      tunnelText.textContent = 'WAN Active';
    } else {
      btnTunnel.classList.remove('active');
      tunnelText.textContent = 'Mobile Data WAN';
    }
  }

  function updateNetworkOptions() {
    selectNetwork.innerHTML = '';

    // Local Wi-Fi options
    if (serverInfo.localIps && serverInfo.localIps.length > 0) {
      serverInfo.localIps.forEach(({ name, ip }) => {
        const opt = document.createElement('option');
        opt.value = `https://${ip}:${serverInfo.httpsPort}`;
        opt.textContent = `Wi-Fi (${ip}) [${name}]`;
        selectNetwork.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = window.location.origin;
      opt.textContent = `Current Origin (${window.location.host})`;
      selectNetwork.appendChild(opt);
    }

    // Tunnel option if active
    if (serverInfo.tunnelUrl) {
      const opt = document.createElement('option');
      opt.value = serverInfo.tunnelUrl;
      opt.textContent = `Mobile Data Tunnel (${serverInfo.tunnelUrl})`;
      selectNetwork.appendChild(opt);
      selectNetwork.value = serverInfo.tunnelUrl;
    }

    updateQrCode();
  }

  function getShareableUrl() {
    const base = selectNetwork.value || window.location.origin;
    const room = inputRoom.value.trim();
    const pin = inputPin.value.trim();
    return `${base}/#room=${encodeURIComponent(room)}&pin=${encodeURIComponent(pin)}`;
  }

  async function updateQrCode() {
    const url = getShareableUrl();
    try {
      const qrApiUrl = `/api/qr?text=${encodeURIComponent(url)}`;
      qrImage.src = qrApiUrl;
    } catch (err) {
      console.warn('QR update error:', err);
    }
  }

  selectNetwork.addEventListener('change', updateQrCode);
  inputRoom.addEventListener('input', updateQrCode);
  inputPin.addEventListener('input', updateQrCode);

  btnCopyLink.addEventListener('click', async () => {
    const url = getShareableUrl();
    try {
      await navigator.clipboard.writeText(url);
      btnCopyLink.querySelector('span').textContent = 'Copied to Clipboard!';
      setTimeout(() => {
        btnCopyLink.querySelector('span').textContent = 'Copy Invite Link';
      }, 2000);
    } catch (err) {
      prompt('Copy this link:', url);
    }
  });

  // Toggle Mobile Data / Internet Tunnel
  btnTunnel.addEventListener('click', async () => {
    const shouldEnable = !serverInfo.isTunneling;
    tunnelText.textContent = shouldEnable ? 'Connecting...' : 'Closing...';
    try {
      const res = await fetch('/api/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: shouldEnable })
      });
      const data = await res.json();
      if (data.success) {
        serverInfo.isTunneling = shouldEnable;
        serverInfo.tunnelUrl = data.tunnelUrl;
        updateTunnelButtonState();
        await fetchServerInfo();
        if (serverInfo.tunnelUrl) {
          selectNetwork.value = serverInfo.tunnelUrl;
          updateQrCode();
        }
      }
    } catch (e) {
      alert('Tunnel toggle failed: ' + e.message);
      updateTunnelButtonState();
    }
  });

  // Sound FX Toggle
  btnSoundFx.addEventListener('click', () => {
    window.soundEffects.enabled = !window.soundEffects.enabled;
    btnSoundFx.classList.toggle('active', window.soundEffects.enabled);
  });

  // PTT Mode Toggle (Hold vs Tap)
  btnModeToggle.addEventListener('click', () => {
    isToggleMode = !isToggleMode;
    btnModeToggle.classList.toggle('active', isToggleMode);
    modeText.textContent = isToggleMode ? 'Toggle Mode' : 'Hold Mode';
    pttSubtext.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
  });

  // Pairing Modal display
  btnPairing.addEventListener('click', () => {
    fetchServerInfo().then(updateQrCode);
    btnCancelModal.style.display = isConnected ? 'block' : 'none';
    pairingModal.classList.remove('hidden');
  });

  btnCancelModal.addEventListener('click', () => {
    pairingModal.classList.add('hidden');
  });

  // --- Screen Wake Lock (keeps mobile screen awake) ---
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  // Re-acquire wake lock if tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isConnected) {
      requestWakeLock();
    }
  });

  // --- Dual-Analyser Waveform Oscilloscope ---
  function ensureAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function setupLocalVisualizer(stream) {
    try {
      ensureAudioCtx();
      if (!localAnalyser) {
        localAnalyser = audioCtx.createAnalyser();
        localAnalyser.fftSize = 256;
        localAnalyser.smoothingTimeConstant = 0.8;
      }
      if (localSource) localSource.disconnect();
      localSource = audioCtx.createMediaStreamSource(stream);
      localSource.connect(localAnalyser);
      startVisualizerLoop();
    } catch (e) {
      console.warn('Local visualizer setup error:', e);
    }
  }

  function setupRemoteVisualizer(stream) {
    try {
      ensureAudioCtx();
      if (!remoteAnalyser) {
        remoteAnalyser = audioCtx.createAnalyser();
        remoteAnalyser.fftSize = 256;
        remoteAnalyser.smoothingTimeConstant = 0.8;
      }
      if (remoteSource) remoteSource.disconnect();
      remoteSource = audioCtx.createMediaStreamSource(stream);
      remoteSource.connect(remoteAnalyser);
      startVisualizerLoop();
    } catch (e) {
      console.warn('Remote visualizer setup error:', e);
    }
  }

  function startVisualizerLoop() {
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(drawVisualizer);
    }
  }

  function drawVisualizer() {
    animFrameId = requestAnimationFrame(drawVisualizer);
    const canvas = oscilloscope;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    let activeAnalyser = null;
    let strokeColor = 'rgba(0, 255, 204, 0.25)';

    if (isTransmitting && localAnalyser) {
      activeAnalyser = localAnalyser;
      strokeColor = '#ff3366';
    } else if (isReceiving && remoteAnalyser) {
      activeAnalyser = remoteAnalyser;
      strokeColor = '#00b4d8';
    }

    if (!activeAnalyser) {
      // Idle baseline
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const data = new Uint8Array(activeAnalyser.frequencyBinCount);
    activeAnalyser.getByteTimeDomainData(data);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = strokeColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = strokeColor;

    ctx.beginPath();
    const sliceWidth = width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // --- Audio Hardware Setup ---
  async function initMicrophone() {
    if (localStream) return localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          latency: 0.01
        },
        video: false
      });

      localAudioTrack = localStream.getAudioTracks()[0];
      // Keep disabled by default in standby
      localAudioTrack.enabled = false;
      setupLocalVisualizer(localStream);
      return localStream;
    } catch (err) {
      console.error('Microphone access denied or unavailable:', err);
      alert('Microphone permission required for walkie-talkie audio. Please allow access.');
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
      try {
        pc.close();
      } catch (e) {}
    }
    pendingCandidates = [];

    pc = new RTCPeerConnection(rtcConfig);

    // Attach local mic track
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Remote audio track handling (AUTOMATIC PLAYOUT - NO PICKUP REQUIRED)
    pc.ontrack = (event) => {
      console.log('Incoming remote audio stream connected!');
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play().catch(e => console.warn('Audio play autoplay prompt:', e));
      setupRemoteVisualizer(event.streams[0]);
    };

    // ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'signal',
          signal: { candidate: event.candidate }
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setAppState('standby');
        window.soundEffects.playConnectChime();
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        if (hasRemotePeer) {
          console.warn('ICE connection disconnected or failed, restarting ICE...');
          if (pc.restartIce) {
            pc.restartIce();
          }
        }
      }
    };

    // Low-latency PTT status data channel
    if (willBeOfferer) {
      dataChannel = pc.createDataChannel('ptt-channel', { ordered: true });
      setupDataChannel();
    } else {
      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
      };
    }
  }

  function setupDataChannel() {
    if (!dataChannel) return;
    dataChannel.onopen = () => console.log('PTT DataChannel Open');
    dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleRemotePttSignal(msg);
      } catch (e) {}
    };
  }

  async function drainIceCandidates() {
    while (pendingCandidates.length > 0) {
      const candidate = pendingCandidates.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Error adding queued ICE candidate:', e);
      }
    }
  }

  // --- Push-to-Talk Transmission Control ---
  function startTransmission() {
    if (!isConnected || !hasRemotePeer || isTransmitting || isReceiving) return;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    isTransmitting = true;

    if (localAudioTrack) {
      localAudioTrack.enabled = true;
    }

    window.soundEffects.playMicClick();
    if (navigator.vibrate) navigator.vibrate([25]);

    broadcastPttStatus('transmitting');
    setAppState('transmitting');
  }

  function stopTransmission() {
    if (!isTransmitting) return;
    isTransmitting = false;

    window.soundEffects.playRogerBeep();
    broadcastPttStatus('idle');
    setAppState('standby');

    // Retain mic track enabled for ~80ms buffer so end of speech is not clipped
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      if (!isTransmitting && localAudioTrack) {
        localAudioTrack.enabled = false;
      }
    }, 80);
  }

  function broadcastPttStatus(state) {
    const payload = JSON.stringify({ type: 'ptt-status', state });
    // Send over fast DataChannel
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(payload);
    }
    // Also send over WebSocket for redundancy
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }

  function handleRemotePttSignal(msg) {
    if (msg.type !== 'ptt-status') return;

    if (msg.state === 'transmitting') {
      if (isReceiving) return; // Deduplicate
      isReceiving = true;
      setAppState('receiving');
      window.soundEffects.playMicClick();
      if (navigator.vibrate) navigator.vibrate([20]);
    } else if (msg.state === 'idle') {
      if (!isReceiving) return; // Deduplicate
      isReceiving = false;
      setAppState('standby');
      window.soundEffects.playRogerBeep();
    }
  }

  // --- UI State Management ---
  function setAppState(state) {
    body.className = `state-${state}`;
    switch (state) {
      case 'disconnected':
        statusLabel.textContent = 'DISCONNECTED';
        statusBanner.textContent = 'PAIR & CONNECT TO START';
        pttBtn.disabled = true;
        pttText.textContent = 'OFFLINE';
        pttSubtext.textContent = 'NOT CONNECTED';
        break;

      case 'connecting':
        statusLabel.textContent = 'CONNECTING';
        statusBanner.textContent = 'CONNECTING TO INTERCOM HUB...';
        pttBtn.disabled = true;
        pttText.textContent = 'WAITING';
        pttSubtext.textContent = 'ESTABLISHING HANDSHAKE';
        break;

      case 'standby':
        statusLabel.textContent = hasRemotePeer ? 'ONLINE // ARMED' : 'WAITING FOR PEER';
        statusBanner.textContent = hasRemotePeer ? 'CHANNEL ARMED - READY TO TALK' : 'WAITING FOR OTHER DEVICE TO JOIN...';
        pttBtn.disabled = !hasRemotePeer;
        pttText.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
        pttSubtext.textContent = hasRemotePeer ? 'AUDIO STANDBY' : 'PAIR SECOND DEVICE';
        break;

      case 'transmitting':
        statusLabel.textContent = 'TRANSMITTING';
        statusBanner.textContent = 'LIVE // YOU ARE BROADCASTING';
        pttText.textContent = 'TALKING';
        pttSubtext.textContent = 'RELEASE TO FINISH';
        break;

      case 'receiving':
        statusLabel.textContent = 'RECEIVING';
        statusBanner.textContent = 'INCOMING VOICE TRANSMISSION';
        pttText.textContent = 'LISTENING';
        pttSubtext.textContent = 'REMOTE DEVICE TALKING';
        break;
    }
  }

  // --- WebSocket & Signaling Handlers ---
  async function connectIntercom(roomId, pin) {
    unlockAudio();
    currentRoomId = roomId;
    currentPin = pin;
    displayRoom.textContent = roomId.toUpperCase();

    setAppState('connecting');
    await initMicrophone();
    requestWakeLock();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to signaling server');
      ws.send(JSON.stringify({
        type: 'join',
        roomId: currentRoomId,
        pin: currentPin,
        role: isMobile ? 'phone' : 'laptop',
        deviceName: isMobile ? 'Mobile' : 'Laptop'
      }));
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
          const isInitiator = data.isInitiator;
          createPeerConnection(isInitiator);
          if (data.peerCount > 1) {
            hasRemotePeer = true;
            setAppState('standby');
          } else {
            hasRemotePeer = false;
            setAppState('standby');
          }
          break;
        }

        case 'peer-joined': {
          console.log('Peer joined channel:', data.peer);
          hasRemotePeer = true;
          setAppState('standby');
          window.soundEffects.playConnectChime();

          // Reset peer connection for a clean session and create offer
          createPeerConnection(true);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({
              type: 'signal',
              signal: { sdp: pc.localDescription }
            }));
          } catch (err) {
            console.error('Failed to create offer:', err);
          }
          break;
        }

        case 'peer-status': {
          hasRemotePeer = true;
          setAppState('standby');
          break;
        }

        case 'peer-left': {
          console.log('Peer left channel');
          hasRemotePeer = false;
          setAppState('standby');
          window.soundEffects.playDisconnectChime();
          break;
        }

        case 'signal': {
          if (!pc) return;
          const { sdp, candidate } = data.signal;
          if (sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await drainIceCandidates();

            if (sdp.type === 'offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({
                type: 'signal',
                signal: { sdp: pc.localDescription }
              }));
            }
          } else if (candidate) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.warn('Error adding ICE candidate:', e);
              }
            } else {
              pendingCandidates.push(candidate);
            }
          }
          break;
        }

        case 'ptt-status': {
          handleRemotePttSignal(data);
          break;
        }

        case 'error': {
          alert('Intercom Error: ' + data.message);
          setAppState('disconnected');
          pairingModal.classList.remove('hidden');
          break;
        }
      }
    };

    ws.onclose = () => {
      console.log('Signaling connection lost');
      isConnected = false;
      hasRemotePeer = false;
      setAppState('disconnected');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  // --- PTT Button Interaction Handlers ---
  function handlePttDown(e) {
    if (e) e.preventDefault();
    unlockAudio();
    if (!isConnected || !hasRemotePeer) return;

    if (isToggleMode) {
      if (isTransmitting) {
        stopTransmission();
      } else {
        startTransmission();
      }
    } else {
      startTransmission();
    }
  }

  function handlePttUp(e) {
    if (e) e.preventDefault();
    if (!isToggleMode && isTransmitting) {
      stopTransmission();
    }
  }

  // Touch Events (Mobile Phone)
  pttBtn.addEventListener('touchstart', handlePttDown, { passive: false });
  pttBtn.addEventListener('touchend', handlePttUp, { passive: false });
  pttBtn.addEventListener('touchcancel', handlePttUp, { passive: false });

  // Mouse Events (Laptop / Desktop)
  pttBtn.addEventListener('mousedown', (e) => {
    if (e.button === 0) handlePttDown(e);
  });
  window.addEventListener('mouseup', handlePttUp);

  // Keyboard Spacebar Handling for Laptop
  let isSpacePressed = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      // Don't trigger if modal is open
      if (!pairingModal.classList.contains('hidden')) {
        return;
      }
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      e.preventDefault();
      isSpacePressed = true;
      handlePttDown();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isSpacePressed) {
      e.preventDefault();
      isSpacePressed = false;
      handlePttUp();
    }
  });

  // --- Connect Form Action ---
  btnConnect.addEventListener('click', () => {
    unlockAudio();
    const room = inputRoom.value.trim().toLowerCase();
    const pin = inputPin.value.trim();
    if (!room || !pin) {
      alert('Please enter both Channel Name and 6-digit PIN');
      return;
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      alert('PIN must be exactly 6 digits (numbers only)');
      return;
    }
    connectIntercom(room, pin);
  });

  // --- Initial Startup & Auto-Join check ---
  window.addEventListener('DOMContentLoaded', async () => {
    const credentials = parseUrlHash();
    if (credentials) {
      // Pre-fill credentials from QR Code scan
      inputRoom.value = credentials.room;
      inputPin.value = credentials.pin;
      await fetchServerInfo();
      btnConnect.textContent = `Connect to ${credentials.room.toUpperCase()}`;
      pairingModal.classList.remove('hidden');
    } else {
      // Default setup
      const defaults = generateDefaultCredentials();
      inputRoom.value = defaults.room;
      inputPin.value = defaults.pin;
      await fetchServerInfo();
      pairingModal.classList.remove('hidden');
    }
  });

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    releaseWakeLock();
    if (ws) ws.close();
    if (pc) pc.close();
  });

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err.message);
    });
  }
})();
