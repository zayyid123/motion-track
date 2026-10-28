import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy the ffmpeg.wasm ESM wrapper and core files into public/ so the browser
// can load them as same-origin modules. Bundling them directly breaks on
// `new URL(..., import.meta.url)` inside the package worker bootstrap, and
// fetching from external CDNs (like unpkg) risks CORS, network blocks, or rate limits.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ffmpegSource = join(root, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'esm');
const coreSource = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const destination = join(root, 'public', 'ffmpeg');

await mkdir(destination, { recursive: true });

const wrapperFiles = (await readdir(ffmpegSource)).filter((file) => file.endsWith('.js'));
await Promise.all(wrapperFiles.map((file) => cp(join(ffmpegSource, file), join(destination, file))));

const coreFiles = (await readdir(coreSource)).filter((file) => file.startsWith('ffmpeg-core'));
await Promise.all(coreFiles.map((file) => cp(join(coreSource, file), join(destination, file))));

console.log(
  `[sync-ffmpeg] copied ${wrapperFiles.length} wrapper files and ${coreFiles.length} core files to public/ffmpeg`
);
