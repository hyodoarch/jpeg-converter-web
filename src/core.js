export const LIMITS = Object.freeze({ files: 20, bytes: 100 * 1024 * 1024, pixels: 100000000, retainedBytes: 256 * 1024 * 1024 });
export const DEFAULTS = Object.freeze({ longEdge: '1200', customLongEdge: 1200, quality: 85 });
export const SETTINGS_KEY = 'local-jpeg-converter-settings-v1';
export const PRESETS = new Set(['0', '1800', '1500', '1200', '900', '600', '450']);
export function extension(name) { return String(name).split('.').pop().toLowerCase(); }
export function fileError(file) {
  if (!['heic', 'heif', 'jpg', 'jpeg'].includes(extension(file.name))) return '対応外形式です。HEIC / HEIF / JPG / JPEGを選択してください。';
  if (!file.size) return '空のファイルです。';
  if (file.size > LIMITS.bytes) return '100MBを超える画像です。';
  return '';
}
export function normalizeSettings(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    longEdge: PRESETS.has(String(value.longEdge)) || value.longEdge === 'custom' ? String(value.longEdge) : DEFAULTS.longEdge,
    customLongEdge: Number.isInteger(value.customLongEdge) && value.customLongEdge >= 1 && value.customLongEdge <= 100000 ? value.customLongEdge : DEFAULTS.customLongEdge,
    quality: Number.isInteger(value.quality) && value.quality >= 1 && value.quality <= 100 ? value.quality : DEFAULTS.quality,
  };
}
export function validateOptions(options) {
  if (!Number.isInteger(options.longEdge) || options.longEdge < 0 || options.longEdge > 100000) throw new Error('長辺サイズは1〜100000pxの整数、または原寸を指定してください。');
  if (!Number.isInteger(options.quality) || options.quality < 1 || options.quality > 100) throw new Error('品質は1〜100の整数を指定してください。');
  return options;
}
export function outputBase(inputName) {
  let base = inputName.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '') || 'converted';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = '_' + base;
  return [...base].slice(0, 120).join('');
}
export async function uniqueName(inputName, reserved, exists = async () => false) {
  const base = outputBase(inputName);
  for (let i = 1; i < 10000; i++) {
    const name = i === 1 ? base + '.jpg' : base + '_' + i + '.jpg';
    const key = name.toLowerCase();
    if (!reserved.has(key) && !(await exists(name))) { reserved.add(key); return name; }
  }
  throw new Error('重複しないファイル名を作れませんでした。');
}
export function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']; let index = 0;
  while (bytes >= 1024 && index < units.length - 1) { bytes /= 1024; index++; }
  return bytes.toFixed(index ? 1 : 0) + ' ' + units[index];
}
export function inputFormat(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 16 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (size < 16 || size > bytes.length || size > 4096) throw new Error('HEIFヘッダーが不正です。');
    const brands = [String.fromCharCode(...bytes.subarray(8, 12))];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(String.fromCharCode(...bytes.subarray(i, i + 4)));
    if (brands.some(brand => ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand))) return 'heic';
  }
  throw new Error('JPEGまたはHEIC/HEIFの画像データではありません。');
}
