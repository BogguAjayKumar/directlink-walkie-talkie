/**
 * DirectLink Tactical Walkie-Talkie Client
 * Multi-Interface WebRTC Intercom with Exclusive Laptop <-> Phone Bonding,
 * 3-Way Mode Switching (Local Wi-Fi, Mobile Data WAN, Virtual RF Radio),
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

  // 3-Way Mode Selector Strip
  const btnModeWifi = document.getElementById('btnModeWifi');
  const btnModeWan = document.getElementById('btnModeWan');
  const btnModeFreq = document.getElementById('btnModeFreq');

  // Virtual Radio Frequency Tuner Bar (Mode 3)
  const freqTunerBar = document.getElementById('freqTunerBar');
  const currentFreqValue = document.getElementById('currentFreqValue');
  const currentFreqChannel = document.getElementById('currentFreqChannel');
  const selectRadioFreq = document.getElementById('selectRadioFreq');
  const customFreqBox = document.getElementById('customFreqBox');
  const inputCustomFreq = document.getElementById('inputCustomFreq');
  const btnApplyFreq = document.getElementById('btnApplyFreq');

  // Prominent Device Connection Status Banners
  const peerStatusBannerLaptop = document.getElementById('peerStatusBannerLaptop');
  const peerStatusDeviceNameLaptop = document.getElementById('peerStatusDeviceNameLaptop');
  const peerStatusHintLaptop = document.getElementById('peerStatusHintLaptop');

  const peerStatusBannerMobile = document.getElementById('peerStatusBannerMobile');
  const peerStatusDeviceNameMobile = document.getElementById('peerStatusDeviceNameMobile');
  const peerStatusHintMobile = document.getElementById('peerStatusHintMobile');

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
  let localDeviceName = isMobilePlatform ? 'Handheld Phone' : 'Command Laptop';

  // Check URL parameters for role override
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('role')) {
    deviceRole = urlParams.get('role');
    localDeviceName = deviceRole === 'phone' ? 'Handheld Phone' : 'Command Laptop';
  }

  let activeIntercomMode = 'wifi'; // 'wifi' | 'wan' | 'freq'
  let currentRfSetting = '462.5625|CH 01';

  let currentRoomId = '';
  let currentPin = '';
  let currentPairToken = null;
  let isBondedMaster = false;

  let ws = null;
  let pc = null;
  let localStream = null;
  let localAudioTrack = null;
  let remotePeerInfo = null;
  let wakeLock = null;
  let reconnectInterval = null;
  let pingInterval = null;
  let rttLatency = null;
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
  let micGainNode = null;
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

  // Segmented Role & View Switcher Elements
  const btnSwitchLaptop = document.getElementById('btnSwitchLaptop');
  const btnSwitchPhone = document.getElementById('btnSwitchPhone');

  // --- View Mode & Device Role Management ---
  function switchRoleAndView(role, doReconnect = true) {
    deviceRole = role;
    currentView = (role === 'laptop') ? 'laptop' : 'mobile';
    localDeviceName = (role === 'laptop') ? 'Command Laptop' : 'Handheld Phone';

    if (role === 'laptop') {
      body.classList.remove('view-mobile');
      body.classList.add('view-laptop');
      if (btnSwitchLaptop) btnSwitchLaptop.classList.add('active');
      if (btnSwitchPhone) btnSwitchPhone.classList.remove('active');
      logEvent('Loaded Interface: COMMAND BASE STATION CONSOLE [LAPTOP]');
    } else {
      body.classList.remove('view-laptop');
      body.classList.add('view-mobile');
      if (btnSwitchPhone) btnSwitchPhone.classList.add('active');
      if (btnSwitchLaptop) btnSwitchLaptop.classList.remove('active');
      logEvent('Loaded Interface: FIELD WALKIE-TALKIE TRANSCEIVER [PHONE]');
    }

    localStorage.setItem('directlink_assigned_role', role);

    if (doReconnect && ws && ws.readyState === WebSocket.OPEN && currentRoomId) {
      logEvent(`Switching active network role to: ${localDeviceName} (${deviceRole})`);
      ws.send(JSON.stringify({
        type: 'join',
        roomId: currentRoomId,
        pin: currentPin,
        pairToken: currentPairToken,
        role: deviceRole,
        deviceName: localDeviceName
      }));
    }
  }

  if (btnSwitchLaptop) {
    btnSwitchLaptop.addEventListener('click', () => switchRoleAndView('laptop', true));
  }

  if (btnSwitchPhone) {
    btnSwitchPhone.addEventListener('click', () => switchRoleAndView('phone', true));
  }

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

    startSilentKeepAlive();

    if (remoteAudio) {
      const p = remoteAudio.play();
      if (p !== undefined) {
        p.then(() => { if (!remoteAudio.srcObject) remoteAudio.pause(); }).catch(() => {});
      }
    }
  }

  // Global user interaction listener to unlock audio on first touch
  ['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
      unlockAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }, { once: false, passive: true });
  });

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
    let host = window.location.host;
    let protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';

    // If running in browser (Chrome/Edge/Safari), always default to current host
    // Only packaged mobile apps (Capacitor file:// or capacitor://) fallback to stored IP
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
      const mode = searchParams.get('mode');
      const freq = searchParams.get('freq');
      const server = searchParams.get('server') || (serverBase && serverBase.startsWith('http') ? serverBase : null);

      if (room || pin || server || token || mode || freq) {
        return { room, pin, server, token, mode, freq };
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
    const base = selectNetwork ? (selectNetwork.value || window.location.origin) : window.location.origin;
    const room = inputRoom ? inputRoom.value.trim() : currentRoomId;
    const pin = inputPin ? inputPin.value.trim() : currentPin;
    const tokenPart = currentPairToken ? `&token=${encodeURIComponent(currentPairToken)}` : '';
    const modePart = activeIntercomMode ? `&mode=${encodeURIComponent(activeIntercomMode)}` : '';
    const freqPart = activeIntercomMode === 'freq' ? `&freq=${encodeURIComponent(currentRfSetting)}` : '';
    return `${base}/#room=${encodeURIComponent(room)}&pin=${encodeURIComponent(pin)}${tokenPart}${modePart}${freqPart}&server=${encodeURIComponent(base)}`;
  }

  async function updateQrCode() {
    if (!qrImage) return;
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
          if (bondStatusText) {
            bondStatusText.textContent = hasRemotePeer
              ? 'BONDED: LAPTOP ↔ PHONE (LIVE)'
              : 'BONDED (PC ↔ PHONE)';
          }
          if (bondBadge) bondBadge.classList.add('badge-bond');
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
        if (tunnelTextLaptop) tunnelTextLaptop.textContent = 'WAN Active';
      } else {
        btnTunnelLaptop.classList.remove('active');
        if (tunnelTextLaptop) tunnelTextLaptop.textContent = 'Mobile Data WAN';
      }
    }
  }

  function updateNetworkOptions() {
    if (!selectNetwork) return;
    selectNetwork.innerHTML = '';

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
        optHttp.value = `http://${ip}:${serverInfo.httpPort || 8080}`;
        optHttp.textContent = `Wi-Fi HTTP (${ip}:${serverInfo.httpPort || 8080}) [APK / Direct]`;
        selectNetwork.appendChild(optHttp);

        const optHttps = document.createElement('option');
        optHttps.value = `https://${ip}:${serverInfo.httpsPort || 8443}`;
        optHttps.textContent = `Wi-Fi HTTPS (${ip}:${serverInfo.httpsPort || 8443}) [Self-Signed]`;
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

  // --- Prominent Device Connection Status Banner Controller ---
  function updatePeerStatusDisplay(isOnline, peer = null) {
    if (peer) remotePeerInfo = peer;
    const targetPeer = peer || remotePeerInfo;
    const peerRole = targetPeer?.role || (deviceRole === 'laptop' ? 'phone' : 'laptop');
    const peerName = targetPeer?.name || (peerRole === 'phone' ? 'Handheld Phone' : 'Command Laptop');

    // Laptop HUD Banner
    if (peerStatusBannerLaptop && peerStatusDeviceNameLaptop && peerStatusHintLaptop) {
      if (isOnline) {
        peerStatusBannerLaptop.classList.remove('offline');
        peerStatusBannerLaptop.classList.add('connected');
        peerStatusDeviceNameLaptop.textContent = `PHONE CONNECTED: ${peerName}`;
        peerStatusHintLaptop.textContent = '● Live Full-Duplex DirectLink Ready (Hold SPACE to talk)';
      } else {
        peerStatusBannerLaptop.classList.add('offline');
        peerStatusBannerLaptop.classList.remove('connected');
        peerStatusDeviceNameLaptop.textContent = 'PHONE DISCONNECTED';
        peerStatusHintLaptop.textContent = 'Waiting for Phone to link...';
      }
    }

    // Mobile Transceiver Banner
    if (peerStatusBannerMobile && peerStatusDeviceNameMobile && peerStatusHintMobile) {
      if (isOnline) {
        peerStatusBannerMobile.classList.remove('offline');
        peerStatusBannerMobile.classList.add('connected');
        peerStatusDeviceNameMobile.textContent = `LAPTOP CONNECTED: ${peerName}`;
        peerStatusHintMobile.textContent = '● Live Full-Duplex DirectLink Ready (Hold PTT to talk)';
      } else {
        peerStatusBannerMobile.classList.add('offline');
        peerStatusBannerMobile.classList.remove('connected');
        peerStatusDeviceNameMobile.textContent = 'LAPTOP DISCONNECTED';
        peerStatusHintMobile.textContent = 'Waiting for Laptop to link...';
      }
    }

    // Header Bond Status Tag
    if (bondStatusText) {
      bondStatusText.textContent = isOnline
        ? `BONDED: LAPTOP ↔ PHONE (LIVE)`
        : `BONDED (PC ↔ PHONE)`;
    }
  }

  // --- 3-Way Mode Switcher Controller ---
  function setIntercomMode(mode, doReconnect = true) {
    activeIntercomMode = mode;
    localStorage.setItem('directlink_active_mode', mode);

    // Update active tab buttons
    if (btnModeWifi) btnModeWifi.classList.toggle('active', mode === 'wifi');
    if (btnModeWan) btnModeWan.classList.toggle('active', mode === 'wan');
    if (btnModeFreq) btnModeFreq.classList.toggle('active', mode === 'freq');

    if (mode === 'wifi') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (linkBadge) {
        linkBadge.textContent = 'WI-FI LAN';
        linkBadge.style.color = '#38bdf8';
      }
      logEvent('Switched to Mode 1: Local Wi-Fi (LAN Direct)');

      if (doReconnect) {
        const masterRoom = serverInfo.bondedPair ? serverInfo.bondedPair.roomId : (localStorage.getItem('directlink_room') || 'directlink-master');
        const masterPin = serverInfo.bondedPair ? serverInfo.bondedPair.pin : (localStorage.getItem('directlink_pin') || '849201');
        const pairToken = serverInfo.bondedPair ? serverInfo.bondedPair.pairToken : currentPairToken;
        connectIntercom(masterRoom, masterPin, pairToken);
      }
    } else if (mode === 'wan') {
      if (freqTunerBar) freqTunerBar.classList.add('hidden');
      if (linkBadge) {
        linkBadge.textContent = 'WAN RELAY';
        linkBadge.style.color = 'var(--accent-ready)';
      }
      logEvent('Switched to Mode 2: Mobile Data + Wi-Fi (Global Relay)');

      // If tunnel is not active, request server to open WAN tunnel
      if (!serverInfo.isTunneling) {
        logEvent('Opening encrypted WAN tunnel for cellular mobile data...');
        const { httpOrigin } = resolveServerEndpoints();
        fetch(`${httpOrigin}/api/tunnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable: true })
        }).then(r => r.json()).then(data => {
          if (data.tunnelUrl) {
            serverInfo.tunnelUrl = data.tunnelUrl;
            serverInfo.isTunneling = true;
            updateTunnelButtonState();
            updateNetworkOptions();
            logEvent(`WAN Relay ready at: ${data.tunnelUrl}`);
          }
        }).catch(err => console.warn('Tunnel request error:', err));
      }

      if (doReconnect) {
        const masterRoom = serverInfo.bondedPair ? serverInfo.bondedPair.roomId : (localStorage.getItem('directlink_room') || 'directlink-master');
        const masterPin = serverInfo.bondedPair ? serverInfo.bondedPair.pin : (localStorage.getItem('directlink_pin') || '849201');
        const pairToken = serverInfo.bondedPair ? serverInfo.bondedPair.pairToken : currentPairToken;
        connectIntercom(masterRoom, masterPin, pairToken);
      }
    } else if (mode === 'freq') {
      if (freqTunerBar) freqTunerBar.classList.remove('hidden');
      if (linkBadge) {
        linkBadge.textContent = 'RF RADIO';
        linkBadge.style.color = '#f59e0b';
      }
      logEvent(`Switched to Mode 3: Radio Frequency Dialing (${currentRfSetting})`);

      applyRfFrequency(currentRfSetting, doReconnect);
    }
  }

  // Apply Radio Frequency & Channel Room Mapping
  function applyRfFrequency(rawSetting, doReconnect = true) {
    currentRfSetting = rawSetting;
    localStorage.setItem('directlink_rf_freq', rawSetting);

    const parts = rawSetting.split('|');
    const mhz = parts[0];
    const channelName = parts[1] || 'CUSTOM';

    if (currentFreqValue) currentFreqValue.textContent = `${mhz} MHz`;
    if (currentFreqChannel) currentFreqChannel.textContent = channelName;

    // Room ID derived deterministically from the frequency
    const sanitizedFreq = mhz.replace(/[^0-9]/g, '-');
    const rfRoomId = `rf-${sanitizedFreq}`;
    const standardPin = serverInfo.bondedPair ? serverInfo.bondedPair.pin : '849201';

    logEvent(`Tuned Walkie-Talkie Frequency: ${mhz} MHz [${channelName}] (Channel: ${rfRoomId})`);

    if (doReconnect) {
      connectIntercom(rfRoomId, standardPin, currentPairToken);
    }
  }

  // Mode Selector Event Listeners
  if (btnModeWifi) btnModeWifi.addEventListener('click', () => setIntercomMode('wifi', true));
  if (btnModeWan) btnModeWan.addEventListener('click', () => setIntercomMode('wan', true));
  if (btnModeFreq) btnModeFreq.addEventListener('click', () => setIntercomMode('freq', true));

  // Frequency Dial Event Listeners
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
      if (!customVal) {
        alert('Please enter a frequency in MHz (e.g. 433.92)');
        return;
      }
      const formatted = `${customVal}|CUSTOM`;
      applyRfFrequency(formatted, true);
    });
  }

  // --- Visualizer & VU Meter Canvas Pipeline ---
  function setupLocalVisualizer(stream) {
    if (!audioCtx) return;
    try {
      localAnalyser = audioCtx.createAnalyser();
      localAnalyser.fftSize = 256;
      localAnalyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(localAnalyser);
      startVisualizerLoop();
    } catch (e) {
      console.warn('Local visualizer error:', e);
    }
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
    } catch (e) {
      console.warn('Remote visualizer error:', e);
    }
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
    const width = canvas.width = canvas.clientWidth || 300;
    const height = canvas.height = canvas.clientHeight || 100;

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

  // --- Microphone & WebRTC Track Setup (Robust & Direct) ---
  async function initMicrophone() {
    if (localStream) return localStream;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Microphone API unavailable. In browser, access via HTTPS or use Android APK.');
      logEvent('Microphone API waiting for secure origin / permission.');
      return null;
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

      // Keep native raw microphone track for zero-latency direct WebRTC transmission!
      localStream = rawStream;
      localAudioTrack = rawStream.getAudioTracks()[0];
      localAudioTrack.enabled = false; // Standby muted

      // Connect to Web Audio Analyser for Oscilloscope visualization
      setupLocalVisualizer(rawStream);

      // If WebRTC connection is already established, attach track immediately
      if (pc && localAudioTrack) {
        const senders = pc.getSenders();
        const hasTrack = senders.some(s => s.track && s.track.kind === 'audio');
        if (!hasTrack) {
          pc.addTrack(localAudioTrack, localStream);
          logEvent('Microphone track attached to active WebRTC session.');
        }
      }

      logEvent('Microphone hardware successfully initialized & armed.');
      return localStream;
    } catch (err) {
      console.warn('Microphone permission or hardware access note:', err.message);
      logEvent(`Mic note: ${err.name} - ${err.message}`);
      return null;
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

    if (localStream && localAudioTrack) {
      try {
        pc.addTrack(localAudioTrack, localStream);
      } catch (e) {
        console.warn('Could not add track:', e);
      }
    }

    // Remote Audio Playout (Immediate Handsfree WebRTC Stream)
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote media track incoming', event.streams[0]);
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0];
        const p = remoteAudio.play();
        if (p !== undefined) {
          p.catch(e => console.warn('Remote audio waiting for interaction:', e));
        }
      }
      setupRemoteVisualizer(event.streams[0]);
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
      if (mobileValIce) mobileValIce.textContent = state.toUpperCase();

      if (state === 'connected' || state === 'completed') {
        hasRemotePeer = true;
        updatePeerStatusDisplay(true, remotePeerInfo);
        setAppState('standby');
        logEvent('P2P Direct DTLS-SRTP Audio Channel Established.');
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
      console.error('Failed to create WebRTC offer:', err);
    }
  }

  // --- Push-To-Talk State Controller ---
  async function handlePttDown() {
    if (!isConnected || !hasRemotePeer || isTransmitting) return;

    unlockAudio();

    // Ensure mic is acquired
    if (!localAudioTrack) {
      await initMicrophone();
    }

    isTransmitting = true;
    setAppState('transmitting');
    soundFx.playMicClick();

    if ('vibrate' in navigator) {
      try { navigator.vibrate(40); } catch (e) {}
    }

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

    const peerName = remotePeerInfo?.name || (deviceRole === 'laptop' ? 'Handheld Phone' : 'Command Laptop');

    switch (state) {
      case 'disconnected':
        body.classList.add('state-disconnected');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'OFFLINE';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'INTERCOM OFFLINE // TAP TO CONNECT';
        if (statusLabelMobile) statusLabelMobile.textContent = 'OFFLINE';
        if (pttBtnLaptop) pttBtnLaptop.disabled = true;
        if (pttBtnMobile) pttBtnMobile.disabled = true;
        if (pttTextLaptop) pttTextLaptop.textContent = 'OFFLINE';
        if (pttTextMobile) pttTextMobile.textContent = 'OFFLINE';
        updatePeerStatusDisplay(false);
        break;

      case 'connecting':
        body.classList.add('state-connecting');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'CONNECTING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'CONNECTING TO SIGNALING HUB...';
        if (statusLabelMobile) statusLabelMobile.textContent = 'CONNECTING...';
        if (pttBtnLaptop) pttBtnLaptop.disabled = true;
        if (pttBtnMobile) pttBtnMobile.disabled = true;
        break;

      case 'reconnecting':
        body.classList.add('state-reconnecting');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'RECONNECTING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'AUTO-RECONNECTING TO BONDED PEER...';
        if (statusLabelMobile) statusLabelMobile.textContent = 'RECONNECTING...';
        if (pttBtnLaptop) pttBtnLaptop.disabled = true;
        if (pttBtnMobile) pttBtnMobile.disabled = true;
        break;

      case 'standby':
        body.classList.add('state-standby');
        if (hasRemotePeer) {
          body.classList.add('peer-connected');
          if (peerLabelLaptop) peerLabelLaptop.textContent = `${peerName.toUpperCase()} ONLINE`;
          if (statusLabelLaptop) statusLabelLaptop.textContent = 'ARMED';
          if (statusBannerLaptop) statusBannerLaptop.textContent = `CHANNEL ARMED // ${peerName.toUpperCase()} READY`;
          if (statusLabelMobile) statusLabelMobile.textContent = 'ONLINE // ARMED';
          if (pttBtnLaptop) pttBtnLaptop.disabled = false;
          if (pttBtnMobile) pttBtnMobile.disabled = false;
          if (pttTextLaptop) pttTextLaptop.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
          if (pttTextMobile) pttTextMobile.textContent = isToggleMode ? 'TAP TO TALK' : 'HOLD TO TALK';
          if (pttSubtextLaptop) pttSubtextLaptop.textContent = 'AUDIO STANDBY';
          if (pttSubtextMobile) pttSubtextMobile.textContent = `BONDED TO ${peerName.toUpperCase()}`;
          updatePeerStatusDisplay(true, remotePeerInfo);
        } else {
          if (peerLabelLaptop) peerLabelLaptop.textContent = 'WAITING PEER';
          if (statusLabelLaptop) statusLabelLaptop.textContent = 'STANDBY';
          if (statusBannerLaptop) statusBannerLaptop.textContent = 'WAITING FOR SECOND DEVICE TO CONNECT...';
          if (statusLabelMobile) statusLabelMobile.textContent = 'WAITING PEER';
          if (pttBtnLaptop) pttBtnLaptop.disabled = true;
          if (pttBtnMobile) pttBtnMobile.disabled = true;
          if (pttTextLaptop) pttTextLaptop.textContent = 'WAITING';
          if (pttTextMobile) pttTextMobile.textContent = 'WAITING';
          updatePeerStatusDisplay(false);
        }
        break;

      case 'transmitting':
        body.classList.add('state-transmitting', 'peer-connected');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'TRANSMITTING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = 'LIVE // YOU ARE BROADCASTING';
        if (statusLabelMobile) statusLabelMobile.textContent = 'TALKING';
        if (pttBtnLaptop) pttBtnLaptop.classList.add('active');
        if (pttBtnMobile) pttBtnMobile.classList.add('active');
        if (pttTextLaptop) pttTextLaptop.textContent = 'TALKING';
        if (pttTextMobile) pttTextMobile.textContent = 'TRANSMITTING';
        if (pttSubtextLaptop) pttSubtextLaptop.textContent = 'RELEASE SPACEBAR TO STOP';
        if (pttSubtextMobile) pttSubtextMobile.textContent = 'RELEASE TO FINISH';
        break;

      case 'receiving':
        body.classList.add('state-receiving', 'peer-connected');
        if (statusLabelLaptop) statusLabelLaptop.textContent = 'RECEIVING';
        if (statusBannerLaptop) statusBannerLaptop.textContent = `INCOMING VOICE FROM ${peerName.toUpperCase()}`;
        if (statusLabelMobile) statusLabelMobile.textContent = 'INCOMING VOICE';
        if (pttTextLaptop) pttTextLaptop.textContent = 'LISTENING';
        if (pttTextMobile) pttTextMobile.textContent = 'LISTENING';
        if (pttSubtextLaptop) pttSubtextLaptop.textContent = `${peerName.toUpperCase()} BROADCASTING`;
        if (pttSubtextMobile) pttSubtextMobile.textContent = `${peerName.toUpperCase()} TALKING`;
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
    if (displayRoomMobile) displayRoomMobile.textContent = roomId.toUpperCase();

    setAppState('connecting');
    initMicrophone().catch(() => {});
    requestWakeLock();

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

      // Join with persistent pairToken for uninterrupted auto-reconnect
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
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      switch (data.type) {
        case 'joined': {
          isConnected = true;
          if (pairingModal) pairingModal.classList.add('hidden');
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
          remotePeerInfo = data.peer || null;
          updatePeerStatusDisplay(true, remotePeerInfo);
          setAppState('standby');
          soundFx.playConnectChime();
          logEvent(`Remote paired device linked: ${remotePeerInfo ? remotePeerInfo.name : 'Peer'}`);
          createPeerConnection(true); // Initiate clean WebRTC handshake
          break;
        }

        case 'peer-status': {
          hasRemotePeer = true;
          remotePeerInfo = data.peer || null;
          updatePeerStatusDisplay(true, remotePeerInfo);
          setAppState('standby');
          soundFx.playConnectChime();
          logEvent(`Connected to active peer: ${remotePeerInfo ? remotePeerInfo.name : 'Peer'}`);
          break;
        }

        case 'peer-left': {
          hasRemotePeer = false;
          updatePeerStatusDisplay(false, remotePeerInfo);
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

  // Mobile PTT Button (Touch & Mouse)
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
  }

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
  if (btnMobileSettings) btnMobileSettings.addEventListener('click', () => drawerSettings && drawerSettings.classList.remove('hidden'));
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => drawerSettings && drawerSettings.classList.add('hidden'));

  if (btnMobileDiag) btnMobileDiag.addEventListener('click', () => drawerDiagnostics && drawerDiagnostics.classList.remove('hidden'));
  if (btnCloseDiag) btnCloseDiag.addEventListener('click', () => drawerDiagnostics && drawerDiagnostics.classList.add('hidden'));

  // Mobile WAN Tunnel Button (Laptop)
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
    if (pairingModal) pairingModal.classList.remove('hidden');
    fetchServerInfo().then(updateQrCode);
  }

  if (btnPairingLaptop) btnPairingLaptop.addEventListener('click', openPairingModal);
  if (btnMobilePair) btnMobilePair.addEventListener('click', openPairingModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', () => pairingModal && pairingModal.classList.add('hidden'));

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
          if (parsed.room && inputRoom) inputRoom.value = parsed.room;
          if (parsed.pin && inputPin) inputPin.value = parsed.pin;
          if (parsed.mode) setIntercomMode(parsed.mode, false);
          if (parsed.freq) applyRfFrequency(parsed.freq, false);
          alert('Invite parameters applied! Click "Connect & Bond Intercom" to start.');
        } else {
          alert('Could not parse link. Please check the URL.');
        }
      }
    });
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', async () => {
      const url = getShareableUrl();
      try {
        await navigator.clipboard.writeText(url);
        const span = btnCopyLink.querySelector('span');
        if (span) {
          span.textContent = 'Copied to Clipboard!';
          setTimeout(() => { span.textContent = 'Copy Invite Link'; }, 2000);
        }
      } catch (err) {
        prompt('Copy this link:', url);
      }
    });
  }

  if (btnConnect) {
    btnConnect.addEventListener('click', () => {
      unlockAudio();
      if (inputServer && inputServer.value.trim()) {
        localStorage.setItem('directlink_server_url', inputServer.value.trim());
      }
      const room = inputRoom ? inputRoom.value.trim().toLowerCase() : '';
      const pin = inputPin ? inputPin.value.trim() : '';
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
  }

  // --- Initial Startup & Auto-Bond Execution ---
  window.addEventListener('DOMContentLoaded', async () => {
    // 1. Determine Initial Interface Role based on Route, Query Parameter, or Screen Size
    const pathname = window.location.pathname.toLowerCase();
    const roleParam = urlParams.get('role');
    const savedRole = localStorage.getItem('directlink_assigned_role');

    let initialRole = 'laptop';
    if (pathname.includes('/phone') || pathname.includes('/mobile') || roleParam === 'phone') {
      initialRole = 'phone';
    } else if (pathname.includes('/laptop') || roleParam === 'laptop') {
      initialRole = 'laptop';
    } else if (isMobilePlatform || window.innerWidth <= 768) {
      initialRole = 'phone';
    } else if (savedRole) {
      initialRole = savedRole;
    }

    switchRoleAndView(initialRole, false);

    // Restore saved settings
    const savedGain = localStorage.getItem('directlink_gain');
    if (savedGain) updateGain(savedGain);

    const savedTone = localStorage.getItem('directlink_roger_tone');
    if (savedTone) updateRogerBeep(savedTone);

    const savedServer = localStorage.getItem('directlink_server_url');
    if (savedServer && inputServer) inputServer.value = savedServer;

    const savedMode = localStorage.getItem('directlink_active_mode') || 'wifi';
    const savedRf = localStorage.getItem('directlink_rf_freq') || '462.5625|CH 01';
    currentRfSetting = savedRf;
    if (selectRadioFreq) selectRadioFreq.value = savedRf;

    // Check URL Hash first (e.g. Scanned via QR code)
    const hashData = parseUrlHash();
    if (hashData && hashData.room && hashData.pin) {
      if (inputRoom) inputRoom.value = hashData.room;
      if (inputPin) inputPin.value = hashData.pin;
      if (hashData.server && inputServer) {
        inputServer.value = hashData.server;
        localStorage.setItem('directlink_server_url', hashData.server);
      }
      if (hashData.mode) {
        setIntercomMode(hashData.mode, false);
      }
      if (hashData.freq) {
        applyRfFrequency(hashData.freq, false);
      }
      logEvent(`Auto-connecting to scanned frequency "${hashData.room}"...`);
      await fetchServerInfo();
      connectIntercom(hashData.room, hashData.pin, hashData.token);
      return;
    }

    // Fetch server info and master bond status
    await fetchServerInfo();

    // Check if user was in RF Frequency Dial Mode
    if (savedMode === 'freq') {
      setIntercomMode('freq', true);
      return;
    }

    // Zero-Touch Persistent Auto-Connect
    const savedRoom = localStorage.getItem('directlink_room');
    const savedPin = localStorage.getItem('directlink_pin');
    const savedToken = localStorage.getItem('directlink_pair_token');

    if (savedRoom && savedPin) {
      if (inputRoom) inputRoom.value = savedRoom;
      if (inputPin) inputPin.value = savedPin;
      logEvent(`Connecting to bonded frequency "${savedRoom}"...`);
      setIntercomMode(savedMode, false);
      connectIntercom(savedRoom, savedPin, savedToken);
    } else if (serverInfo.bondedPair) {
      // Auto-adopt Server Master Bond
      const bp = serverInfo.bondedPair;
      if (inputRoom) inputRoom.value = bp.roomId;
      if (inputPin) inputPin.value = bp.pin;
      logEvent(`Adopting master bonded channel "${bp.roomId}"...`);
      setIntercomMode(savedMode, false);
      connectIntercom(bp.roomId, bp.pin, bp.pairToken);
    } else {
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
