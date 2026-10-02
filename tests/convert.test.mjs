import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { convert } from '../src/convert.js';
import { initMagick, inspect, difference, assertCleanJpeg, jpegSegments } from './helpers.mjs';
let profile;
before(async () => { await initMagick(); profile = new Uint8Array(await readFile('src/assets/sRGB.icc')); });
test('all eight EXIF orientations, metadata removal, sRGB and no upscaling', async () => {
  for (let orientation = 1; orientation <= 8; orientation++) {
    const input = new Uint8Array(await readFile('tests/fixtures/orientation-' + orientation + '.jpg'));
    const expected = new Uint8Array(await readFile('tests/fixtures/expected-' + orientation + '.png'));
    const output = convert(input, { longEdge: 1200, quality: 100 }, profile);
    assert.equal(output.width, orientation >= 5 ? 240 : 320);
    assert.equal(output.height, orientation >= 5 ? 320 : 240);
    assertCleanJpeg(assert, output.bytes);
    assert.ok(difference(output.bytes, expected) < 0.08, 'oriented pixels agree: ' + orientation);
  }
});
test('resize aspect ratio and quality alters quantization and size', async () => {
  const input = new Uint8Array(await readFile('tests/fixtures/orientation-6.jpg'));
  const low = convert(input, { longEdge: 150, quality: 20 }, profile);
  const high = convert(input, { longEdge: 150, quality: 95 }, profile);
  assert.deepEqual([high.width, high.height], [113, 150]);
  assert.ok(high.bytes.length > low.bytes.length);
  const quantization = result => jpegSegments(result.bytes).filter(s => s.marker === 0xdb).map(s => Buffer.from(s.data).toString('hex'));
  assert.notDeepEqual(quantization(high), quantization(low));
  assertCleanJpeg(assert, high.bytes);
});
test('HEIC and HEIF fixtures decode; corrupt file does not poison next image', async () => {
  for (const name of ['pattern.heic', 'pattern.heif']) {
    const input = new Uint8Array(await readFile('tests/fixtures/' + name));
    const output = convert(input, { longEdge: 150, quality: 85 }, profile);
    assert.deepEqual([output.width, output.height], [113, 150]);
    assertCleanJpeg(assert, output.bytes);
  }
  assert.throws(() => convert(Uint8Array.of(255, 216, 255, 0), { longEdge: 0, quality: 85 }, profile));
  const valid = new Uint8Array(await readFile('tests/fixtures/orientation-1.jpg'));
  assert.equal(inspect(convert(valid, { longEdge: 0, quality: 85 }, profile).bytes).width, 320);
});

test('nclx-only Display P3, BT.709 and BT.2020 convert to sRGB; unsupported HDR is explicit', async () => {
  const sourceProfiles = {};
  for (const [primaries, transfer] of [[12,13],[1,1],[9,13]]) {
    sourceProfiles[primaries + '/' + transfer] = new Uint8Array(await readFile('src/assets/cicp-' + primaries + '-' + transfer + '.icc'));
  }
  for (const [primaries, transfer] of [[12,13],[1,1],[9,13]]) {
    const name = 'nclx-' + primaries + '-' + transfer;
    const input = new Uint8Array(await readFile('tests/fixtures/' + name + '.heif'));
    assert.ok(!inspect(input).profiles.includes('icc'));
    const expected = new Uint8Array(await readFile('tests/fixtures/' + name + '-expected.png'));
    const output = convert(input, { longEdge: 0, quality: 100 }, profile, () => {}, sourceProfiles);
    assertCleanJpeg(assert, output.bytes);
    assert.ok(difference(output.bytes, expected) < 0.025, 'CICP RGB pixels agree with independent Pillow CMS conversion: ' + name);
  }
  const hdr = new Uint8Array(await readFile('tests/fixtures/nclx-hdr.heif'));
  assert.throws(() => convert(hdr, { longEdge: 0, quality: 85 }, profile, () => {}, sourceProfiles), /HDR/);
});
