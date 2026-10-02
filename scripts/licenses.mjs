import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
const out = 'public/licenses';
await mkdir(out, { recursive: true });
const copies = [
  ['LICENSE', 'APP-MIT.txt'],
  ['node_modules/@imagemagick/magick-wasm/LICENSE', 'magick-wasm-LICENSE.txt'],
  ['node_modules/@imagemagick/magick-wasm/NOTICE', 'magick-wasm-NOTICE.txt'],
  ['node_modules/fflate/LICENSE', 'fflate-LICENSE.txt'],
  ['node_modules/vite/LICENSE.md', 'vite-LICENSE.txt'],
];
for (const [source, destination] of copies) await copyFile(source, out + '/' + destination);
await writeFile(out + '/index.txt', 'JPEG Converter third-party notices\n\n@imagemagick/magick-wasm (Apache-2.0): LICENSE + full upstream NOTICE include ImageMagick, libheif, HEVC decoder, Little CMS and other WASM components.\nfflate (MIT): fflate-LICENSE.txt\nVite build-injected helpers (MIT and third-party notices): vite-LICENSE.txt\nApplication (MIT): APP-MIT.txt\nsRGB.icc: generated locally using Little CMS standard sRGB profile; generator copyright/licensing is included in magick-wasm-NOTICE.txt.\n\n' + copies.map(([, name]) => name).join('\n') + '\n');
const notice = await readFile(out + '/magick-wasm-NOTICE.txt', 'utf8');
if (!notice.includes('Little CMS') && !notice.includes('lcms')) throw new Error('Upstream color-management notice missing');

await writeFile(out + '/index.html', '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ライセンス・NOTICE</title><h1>ライセンス・NOTICE</h1><p>アプリと同梱ライブラリのライセンスです。</p><ul>' + copies.map(([, name]) => '<li><a href="' + name + '">' + name + '</a></li>').join('') + '</ul><p><a href="index.txt">概要</a></p></html>');