import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { initializeImageMagick, ImageMagick, MagickFormat, ErrorMetric } from '@imagemagick/magick-wasm';
let initialized;
export async function initMagick() {
  initialized ??= readFile('node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm').then(bytes => initializeImageMagick(bytes));
  await initialized;
}
export function inspect(bytes) {
  return ImageMagick.read(bytes, image => ({
    width: image.width, height: image.height, profiles: [...image.profileNames],
    orientation: image.orientation, color: image.getColorProfile()?.description, icc: image.getColorProfile()?.data, interlace: image.interlace,
  }));
}
export function difference(actual, expected) {
  return ImageMagick.read(actual, a => ImageMagick.read(expected, b => a.compare(b, ErrorMetric.MeanAbsolute)));
}
export function jpegSegments(bytes) {
  const segments = []; let offset = 2;
  while (offset < bytes.length && bytes[offset] === 255) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    segments.push({ marker, data: bytes.subarray(offset + 4, offset + 2 + length) });
    offset += 2 + length;
  }
  return segments;
}
export function assertCleanJpeg(assert, bytes) {
  const segments = jpegSegments(bytes);
  assert.ok(segments.some(s => s.marker === 0xe2 && Buffer.from(s.data).includes(Buffer.from('ICC_PROFILE'))), 'sRGB ICC retained');
  assert.ok(!segments.some(s => [0xe1, 0xed, 0xfe].includes(s.marker)), 'no EXIF/XMP/IPTC/comments');
  assert.ok(!Buffer.from(bytes).includes(Buffer.from('PRIVATE')), 'private strings removed');
  const info = inspect(bytes);
  assert.deepEqual(info.profiles, ['icc']);
  assert.deepEqual(Buffer.from(info.icc), readFileSync('src/assets/sRGB.icc'));
  assert.ok(segments.some(s => s.marker === 0xc2), 'progressive JPEG');
  assert.equal(segments.find(s => s.marker === 0xc2).data[7], 0x22, '4:2:0 subsampling');
}
