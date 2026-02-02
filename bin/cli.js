#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const PORT = process.env.PORT || 3001;

// Config file path for storing API key
const configDir = join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw-liveavatar');
const configFile = join(configDir, 'config.json');

function loadConfig() {
  try {
    if (existsSync(configFile)) {
      return JSON.parse(readFileSync(configFile, 'utf8'));
    }
  } catch (e) {
    // Ignore errors
  }
  return {};
}

function saveConfig(config) {
  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    writeFileSync(configFile, JSON.stringify(config, null, 2));
  } catch (e) {
    // Ignore errors - config is optional
  }
}

function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getApiKey() {
  // Check environment variable first
  if (process.env.LIVEAVATAR_API_KEY) {
    return process.env.LIVEAVATAR_API_KEY;
  }

  // Check saved config
  const config = loadConfig();
  if (config.apiKey) {
    return config.apiKey;
  }

  // No API key found - prompt user
  console.log('');
  console.log('  \x1b[38;5;208m\x1b[1m🦞 OpenClaw LiveAvatar\x1b[0m');
  console.log('  ─────────────────────────────────────');
  console.log('');
  console.log('  \x1b[33m⚠️  LiveAvatar API key not found\x1b[0m');
  console.log('');
  console.log('  To use LiveAvatar, you need a free API key:');
  console.log('');
  console.log('  1. Go to \x1b[36m\x1b[4mhttps://app.liveavatar.com\x1b[0m');
  console.log('  2. Sign up for a free account');
  console.log('  3. Copy your API key from the dashboard');
  console.log('');

  const apiKey = await prompt('  \x1b[1mPaste your API key here:\x1b[0m ');

  if (!apiKey) {
    console.log('');
    console.log('  \x1b[31m✗ No API key provided. Exiting.\x1b[0m');
    console.log('');
    process.exit(1);
  }

  // Validate key format (basic check)
  if (apiKey.length < 10) {
    console.log('');
    console.log('  \x1b[31m✗ That doesn\'t look like a valid API key. Please try again.\x1b[0m');
    console.log('');
    process.exit(1);
  }

  // Save for future use
  saveConfig({ apiKey });
  console.log('');
  console.log('  \x1b[32m✓ API key saved!\x1b[0m \x1b[90m(stored in ~/.openclaw-liveavatar/config.json)\x1b[0m');

  return apiKey;
}

async function main() {
  const apiKey = await getApiKey();

  console.log('');
  console.log('  \x1b[38;5;208m\x1b[1m🦞 OpenClaw LiveAvatar\x1b[0m');
  console.log('  ─────────────────────────────────────');
  console.log('');
  console.log(`  Starting server on port ${PORT}...`);
  console.log('');

  // Start the Next.js server with the API key
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(PORT),
      LIVEAVATAR_API_KEY: apiKey
    }
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
}

main().catch((err) => {
  console.error('  \x1b[31m✗ Error:\x1b[0m', err.message);
  process.exit(1);
});
