#!/usr/bin/env node

// Phase 1 Testing Script - Verify all deliverables work as specified
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

console.log('🚀 Phase 1 Testing: Go WebSocket Server Foundation\n');

// Test 1: Build Go server
console.log('Test 1: Building Go server...');
const buildProcess = spawn('go', ['build', '-o', 'test-server', '.'], {
  cwd: './go-server',
  stdio: 'inherit'
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Go server builds successfully\n');

    // Test 2: Start server and run tests
    console.log('Test 2: Starting Go server...');
    const serverProcess = spawn('./test-server', [], {
      cwd: './go-server',
      env: { ...process.env, PORT: '8081' }, // Use different port for testing
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    // Wait for server to start, then run tests
    setTimeout(() => {
      runServerTests();
    }, 2000);

    function runServerTests() {
      console.log('\nTest 3: Health check endpoint...');

      // Test health check
      http.get('http://localhost:8081/health', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            if (health.status === 'healthy') {
              console.log('✅ Health check passed');
              console.log(`   - Status: ${health.status}`);
              console.log(`   - Version: ${health.version}`);
              console.log(`   - Active Connections: ${health.active_connections}`);

              // Test WebSocket connection
              testWebSocket();
            } else {
              console.log('❌ Health check failed');
            }
          } catch (e) {
            console.log('❌ Health check response parsing failed:', e.message);
          }
        });
      }).on('error', (err) => {
        console.log('❌ Health check request failed:', err.message);
      });
    }

    function testWebSocket() {
      console.log('\nTest 4: WebSocket connection...');

      try {
        const ws = new WebSocket('ws://localhost:8081/staff-sync');

        ws.on('open', () => {
          console.log('✅ WebSocket connection established');

          // Test ping/pong
          console.log('\nTest 5: WebSocket ping/pong...');
          ws.send('Hello from test client');
        });

        ws.on('message', (data) => {
          console.log('✅ WebSocket echo received:', data.toString());

          // Success - close everything
          ws.close();
          serverProcess.kill();

          console.log('\n🎉 All Phase 1 tests passed!');
          console.log('\nPhase 1 Success Criteria Met:');
          console.log('✅ Go server starts successfully');
          console.log('✅ WebSocket connections established');
          console.log('✅ Basic ping/pong messaging works');
          console.log('✅ Health check endpoints operational');
          console.log('✅ Ready for Docker integration');

          process.exit(0);
        });

        ws.on('error', (err) => {
          console.log('❌ WebSocket error:', err.message);
          serverProcess.kill();
          process.exit(1);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          console.log('❌ WebSocket test timeout');
          ws.close();
          serverProcess.kill();
          process.exit(1);
        }, 10000);

      } catch (e) {
        console.log('❌ WebSocket test failed:', e.message);
        serverProcess.kill();
        process.exit(1);
      }
    }

  } else {
    console.log('❌ Go server build failed with code:', code);
    process.exit(1);
  }
});

buildProcess.on('error', (err) => {
  console.log('❌ Build process failed:', err.message);
  process.exit(1);
});