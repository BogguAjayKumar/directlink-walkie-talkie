const { WebSocket } = require('ws');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testSignaling() {
  console.log('--- Testing Walkie-Talkie Signaling Protocol ---');

  const wsA = new WebSocket('wss://localhost:8443');
  const wsB = new WebSocket('wss://localhost:8443');
  const wsUnauthorized = new WebSocket('wss://localhost:8443');
  const wsThird = new WebSocket('wss://localhost:8443');

  let resolveTest, rejectTest;
  const promise = new Promise((resolve, reject) => {
    resolveTest = resolve;
    rejectTest = reject;
  });

  const state = {
    aJoined: false,
    bJoined: false,
    aReceivedPeer: false,
    bReceivedPeer: false,
    bReceivedPttTx: false,
    bReceivedPttIdle: false,
    unauthRejected: false,
    thirdRejected: false
  };

  wsA.on('open', () => {
    console.log('WS-A connected. Joining room...');
    wsA.send(JSON.stringify({
      type: 'join',
      roomId: 'test-room',
      pin: '123456',
      role: 'laptop',
      deviceName: 'Laptop Test'
    }));
  });

  wsA.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'joined') {
      state.aJoined = true;
      console.log('✓ WS-A joined room successfully');
      // Now connect WS-B
      wsB.send(JSON.stringify({
        type: 'join',
        roomId: 'test-room',
        pin: '123456',
        role: 'phone',
        deviceName: 'Phone Test'
      }));
    } else if (data.type === 'peer-joined') {
      state.aReceivedPeer = true;
      console.log('✓ WS-A notified that WS-B joined');
      // Trigger PTT transmission test
      setTimeout(() => {
        console.log('WS-A starting PTT transmission...');
        wsA.send(JSON.stringify({ type: 'ptt-status', state: 'transmitting' }));
        setTimeout(() => {
          console.log('WS-A ending PTT transmission (roger beep)...');
          wsA.send(JSON.stringify({ type: 'ptt-status', state: 'idle' }));
        }, 150);
      }, 150);
    }
  });

  wsB.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'joined') {
      state.bJoined = true;
      console.log('✓ WS-B joined room successfully');
    } else if (data.type === 'peer-status') {
      state.bReceivedPeer = true;
      console.log('✓ WS-B knows WS-A is present');
    } else if (data.type === 'ptt-status') {
      if (data.state === 'transmitting') {
        state.bReceivedPttTx = true;
        console.log('✓ WS-B received PTT TRANSMITTING state');
      } else if (data.state === 'idle') {
        state.bReceivedPttIdle = true;
        console.log('✓ WS-B received PTT IDLE state');

        // Now test unauthorized PIN attempt
        wsUnauthorized.send(JSON.stringify({
          type: 'join',
          roomId: 'test-room',
          pin: 'WRONGPIN',
          role: 'phone'
        }));
      }
    }
  });

  wsUnauthorized.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'error' && data.message.includes('Invalid PIN')) {
      state.unauthRejected = true;
      console.log('✓ Unauthorized PIN correctly rejected by server');

      // Now test 3rd device rejection
      wsThird.send(JSON.stringify({
        type: 'join',
        roomId: 'test-room',
        pin: '123456',
        role: 'phone'
      }));
    }
  });

  wsThird.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'error' && data.message.includes('Channel is full')) {
      state.thirdRejected = true;
      console.log('✓ 3rd device correctly rejected (room capacity = 2 devices)');

      // All tests passed!
      wsA.close();
      wsB.close();
      wsUnauthorized.close();
      wsThird.close();
      resolveTest(true);
    }
  });

  setTimeout(() => {
    rejectTest(new Error('Test timed out. Final state: ' + JSON.stringify(state)));
  }, 5000);

  return promise;
}

testSignaling()
  .then(() => {
    console.log('\n>>> ALL SIGNALING & SECURITY PROTOCOL TESTS PASSED! <<<\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
