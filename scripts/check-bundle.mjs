import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const files = await readdir(assetsDir);
const jsFiles = files.filter(file => file.endsWith('.js'));
let totalBytes = 0;
for (const file of jsFiles) totalBytes += (await stat(join(assetsDir, file))).size;

const budgetBytes = 2_200_000;
if (totalBytes > budgetBytes) {
  throw new Error(`JavaScript bundle ${totalBytes} bytes exceeds budget ${budgetBytes} bytes.`);
}
console.log(`Bundle budget passed: ${totalBytes}/${budgetBytes} bytes.`);
