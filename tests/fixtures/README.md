# Synthetic test fixtures

All pictures were generated for this project and contain no private photos.
They are covered by the application MIT LICENSE.

orientation-1.jpg through orientation-8.jpg: deterministic random RGB pixels
with all eight EXIF orientations, invented GPS, XMP, IPTC and a generic sRGB ICC.
expected-1.png through expected-8.png: independent Pillow EXIF-transpose output.

pattern.heic and pattern.heif: genuine HEIF/HEVC binary containers encoded from
the oriented synthetic picture using pillow-heif 1.8.0 / libheif. They are
separate extension coverage fixtures, not two different iPhone camera samples.

scripts/make-fixtures.py generates the JPEG and PNG files. For HEIC generation,
register pillow_heif's Pillow plugin, transpose orientation-6.jpg, clear im.info,
and save as HEIF with quality 90 and src/assets/sRGB.icc. These tools are only
needed to regenerate fixtures. npm ci/check/build require no Python.
