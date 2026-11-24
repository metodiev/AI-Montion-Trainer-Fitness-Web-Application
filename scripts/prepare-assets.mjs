// Copies the MediaPipe WASM runtime into public/ and verifies the pose model is present.
// The app never uploads camera frames; only local model/runtime files are used.
import { access, cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = join(root, 'public', 'wasm');
const modelPath = join(root, 'public', 'models', 'pose_landmarker_lite.task');
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(wasmDest, { recursive: true });
if (await exists(wasmSrc)) {
  await cp(wasmSrc, wasmDest, { recursive: true });
  console.log('✓ MediaPipe WASM runtime copied to public/wasm');
} else {
  console.warn('! MediaPipe package missing — run npm install first');
}

await mkdir(dirname(modelPath), { recursive: true });
if (await exists(modelPath)) {
  const { size } = await stat(modelPath);
  console.log(`✓ Pose model present (${(size / 1_000_000).toFixed(1)} MB)`);
} else {
  console.log('… Downloading Pose Landmarker model (one-time, ~5.8 MB)');
  try {
    const res = await fetch(modelUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(modelPath, Buffer.from(await res.arrayBuffer()));
    console.log('✓ Pose model downloaded');
  } catch (error) {
    console.warn(
      `! Could not download the pose model (${error.message}). ` +
        'The app will fall back to the MediaPipe CDN at runtime.',
    );
  }
}
