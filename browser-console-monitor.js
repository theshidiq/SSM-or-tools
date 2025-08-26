/**
 * Real-time browser console monitor using Playwright
 * Connects to your existing browser session and captures console logs
 */

const { chromium } = require('playwright');

async function monitorConsole() {
  console.log('🔍 Starting real-time console monitor...');
  console.log('📊 Connecting to your existing browser session...');
  
  try {
    // Connect to your existing browser or launch new one
    const browser = await chromium.launch({
      headless: false,
      devtools: true
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to your app
    console.log('🌐 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');
    
    // Set up console monitoring
    console.log('👂 Listening for console events...');
    console.log('=' * 60);
    
    page.on('console', (msg) => {
      const timestamp = new Date().toISOString().substr(11, 12);
      const type = msg.type().toUpperCase().padEnd(7);
      const text = msg.text();
      
      // Color coding for different log types
      let color = '';
      switch (msg.type()) {
        case 'error':
          color = '\x1b[31m'; // Red
          break;
        case 'warning':
          color = '\x1b[33m'; // Yellow
          break;
        case 'info':
          color = '\x1b[36m'; // Cyan
          break;
        case 'log':
          color = '\x1b[37m'; // White
          break;
        default:
          color = '\x1b[37m'; // White
      }
      
      console.log(`${color}[${timestamp}] ${type} ${text}\x1b[0m`);
    });
    
    // Monitor page errors
    page.on('pageerror', (error) => {
      console.log(`\x1b[31m[${new Date().toISOString().substr(11, 12)}] ERROR   ${error.message}\x1b[0m`);
      console.log(`\x1b[31mStack: ${error.stack}\x1b[0m`);
    });
    
    // Monitor network failures
    page.on('requestfailed', (request) => {
      console.log(`\x1b[31m[${new Date().toISOString().substr(11, 12)}] NET-ERR ${request.url()} - ${request.failure()?.errorText}\x1b[0m`);
    });
    
    console.log('✅ Console monitor active! Press Ctrl+C to stop.');
    console.log('🤖 Now interact with your AI assistant to see real-time logs...');
    console.log('=' * 60);
    
    // Keep the script running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error starting console monitor:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure your app is running at http://localhost:3000');
    console.log('2. Check that Playwright is properly installed');
    console.log('3. Try running: npm start');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping console monitor...');
  process.exit(0);
});

// Start monitoring
monitorConsole().catch(console.error);