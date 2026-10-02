import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) await check(path);
    else if (/\.(?:m?js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || 'Syntax check failed: ' + path);
    }
  }
}
for (const directory of ['src', 'scripts', 'tests']) await check(directory);
const config = await readFile('vite.config.js', 'utf8');
assert.ok(config.includes("'/jpeg-converter-web/'"));
const html = await readFile('index.html', 'utf8');
assert.ok(html.includes("connect-src 'self'"));
assert.ok(html.includes("worker-src 'self'"));
console.log('Source syntax, base and same-origin policy verified.');
