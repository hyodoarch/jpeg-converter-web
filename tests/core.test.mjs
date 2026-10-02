import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, DEFAULTS, fileError, uniqueName, inputFormat, validateOptions } from '../src/core.js';
import { saveToDirectory, nameExists } from '../src/saving.js';
test('old defaults and corrupt settings', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
  assert.deepEqual(normalizeSettings({ longEdge: 'oops', quality: 101, customLongEdge: -1 }), DEFAULTS);
  assert.equal(normalizeSettings({ longEdge: '0', quality: 1 }).longEdge, '0');
  assert.throws(() => validateOptions({ longEdge: NaN, quality: 85 }));
  assert.throws(() => validateOptions({ longEdge: 1200, quality: 0 }));
});
test('input limits and decoder restrictions', () => {
  assert.equal(fileError({ name: 'sample.HEIF', size: 1 }), '');
  assert.ok(fileError({ name: 'sample.png', size: 1 }));
  assert.ok(fileError({ name: 'sample.jpg', size: 0 }));
  assert.ok(fileError({ name: 'sample.jpg', size: 100 * 1024 * 1024 + 1 }));
  assert.throws(() => inputFormat(new TextEncoder().encode('<svg>bad</svg>')));
  assert.equal(inputFormat(Uint8Array.of(255, 216, 255)), 'jpeg');
});
test('names are safe and case-insensitively unique', async () => {
  const reserved = new Set();
  assert.equal(await uniqueName('photo.HEIC', reserved, async name => name === 'photo.jpg'), 'photo_2.jpg');
  assert.equal(await uniqueName('PHOTO.JPEG', reserved), 'PHOTO.jpg');
  assert.equal(await uniqueName('photo.JPG', reserved), 'photo_3.jpg');
  assert.equal(await uniqueName('CON.jpg', new Set()), '_CON.jpg');
  assert.equal(await uniqueName('a/b:c.jpg', new Set()), 'a_b_c.jpg');
});
test('directory saving preserves existing files and aborts failed writes', async () => {
  const files = new Map([['same.jpg', 'original']]);
  let aborted = false;
  const directory = {
    async getFileHandle(name, options) {
      if (!files.has(name) && !options?.create) throw new DOMException('', 'NotFoundError');
      if (options?.create && !files.has(name)) files.set(name, null);
      return { async createWritable() { return {
        async write(blob) { if (name.startsWith('fail')) throw new Error('Disk full'); files.set(name, blob); },
        async close() {}, async abort() { aborted = true; },
      }; } };
    },
  };
  const blob = new Blob(['converted']);
  assert.equal(await saveToDirectory(directory, 'same.heic', blob, new Set()), 'same_2.jpg');
  assert.equal(files.get('same.jpg'), 'original');
  assert.equal(await files.get('same_2.jpg').text(), 'converted');
  await assert.rejects(saveToDirectory(directory, 'fail.jpg', blob, new Set()), /Disk full/);
  assert.ok(aborted);
  assert.ok(await nameExists({ getFileHandle: async () => { throw new DOMException('', 'TypeMismatchError'); } }, 'folder.jpg'));
  await assert.rejects(nameExists({ getFileHandle: async () => { throw new DOMException('', 'NotAllowedError'); } }, 'no.jpg'));
});
