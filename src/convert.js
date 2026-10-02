import {
  ImageMagick, MagickFormat, MagickReadSettings, MagickImageInfo,
  MagickColors, AlphaAction, Interlace, MagickGeometry,
} from '@imagemagick/magick-wasm';
import { inputFormat, validateOptions, LIMITS } from './core.js';
import { toSrgb } from './color.js';

export function convert(bytes, options, srgbBytes, progress = () => {}, sourceProfiles = {}) {
  validateOptions(options);
  if (bytes.length > LIMITS.bytes) throw new Error('100MBを超える画像です。');
  const kind = inputFormat(bytes);
  const settings = new MagickReadSettings({ format: kind === 'jpeg' ? MagickFormat.Jpeg : MagickFormat.Heic, frameIndex: 0, frameCount: 1 });
  const info = MagickImageInfo.create(bytes, settings);
  if (!info.width || !info.height || info.width * info.height > LIMITS.pixels) throw new Error('画像が大きすぎます（最大1億画素）。');
  progress('画像を読み込み中');
  return ImageMagick.read(bytes, settings, image => {
    image.autoOrient();
    progress('向き・色を調整中');
    const target = toSrgb(image, srgbBytes, sourceProfiles);
    image.backgroundColor = MagickColors.White;
    image.alpha(AlphaAction.Remove); image.alpha(AlphaAction.Off);
    if (options.longEdge && Math.max(image.width, image.height) > options.longEdge) {
      progress('リサイズ中');
      image.resize(new MagickGeometry(options.longEdge + 'x' + options.longEdge + '>'));
    }
    image.strip();
    // Reattach only our generic output ICC, never the original metadata.
    image.setProfile(target); image.depth = 8; image.quality = options.quality;
    image.settings.interlace = Interlace.Plane;
    image.settings.setDefine(MagickFormat.Jpeg, 'sampling-factor', '2x2');
    const width = image.width, height = image.height;
    progress('JPEGを書き出し中');
    return image.write(MagickFormat.Jpeg, data => ({ bytes: data.slice(), width, height }));
  });
}
