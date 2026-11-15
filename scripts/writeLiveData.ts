/**
 * Writes the runtime data files (`scripts/liveData.ts`) into a directory.
 *
 *     bun scripts/writeLiveData.ts <assets dir> <out dir>
 *
 * Used by `.github/workflows/data-deploy.yml`, which points `<out dir>` at a
 * scratch directory and then syncs it into `data/` on the `gh-pages` branch.
 * The build doesn't use this: `liveData` in `vite.config.ts` emits the same
 * files through Vite.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { liveDataFiles } from './liveData.ts';

const [assetsDir, outDir] = process.argv.slice(2);
if (!assetsDir || !outDir) {
    console.error('usage: bun scripts/writeLiveData.ts <assets dir> <out dir>');
    process.exit(2);
}

const files = liveDataFiles(assetsDir);
for (const [path, content] of files) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
}
console.error(`Wrote ${files.size} files to ${outDir}.`);
