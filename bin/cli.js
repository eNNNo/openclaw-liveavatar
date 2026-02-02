#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const PORT = process.env.PORT || 3001;

console.log('');
console.log('  \x1b[38;5;208m\x1b[1m🦞 OpenClaw LiveAvatar\x1b[0m');
console.log('  ─────────────────────────────────────');
console.log('');

// Check for LIVEAVATAR_API_KEY
if (!process.env.LIVEAVATAR_API_KEY) {
  console.log('  \x1b[33m⚠️  Warning: LIVEAVATAR_API_KEY not set\x1b[0m');
  console.log('');
  console.log('  To use LiveAvatar, you need an API key:');
  console.log('  1. Get your free key at \x1b[36mhttps://app.liveavatar.com\x1b[0m');
  console.log('  2. Set it: \x1b[90mexport LIVEAVATAR_API_KEY=your_key_here\x1b[0m');
  console.log('');
}

console.log(`  Starting server on port ${PORT}...`);
console.log('');

// Start the Next.js server
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: projectRoot,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(PORT) }
});

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();

  // Detect when server is ready
  if (!serverReady && (output.includes('Ready') || output.includes('started') || output.includes('localhost'))) {
    serverReady = true;
    const url = `http://localhost:${PORT}`;

    console.log(`  \x1b[32m✓ Server ready!\x1b[0m`);
    console.log('');
    console.log(`  \x1b[1mOpen in browser:\x1b[0m \x1b[36m${url}\x1b[0m`);
    console.log('');
    console.log('  \x1b[90mThe LiveAvatar interface will connect to your\x1b[0m');
    console.log('  \x1b[90mOpenClaw Gateway on port 18789 automatically.\x1b[0m');
    console.log('');
    console.log('  \x1b[90mPress Ctrl+C to stop\x1b[0m');
    console.log('');

    // Open browser
    open(url).catch(() => {
      console.log('  \x1b[90m(Could not open browser automatically)\x1b[0m');
    });
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  // Filter out noisy Next.js output
  if (!output.includes('Compiling') && !output.includes('compiled')) {
    process.stderr.write(data);
  }
});

server.on('error', (err) => {
  console.error('  \x1b[31m✗ Failed to start server:\x1b[0m', err.message);
  console.log('');
  console.log('  Make sure you have run:');
  console.log('  \x1b[90mnpm install\x1b[0m');
  console.log('');
  process.exit(1);
});

server.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.log('');
    console.log(`  \x1b[31mServer exited with code ${code}\x1b[0m`);
  }
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('  \x1b[90mShutting down...\x1b[0m');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});
