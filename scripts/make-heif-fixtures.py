"""Optional developer generator. Requires Pillow and pillow-heif, not used by CI."""
from pathlib import Path
from PIL import Image, ImageOps, ImageCms
import pillow_heif
pillow_heif.register_heif_opener()
root = Path('tests/fixtures')
target = Path('src/assets/sRGB.icc').read_bytes()
image = ImageOps.exif_transpose(Image.open(root / 'orientation-6.jpg'))
image.info.clear()
for extension in ['heic', 'heif']:
    image.save(root / ('pattern.' + extension), format='HEIF', quality=90, icc_profile=target)
patches = Image.new('RGB', (192, 128))
palette = [(210,60,35),(55,160,50),(50,50,205),(185,145,55),(160,50,170),(40,160,170)]
for y in range(128):
    for x in range(192):
        patches.putpixel((x,y), palette[(x//64) + 3*(y//64)])
for primaries, transfer in [(12,13),(1,1),(9,13)]:
    name = 'nclx-' + str(primaries) + '-' + str(transfer)
    patches.save(root / (name + '.heif'), format='HEIF', quality=95,
                 save_nclx_profile=True, color_primaries=primaries,
                 transfer_characteristics=transfer, matrix_coefficients=1, full_range_flag=1)
    with Image.open(root / (name + '.heif')) as decoded:
        output = ImageCms.profileToProfile(decoded.convert('RGB'),
            ImageCms.ImageCmsProfile('src/assets/cicp-' + str(primaries) + '-' + str(transfer) + '.icc'),
            ImageCms.ImageCmsProfile('src/assets/sRGB.icc'), outputMode='RGB')
        output.save(root / (name + '-expected.png'))
patches.save(root / 'nclx-hdr.heif', format='HEIF', quality=95,
             save_nclx_profile=True, color_primaries=9,
             transfer_characteristics=16, matrix_coefficients=9, full_range_flag=1)
