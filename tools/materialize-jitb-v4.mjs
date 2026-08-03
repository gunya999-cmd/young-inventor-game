import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('tools/generate-jitb-v4.py');
const target = resolve('public/assets/jack-in-the-box-v3-realistic.glb');
const pythonCandidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

function runPython(args, env = process.env) {
  let lastError;
  for (const candidate of pythonCandidates) {
    try {
      execFileSync(candidate, args, { stdio: 'inherit', env });
      return candidate;
    } catch (error) {
      lastError = error;
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  throw lastError ?? new Error('Python interpreter not found');
}

mkdirSync(dirname(target), { recursive: true });

try {
  runPython(['-c', 'import numpy, trimesh']);
} catch {
  runPython(['-m', 'pip', 'install', '--disable-pip-version-check', '--quiet', 'numpy', 'trimesh']);
}

const env = { ...process.env, JITB_OUT: target };
runPython([source], env);

const bytes = statSync(target).size;
if (bytes < 400_000) throw new Error(`Jack GLB detail gate failed: ${bytes} bytes`);
console.log(`Materialized Jack-in-the-Box v4 GLB: ${target} (${bytes} bytes)`);
