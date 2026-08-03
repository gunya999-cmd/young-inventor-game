import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const source = resolve('tools/jitb_generator_v4.py.gz.b64');
const target = resolve('public/assets/jack-in-the-box-v3-realistic.glb');
const script = resolve(tmpdir(), 'young-inventor-jitb-v4.py');

function python(...args) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let lastError;
  for (const candidate of candidates) {
    try {
      return execFileSync(candidate, args, { stdio: 'inherit', env: process.env });
    } catch (error) {
      lastError = error;
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  throw lastError ?? new Error('Python interpreter not found');
}

mkdirSync(dirname(target), { recursive: true });
const packed = Buffer.from(readFileSync(source, 'utf8').trim(), 'base64');
writeFileSync(script, gunzipSync(packed));

try {
  try {
    python('-c', 'import numpy, trimesh');
  } catch {
    python('-m', 'pip', 'install', '--disable-pip-version-check', '--quiet', 'numpy', 'trimesh');
  }

  const env = { ...process.env, JITB_OUT: target };
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let generated = false;
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, [script], { stdio: 'inherit', env });
      generated = true;
      break;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  if (!generated) throw new Error('Python interpreter not found');
  console.log(`Materialized Jack-in-the-Box v4 GLB: ${target}`);
} finally {
  rmSync(script, { force: true });
}
