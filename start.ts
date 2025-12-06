import { config } from 'dotenv';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Prefer .env.local if present, else fall back to .env
const localEnvPath = resolve(__dirname, '.env.local');
const defaultEnvPath = resolve(__dirname, '.env');
const envToLoad = existsSync(localEnvPath) ? localEnvPath : defaultEnvPath;
config({ path: envToLoad });

console.log('📦 Farcaster Development Server');
console.log('================================');
console.log(`✅ Environment variables loaded from ${envToLoad}`);
console.log('');
console.log('🚀 Starting dev server on http://localhost:5000');
console.log('   Press Ctrl+C to stop');
console.log('');

// Ensure NODE_ENV is set
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.PORT || '5000';

// Spawn npm run dev
const child = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`\n❌ Server exited with code ${code}`);
  }
  process.exit(code || 0);
});

// Handle signals
process.on('SIGINT', () => {
  console.log('\n\n👋 Server stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Server stopped');
  process.exit(0);
});
