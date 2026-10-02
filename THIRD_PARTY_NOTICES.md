# Third-party notices

The application's existing MIT LICENSE is retained unchanged.

- **@imagemagick/magick-wasm 0.0.44** — Apache-2.0.
  https://github.com/dlemstra/magick-wasm
  Its complete LICENSE and NOTICE are copied without trimming into dist/licenses.
  NOTICE covers the native WASM components including ImageMagick, libheif,
  HEVC decoding libraries and Little CMS.
- **fflate 0.8.3** — MIT. https://github.com/101arrowz/fflate
  The full LICENSE is copied to dist/licenses/fflate-LICENSE.txt.
- **Vite 8.3.2** — MIT and third-party notices. https://github.com/vitejs/vite
  The full LICENSE.md is copied to cover build-injected runtime helpers.
- **src/assets/*.icc** — generated using Little CMS' standard sRGB and SDR RGB primaries/transfer profiles
  through Pillow ImageCms. Little CMS' notice is included in the magick-wasm NOTICE.
  This profile was not extracted from a private photograph.
- **tests/fixtures** — original synthetic pictures made for this project,
  licensed under the application's MIT license. GPS values and other metadata
  are invented. HEIC/HEIF encoding used pillow-heif/libheif as developer-only tools.

package-lock.json pins the installed versions. scripts/licenses.mjs copies the
installed libraries' notices on every build. Developer tools are not distributed
as browser dependencies. License links respect the deployment base.
