/**
 * DirectLink Walkie-Talkie Server
 * High-performance, secure HTTPS + WebSocket server for phone-laptop intercom.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const qrcode = require('qrcode');
const selfsigned = require('selfsigned');
const os = require('os');
let localtunnel = null;
try {
  localtunnel = require('localtunnel');
} catch (e) {
  console.warn('localtunnel module not found, internet tunneling can be enabled later');
}

// Helper: Get local network IPv4 addresses
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, ip: iface.address });
      }
    }
  }
  return addresses;
}

// Ensure SSL/TLS Certificates exist
async function getOrGenerateCerts() {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return {
      key: fs.readFileSync(KEY_PATH, 'utf8'),
      cert: fs.readFileSync(CERT_PATH, 'utf8')
    };
  }

  console.log('Generating fresh self-signed TLS certificates for secure HTTPS/WSS...');
  const localIps = getLocalIps().map(item => item.ip);
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...localIps.map(ip => ({ type: 7, ip }))
  ];

  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'DirectLink-WalkieTalkie' }],
    {
      days: 365,
      keySize: 2048,
      extensions: [{ name: 'subjectAltName', altNames }]
    }
  );

  fs.mkdirSync(CERTS_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, pems.private);
  fs.writeFileSync(CERT_PATH, pems.cert);
  console.log('TLS certificates created and cached in certs/');
  return { key: pems.private, cert: pems.cert };
}

const HTTPS_PORT = process.env.PORT || 8443;
const HTTP_PORT = process.env.HTTP_PORT || 8080;
const CERTS_DIR = path.join(__dirname, 'certs');
const KEY_PATH = path.join(CERTS_DIR, 'key.pem');
const CERT_PATH = path.join(CERTS_DIR, 'cert.pem');
const BONDED_FILE = path.join(CERTS_DIR, 'bonded-pair.json');

// Helper: Persistent Master Bonded Pair
function loadBondedPair() {
  try {
    if (fs.existsSync(BONDED_FILE)) {
      return JSON.parse(fs.readFileSync(BONDED_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Failed to load bonded-pair.json:', e);
  }
  return null;
}

function saveBondedPair(data) {
  try {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
    fs.writeFileSync(BONDED_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save bonded-pair.json:', e);
  }
}

// Global state
let activeTunnel = null;
let tunnelUrl = null;
const rooms = new Map(); // roomId -> { pin, createdAt, peers: Map<ws, { role, name, joinedAt }> }
const pinAttempts = new Map(); // ip -> { count, lastAttempt }

// Initialize Master Bonded Pair
let bondedPair = loadBondedPair();
if (!bondedPair) {
  bondedPair = {
    isBonded: true,
    roomId: 'directlink-master',
    pin: '849201',
    pairToken: 'bond_' + Math.random().toString(36).substring(2, 12),
    createdAt: Date.now(),
    devices: {
      laptop: { name: 'Command Laptop', lastSeen: 0, connected: false },
      phone: { name: 'Handheld Phone', lastSeen: 0, connected: false }
    }
  };
  saveBondedPair(bondedPair);
  console.log(`[BOND] Master channel initialized: Room "${bondedPair.roomId}" | PIN: "${bondedPair.pin}"`);
}

// Ensure Master Bond room is permanently registered in memory
rooms.set(bondedPair.roomId, {
  pin: bondedPair.pin,
  createdAt: bondedPair.createdAt,
  pairToken: bondedPair.pairToken,
  isMasterBond: true,
  peers: new Map()
});

const app = express();
app.use(express.json());

// Dedicated Routing: Separate Laptop and Phone Apps Cleanly
app.get(['/phone', '/phone.html', '/mobile'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'phone.html'));
});

app.get(['/laptop', '/laptop.html', '/desktop', '/pc'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'laptop.html'));
});

// Root Route: Smart Device Detection
app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (isMobile) {
    res.sendFile(path.join(__dirname, 'public', 'phone.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'laptop.html'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Detailed Connection & Request Logger for Easy Debugging
app.use((req, res, next) => {
  if (!req.url.startsWith('/api/qr')) {
    const ip = req.socket.remoteAddress ? req.socket.remoteAddress.replace(/^.*:/, '') : 'local';
    console.log(`[HTTP ${req.method}] ${req.url} (from ${ip})`);
  }
  next();
});

// API: Server and network status info
app.get('/api/info', (req, res) => {
  res.json({
    httpsPort: HTTPS_PORT,
    httpPort: HTTP_PORT,
    localIps: getLocalIps(),
    tunnelUrl: tunnelUrl,
    isTunneling: !!activeTunnel,
    activeRooms: rooms.size,
    bondedPair: {
      isBonded: true,
      roomId: bondedPair.roomId,
      pin: bondedPair.pin,
      pairToken: bondedPair.pairToken,
      devices: bondedPair.devices
    }
  });
});

// API: Get Master Bonded channel info
app.get('/api/bond', (req, res) => {
  const masterRoom = rooms.get(bondedPair.roomId);
  const activePeers = masterRoom ? Array.from(masterRoom.peers.values()) : [];
  res.json({
    isBonded: true,
    roomId: bondedPair.roomId,
    pin: bondedPair.pin,
    pairToken: bondedPair.pairToken,
    activePeers,
    devices: bondedPair.devices,
    tunnelUrl: tunnelUrl,
    localIps: getLocalIps(),
    httpsPort: HTTPS_PORT
  });
});

// API: Reset / Re-pair Master Bonded Channel
app.post('/api/bond/reset', (req, res) => {
  // Clear existing master room sockets
  const oldRoom = rooms.get(bondedPair.roomId);
  if (oldRoom) {
    for (const [peerWs] of oldRoom.peers.entries()) {
      peerWs.close(1000, 'Bond reset');
    }
    rooms.delete(bondedPair.roomId);
  }

  bondedPair = {
    isBonded: true,
    roomId: 'directlink-' + Math.random().toString(16).substring(2, 6),
    pin: Math.floor(100000 + Math.random() * 900000).toString(),
    pairToken: 'bond_' + Math.random().toString(36).substring(2, 12),
    createdAt: Date.now(),
    devices: {
      laptop: { name: 'Command Laptop', lastSeen: 0, connected: false },
      phone: { name: 'Handheld Phone', lastSeen: 0, connected: false }
    }
  };
  saveBondedPair(bondedPair);

  rooms.set(bondedPair.roomId, {
    pin: bondedPair.pin,
    createdAt: bondedPair.createdAt,
    pairToken: bondedPair.pairToken,
    isMasterBond: true,
    peers: new Map()
  });

  console.log(`[BOND RESET] New master pair channel generated: Room "${bondedPair.roomId}" | PIN: "${bondedPair.pin}"`);
  res.json({ success: true, bondedPair });
});

// API: Generate QR code image for fast mobile scanning
app.get('/api/qr', async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.status(400).send('Missing "text" query parameter');
  }
  try {
    const qrSvg = await qrcode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#00ffcc', light: '#0c1017' }
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(qrSvg);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// API: Toggle public internet tunnel for Mobile Data access
app.post('/api/tunnel', async (req, res) => {
  const { enable, subdomain } = req.body;
  if (!localtunnel) {
    return res.status(500).json({ error: 'localtunnel package is not available' });
  }

  if (enable && !activeTunnel) {
    try {
      console.log('Spinning up secure internet tunnel for mobile data access...');
      const opts = { port: HTTPS_PORT, local_https: true, allow_invalid_cert: true };
      if (subdomain) opts.subdomain = subdomain;
      activeTunnel = await localtunnel(opts);
      tunnelUrl = activeTunnel.url;

      activeTunnel.on('close', () => {
        console.log('Mobile Data Tunnel closed');
        activeTunnel = null;
        tunnelUrl = null;
      });

      activeTunnel.on('error', (err) => {
        console.error('Tunnel error:', err);
      });

      console.log(`Mobile Data Tunnel Active: ${tunnelUrl}`);
      return res.json({ success: true, tunnelUrl });
    } catch (err) {
      console.error('Failed to create tunnel:', err);
      return res.status(500).json({ error: err.message });
    }
  } else if (!enable && activeTunnel) {
    activeTunnel.close();
    activeTunnel = null;
    tunnelUrl = null;
    return res.json({ success: true, tunnelUrl: null });
  }

  return res.json({ success: true, tunnelUrl });
});

async function startServer() {
  const certs = await getOrGenerateCerts();
  const httpsServer = https.createServer(certs, app);

  // HTTP Server also serves the app & WebSockets directly on port 8080
  // (Crucial for Android APK and devices to connect without self-signed SSL certificate blocks)
  const httpServer = http.createServer(app);

  const wss = new WebSocketServer({ noServer: true });

  httpsServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, req) => {
    const rawIp = req.socket.remoteAddress || '';
    const clientIp = rawIp.replace(/^.*:/, '') || 'local';
    console.log(`[WS CONNECT] Device connected from IP: ${clientIp}`);
    let currentRoomId = null;

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        // May be binary audio packet if WebRTC fallback is used
        if (currentRoomId && rooms.has(currentRoomId)) {
          broadcastToRoom(currentRoomId, ws, raw, true);
        }
        return;
      }

      switch (data.type) {
        case 'join': {
          let { roomId, pin, role, deviceName } = data;
          console.log(`[JOIN ATTEMPT] Device (${role || 'device'}) joining "${roomId}" from ${clientIp}`);
          if (!roomId || !pin) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room ID and PIN are required' }));
            return;
          }

          // Anti-brute-force check
          const attempts = pinAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
          const now = Date.now();
          if (attempts.count > 10 && now - attempts.lastAttempt < 30000) {
            ws.send(JSON.stringify({ type: 'error', message: 'Too many failed attempts. Try again in 30 seconds.' }));
            return;
          }

          let room = rooms.get(roomId);
          const isMaster = (roomId === bondedPair.roomId) || (data.pairToken === bondedPair.pairToken);

          if (!room && isMaster) {
            room = {
              pin: bondedPair.pin,
              createdAt: bondedPair.createdAt,
              pairToken: bondedPair.pairToken,
              isMasterBond: true,
              peers: new Map()
            };
            rooms.set(roomId, room);
          } else if (!room) {
            // First device creates room
            room = {
              pin,
              createdAt: Date.now(),
              peers: new Map()
            };
            rooms.set(roomId, room);
          } else {
            // Device joining existing room must provide matching PIN
            if (room.pin !== pin && (!isMaster || data.pairToken !== bondedPair.pairToken)) {
              attempts.count += 1;
              attempts.lastAttempt = now;
              pinAttempts.set(clientIp, attempts);
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid PIN code for this channel' }));
              return;
            }

            // 1. Purge any truly closed or dead sockets in this room
            for (const [existingWs] of room.peers.entries()) {
              if (existingWs.readyState !== WebSocket.OPEN) {
                console.log(`[CLEANUP] Purged disconnected socket from room "${roomId}"`);
                room.peers.delete(existingWs);
              }
            }

            // 2. Intelligent Conflict-Free Role Assignment:
            // Ensure 1 Laptop and 1 Phone pair cleanly. If requested role is already occupied by a live connection,
            // adapt to the complimentary role rather than disconnecting the peer.
            let requestedRole = role || 'laptop';
            let roleAlreadyTaken = false;
            for (const [existingWs, existingPeer] of room.peers.entries()) {
              if (existingWs !== ws && existingPeer.role === requestedRole && existingWs.readyState === WebSocket.OPEN) {
                roleAlreadyTaken = true;
                break;
              }
            }

            let finalRole = requestedRole;
            if (roleAlreadyTaken) {
              finalRole = (requestedRole === 'laptop') ? 'phone' : 'laptop';
              console.log(`[ROLE ADAPTATION] Role "${requestedRole}" is active. Auto-assigned complimentary role "${finalRole}" to link as direct pair.`);
            }

            // 3. Room capacity limit: strictly 2 devices (Phone + Laptop direct walkie-talkie)
            if (room.peers.size >= 2 && !room.peers.has(ws)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Channel is full (maximum 2 devices connected)' }));
              return;
            }

            role = finalRole;
          }

          // Reset IP attempts on successful auth
          pinAttempts.delete(clientIp);

          currentRoomId = roomId;
          const assignedRole = role || 'laptop';
          const peerInfo = {
            role: assignedRole,
            name: deviceName || (assignedRole === 'laptop' ? 'Command Laptop' : 'Handheld Phone'),
            joinedAt: Date.now()
          };
          room.peers.set(ws, peerInfo);

          if (isMaster && bondedPair.devices[assignedRole]) {
            bondedPair.devices[assignedRole].name = peerInfo.name;
            bondedPair.devices[assignedRole].lastSeen = Date.now();
            bondedPair.devices[assignedRole].connected = true;
            saveBondedPair(bondedPair);
          }

          ws.send(JSON.stringify({
            type: 'joined',
            roomId,
            role: peerInfo.role,
            isMasterBond: !!room.isMasterBond,
            pairToken: isMaster ? bondedPair.pairToken : null,
            peerCount: room.peers.size,
            isInitiator: room.peers.size === 1
          }));

          console.log(`[JOIN SUCCESS] ${peerInfo.name} (${assignedRole}) joined "${roomId}". Devices in channel: ${room.peers.size}/2`);
          if (room.peers.size === 2) {
            console.log(`\n===============================================================`);
            console.log(`>>> SUCCESS: BOTH DEVICES (LAPTOP & PHONE) ARE LINKED & READY! <<<`);
            console.log(`===============================================================\n`);
          }

          // Notify existing peer
          for (const [otherWs, otherPeer] of room.peers.entries()) {
            if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(JSON.stringify({
                type: 'peer-joined',
                peer: peerInfo,
                peerCount: room.peers.size
              }));
              // Notify newcomer about existing peer
              ws.send(JSON.stringify({
                type: 'peer-status',
                peer: otherPeer,
                peerCount: room.peers.size
              }));
            }
          }
          break;
        }

        case 'signal': {
          // WebRTC offer, answer, ice-candidate
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, ws, JSON.stringify({
            type: 'signal',
            signal: data.signal
          }));
          break;
        }

        case 'ptt-status': {
          // Fast push-to-talk transmission status notification
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, ws, JSON.stringify({
            type: 'ptt-status',
            state: data.state, // 'transmitting' | 'idle'
            from: data.from
          }));
          break;
        }

        case 'audio-relay': {
          // Encrypted audio fallback chunk
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, ws, JSON.stringify({
            type: 'audio-relay',
            payload: data.payload,
            format: data.format
          }));
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({
            type: 'pong',
            clientTime: data.clientTime || data.t,
            serverTime: Date.now()
          }));
          break;
        }

        default:
          break;
      }
    });

    ws.on('close', () => {
      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId);
        const myPeer = room.peers.get(ws);
        const role = myPeer ? myPeer.role : null;
        room.peers.delete(ws);

        if (room.isMasterBond && role && bondedPair.devices[role]) {
          bondedPair.devices[role].connected = false;
          bondedPair.devices[role].lastSeen = Date.now();
          saveBondedPair(bondedPair);
        }

        // Only delete the room if it's NOT the master bonded channel
        if (!room.isMasterBond && room.peers.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          // Notify remaining peer that the other side disconnected / went into standby
          for (const [otherWs] of room.peers.entries()) {
            if (otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(JSON.stringify({
                type: 'peer-left',
                role,
                peerCount: room.peers.size
              }));
            }
          }
        }
      }
    });
  });

  function broadcastToRoom(roomId, senderWs, message, isBinary = false) {
    const room = rooms.get(roomId);
    if (!room) return;
    for (const [clientWs] of room.peers.entries()) {
      if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(message, { binary: isBinary });
      }
    }
  }

  // Periodic heartbeat cleanup for stale dead sockets
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 15000);

  // Start listening
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('\n===============================================================');
    console.log('   DIRECTLINK TACTICAL INTERCOM SERVER IS ONLINE & READY');
    console.log('===============================================================');
    console.log(`💻 LAPTOP ACCESS:`);
    console.log(`   👉 https://localhost:${HTTPS_PORT}`);
    console.log(`\n📱 PHONE ACCESS (Same Wi-Fi):`);
    const localIps = getLocalIps();
    localIps.forEach(({ name, ip }) => {
      console.log(`   👉 Instant Wi-Fi / APK: http://${ip}:${HTTP_PORT} [${name}]`);
      console.log(`   👉 Local Wi-Fi (HTTPS): https://${ip}:${HTTPS_PORT} [${name}]`);
    });
    console.log(`\n🌍 MOBILE DATA WAN (4G/5G / Global Internet):`);
    console.log(`   Click "Mobile Data WAN" on your laptop screen to generate public link.`);
    console.log('===============================================================\n');
  });

  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {});
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
