"""Developer-only fixture generator; no private photographs are included."""
from pathlib import Path
from PIL import Image, ImageCms, ImageOps
import random, struct
root = Path('tests/fixtures')
root.mkdir(parents=True, exist_ok=True)
rng = random.Random(4815)
image = Image.new('RGB', (320, 240))
image.putdata([(rng.randrange(256), rng.randrange(256), rng.randrange(256)) for _ in range(320*240)])
profile = Path('src/assets/sRGB.icc').read_bytes()
for orientation in range(1, 9):
    exif = Image.Exif()
    exif[274] = orientation
    exif[270] = 'PRIVATE METADATA TEST'
    exif[34853] = {1: 'N', 2: (35.0, 0.0, 0.0), 3: 'E', 4: (139.0, 0.0, 0.0)}
    path = root / ('orientation-' + str(orientation) + '.jpg')
    image.save(path, quality=95, exif=exif, icc_profile=profile)
    xmp = b'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><private>PRIVATE_XMP_GPS</private></x:xmpmeta>'
    iptc_data = b'\x1c\x02\x78\x00\x0cPRIVATE_IPTC'
    # Photoshop image resource 0x0404 contains IPTC data.
    iptc = b'Photoshop 3.0\0' + b'8BIM\x04\x04\0\0' + struct.pack('>I',len(iptc_data)) + iptc_data
    if len(iptc_data) % 2: iptc += b'\0'
    jpeg = path.read_bytes()
    path.write_bytes(jpeg[:2] + b'\xff\xe1' + struct.pack('>H',len(xmp)+2) + xmp + b'\xff\xed' + struct.pack('>H',len(iptc)+2) + iptc + jpeg[2:])
    with Image.open(path) as opened:
        ImageOps.exif_transpose(opened).save(root / ('expected-' + str(orientation) + '.png'))
