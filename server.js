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

const HTTPS_PORT = process.env.PORT || 8443;
const HTTP_PORT = process.env.HTTP_PORT || 8080;
const CERTS_DIR = path.join(__dirname, 'certs');
const KEY_PATH = path.join(CERTS_DIR, 'key.pem');
const CERT_PATH = path.join(CERTS_DIR, 'cert.pem');

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

// Global state
let activeTunnel = null;
let tunnelUrl = null;
const rooms = new Map(); // roomId -> { pin, createdAt, peers: Map<ws, { role, name, joinedAt }> }
const pinAttempts = new Map(); // ip -> { count, lastAttempt }

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Server and network status info
app.get('/api/info', (req, res) => {
  res.json({
    httpsPort: HTTPS_PORT,
    httpPort: HTTP_PORT,
    localIps: getLocalIps(),
    tunnelUrl: tunnelUrl,
    isTunneling: !!activeTunnel,
    activeRooms: rooms.size
  });
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

  // Optional HTTP redirect / landing
  const httpServer = http.createServer((req, res) => {
    const host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
    res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url}` });
    res.end();
  });

  const wss = new WebSocketServer({ server: httpsServer });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
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
          const { roomId, pin, role, deviceName } = data;
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
          if (!room) {
            // First device creates room
            room = {
              pin,
              createdAt: Date.now(),
              peers: new Map()
            };
            rooms.set(roomId, room);
          } else {
            // Device joining existing room must provide matching PIN
            if (room.pin !== pin) {
              attempts.count += 1;
              attempts.lastAttempt = now;
              pinAttempts.set(clientIp, attempts);
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid PIN code for this channel' }));
              return;
            }
            // Room capacity limit: 2 devices (Phone + Laptop direct walkie-talkie)
            if (room.peers.size >= 2) {
              ws.send(JSON.stringify({ type: 'error', message: 'Channel is full (maximum 2 devices connected)' }));
              return;
            }
          }

          // Reset IP attempts on successful auth
          pinAttempts.delete(clientIp);

          currentRoomId = roomId;
          const peerInfo = {
            role: role || 'device',
            name: deviceName || 'Anonymous',
            joinedAt: Date.now()
          };
          room.peers.set(ws, peerInfo);

          ws.send(JSON.stringify({
            type: 'joined',
            roomId,
            role: peerInfo.role,
            peerCount: room.peers.size,
            isInitiator: room.peers.size === 1
          }));

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
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }

        default:
          break;
      }
    });

    ws.on('close', () => {
      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId);
        room.peers.delete(ws);
        if (room.peers.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          // Notify remaining peer that the other side disconnected
          for (const [otherWs] of room.peers.entries()) {
            if (otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(JSON.stringify({
                type: 'peer-left',
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
    console.log('   DIRECTLINK WALKIE-TALKIE SERVER INITIALIZED & READY');
    console.log('===============================================================');
    console.log(`Local Access (Laptop):`);
    console.log(`   https://localhost:${HTTPS_PORT}`);
    console.log(`\nLocal Network (Phone on same Wi-Fi):`);
    const localIps = getLocalIps();
    localIps.forEach(({ name, ip }) => {
      console.log(`   https://${ip}:${HTTPS_PORT}  [${name}]`);
    });
    console.log(`\nOptional HTTP redirect port: ${HTTP_PORT}`);
    console.log('===============================================================\n');
  });

  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {});
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
