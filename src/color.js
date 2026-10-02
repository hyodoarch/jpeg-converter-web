import { ColorProfile, ColorSpace } from '@imagemagick/magick-wasm';

// HEIF decoding performs YCbCr->RGB but does not attach an ICC for nclx-only
// wide-gamut input. Respect its primaries/transfer, rather than mislabeling RGB.
export function toSrgb(image, targetBytes, sourceProfiles = {}) {
  const target = new ColorProfile(targetBytes);
  let source = image.getColorProfile();
  if (!source) {
    const cicp = image.getAttribute('heic:cicp');
    if (cicp) {
      const [primaries, transfer] = cicp.split('/').map(Number);
      if ([16, 18].includes(transfer)) throw new Error('ICCのないHDR（PQ / HLG）HEIFには現在対応していません。SDR画像を選択してください。');
      if (primaries !== 2 && transfer !== 2 && !(primaries === 1 && transfer === 13)) {
        const bytes = sourceProfiles[primaries + '/' + transfer];
        if (!bytes) throw new Error('このHEIFの色指定には未対応です（CICP ' + primaries + '/' + transfer + '）。ICC付き、またはsRGBの画像を選択してください。');
        source = new ColorProfile(bytes);
        image.setProfile(source);
      }
    }
  }
  if (source) {
    if (!image.transformColorSpace(target)) throw new Error('元の色プロファイルからsRGBへ変換できませんでした。');
  } else { image.colorSpace = ColorSpace.sRGB; }
  return target;
}
