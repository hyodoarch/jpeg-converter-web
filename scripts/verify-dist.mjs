import { readdir, readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
const files = await readdir('dist/assets');
assert.ok(files.some(f => /^worker-.*\.js$/.test(f)));
assert.ok(files.some(f => /^zip-worker-.*\.js$/.test(f)));
assert.ok(files.some(f => f.endsWith('.wasm')));
assert.ok(files.some(f => f.endsWith('.icc')));
const html = await readFile('dist/index.html', 'utf8');
assert.ok(html.includes('/jpeg-converter-web/assets/'));
assert.ok(!html.includes('/src/app.js'));
for (const file of files.filter(f => f.endsWith('.js'))) {
  const code = await readFile('dist/assets/' + file, 'utf8');
  assert.ok(!/from\s*["']https?:\/\//.test(code), 'no remote module imports');
}
for (const name of ['APP-MIT.txt', 'magick-wasm-LICENSE.txt', 'magick-wasm-NOTICE.txt', 'fflate-LICENSE.txt', 'vite-LICENSE.txt', 'index.txt', 'index.html']) {
  assert.ok((await stat('dist/licenses/' + name)).size > 0, 'license is bundled: ' + name);
}
console.log('Production worker/WASM/ICC and license artifacts verified.');
