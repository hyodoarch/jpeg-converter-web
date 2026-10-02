import { initializeImageMagick, ResourceLimits } from '@imagemagick/magick-wasm';
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';
import srgbUrl from './assets/sRGB.icc?url';
import bt709Url from './assets/cicp-1-1.icc?url';
import p3Url from './assets/cicp-12-13.icc?url';
import p3Bt709Url from './assets/cicp-12-1.icc?url';
import bt2020Url from './assets/cicp-9-13.icc?url';
import bt2020Bt709Url from './assets/cicp-9-1.icc?url';
import { convert } from './convert.js';

let ready;
async function initialize() {
  const response = await fetch(srgbUrl, { credentials: 'omit' });
  if (!response.ok) throw new Error('sRGBプロファイルの読み込みに失敗しました。');
  const profile = new Uint8Array(await response.arrayBuffer());
  await initializeImageMagick(new URL(wasmUrl, self.location.href));
  ResourceLimits.memory = 512n * 1024n * 1024n; ResourceLimits.disk = 0n;
  ResourceLimits.width = 100000n; ResourceLimits.height = 100000n;

  const sourceProfiles = {};
  for (const [name, url] of Object.entries({ '1/1': bt709Url, '12/13': p3Url, '12/1': p3Bt709Url, '9/13': bt2020Url, '9/1': bt2020Bt709Url })) {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error('色プロファイルの読み込みに失敗しました。');
    sourceProfiles[name] = new Uint8Array(await response.arrayBuffer());
  }
  return { profile, sourceProfiles };
}
self.onmessage = async ({ data }) => {
  const { id, buffer, options } = data;
  try {
    ready ??= initialize();
    const { profile, sourceProfiles } = await ready;
    const result = convert(new Uint8Array(buffer), options, profile, message => self.postMessage({ id, type: 'progress', message }), sourceProfiles);
    self.postMessage({ id, type: 'result', ...result }, [result.bytes.buffer]);
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : '画像を変換できませんでした。' });
  }
};
