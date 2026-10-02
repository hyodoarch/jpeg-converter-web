# 実装・検証報告

検証日：2026-10-02（日本時間）

ブラウザ版の実装とローカルの本番ビルド検証を完了しました。
**公開URLでの検証は未完了**です。公開先は現在404で、コミット・pushは行っていません。

## 既存仕様とGitの保護

ユーザー指定の旧jpeg-drop-converterから設定・HTML・JS・CSS・ImageMagick処理を読み取りました。
旧フォルダと元写真は変更していません。
初期値1200px・品質85、20枚上限、リサイズ選択肢、配色、白背景、
元画像保持、拡大しない処理、プログレッシブJPEGを引き継ぎました。

対象Gitリポジトリは作業前にgit status -sbとgit fetch --pruneを実行し、
mainとorigin/mainが一致し、未コミット・未pushの変更がないことを確認しました。
既存MIT LICENSEと既存gitignoreのルールは保持しています。

## 検証環境

| 対象 | バージョン |
| --- | --- |
| OS | Windows |
| Node.js / npm | 24.18.0 / 11.16.0 |
| magick-wasm | 0.0.44（Q8 WASM） |
| Vite / fflate | 8.3.2 / 0.8.3 |
| Playwright | 1.63.0 |
| Chromium | 153.0.8010.12 |
| インストール済みEdge | 154.0.4258.48 |
| Firefox | 155.0 |
| WebKit | 26.6 |
| 実画像参照用ImageMagick | 7.1.2 Q16 HDRI |

本番distをhttp://127.0.0.1:4173/jpeg-converter-web/から配信しました。
WebKitはPlaywrightのWindows版であり、Safari実機とは区別します。

## 最終実行結果

- npm ci：成功、package-lockから再現、監査結果0 vulnerabilities。
- npm run check：構文・base・同一オリジンCSP確認、**8件成功**。
- npm run build：成功、WASM・画像Worker・ZIP Worker・ICC・LICENSE/NOTICEの同梱を確認。
- npm run test:browser（実画像とEdgeも有効）：**26件成功・6件スキップ・失敗0件**。
- git diff --check：成功。GitのLF→CRLF案内は出ますが、空白エラーはありません。
- MIT LICENSE：差分なし。

ブラウザの成功数はChromium 8、Edge 8、Firefox 5、WebKit 5です。
スキップ6件はFirefox/WebKitそれぞれのフォルダAPI、保存失敗分岐、
オプションの実iPhone素材テストです。これらのブラウザでも合成HEIC/HEIF/JPEG、
20枚処理、ZIP・個別保存、エラー、色管理、Worker解放を検証しています。

## 確認した機能

| 項目 | 方法・結果 |
| --- | --- |
| 8種類のEXIFの向き | 合成JPEGを独立したPillowの向き補正結果と画素比較、全8種成功 |
| リサイズ・拡大しない | 原寸以下の入力は保持、縦横比維持、指定長辺・丸め寸法を検査 |
| JPEG品質 | 品質20/95で量子化テーブル・容量が変化、実iPhone画像でも確認 |
| sRGB | 元ICCで変換し、出力ICCがアプリ共通sRGBとバイト単位で一致 |
| ICCなしのHEIF | nclx-only Display P3 / BT.709 / BT.2020をPillow CMSの結果と比較 |
| EXIF/GPS/XMP/IPTC除去 | 元データに含め、出力JPEGにAPP1・APP13・コメントがないことを検査 |
| 出力形式 | 8bit、JPEG SOF2（プログレッシブ）、4:2:0を検査 |
| 20枚 | 連続変換、同名の20枚、ZIP内の20個・寸法・一意な名前を検査 |
| 21枚 | 全選択を拒否し、既存選択を保護 |
| 操作 | ファイル選択、ドロップ、設定復元、破損localStorage、キャンセル、クリア |
| Worker | 順次変換、破損画像後の継続、バッチ完了でWorkerが残らないことを検査 |
| 個別・ZIP保存 | 実ダウンロード内容を読み戻してJPEG/ZIPを検査 |
| 直接保存API | Chromium/Edgeの実FileSystemDirectoryHandle（OPFS）で保存・読戻し・既存ファイル保持 |
| 保存失敗 | 書き込みエラーのモックでJPEGを保持、ZIPへ退避し後続処理を継続 |
| エラー | 対応外形式、破損JPEG、WASM読込失敗、非対応HDRが画像別に終了 |
| 表示 | デスクトップと幅390pxのスクリーンショットを確認、横スクロールなし |

直接保存API検証はshowDirectoryPickerをOPFSハンドルへ差し替えています。
**OSのフォルダ選択ダイアログと任意の実フォルダへの保存は自動検証していません。**

## 実iPhone画像での検証

ユーザーに許可された写真フォルダから、Apple / iPhone SEの情報を持つ
実HEICと実JPEGを読み取りました。

- HEIC：Display P3 ICC、EXIF/GPS、XMPを持つ実画像。
- JPEG：RightTopの向き指定、EXIF/XMPを持つ実画像。
- HEIF拡張子：同じ実HEICのバイナリをFile APIで.heifの名前として渡して検証。
  **独立したiPhone由来の.heif実ファイルは見つかっていません。**
- 合成HEIC/HEIFは本物のHEVC入りHEIFコンテナで、単なるJPEGの拡張子変更ではありません。

ChromiumとEdgeそれぞれで20枚の混合バッチを処理し、
全出力が900×1200px・sRGB・元メタデータなしとなり、ZIP保存も成功しました。
20枚は各素材を繰り返した混合バッチで、異なる実写真20種類を検証したものではありません。

PC版ImageMagickで、向き補正・元ICC→sRGB・同寸法・同品質の参照JPEGを作り、
画素を比較しました。正規化平均絶対誤差の最大値は**0.0042562721**、
テストの許容値0.025以内です。

実HEICの1200px出力容量は品質20で**68,596 bytes**、品質95で**398,727 bytes**。
品質指定が実出力に反映されることを確認しました。

実写真・元のファイル名・ローカルパス・参照JPEGはリポジトリに追加していません。
ローカル検証データはgitignore対象の.local-testsだけで扱っています。

## 通信の検査

PlaywrightのBrowserContextでWorkerを含むリクエストを収集しました。
合成素材の検証で、アプリのHTTPリクエストはChromium 12件、Edge 13件、
Firefox 13件、WebKit 12件。すべて同じ127.0.0.1:4173への静的資産GETで、
リクエスト本文なし、クエリなし、入力名なしです。

実iPhone素材の20枚処理と品質変更でも、Chromium/EdgeのHTTP通信について
同じ条件を確認しました。外部オリジンへのHTTP送信はありませんでした。
Edgeのダウンロード画面はedge://downloads-hub/等のブラウザ内資産として
記録されますが、外部へのHTTP通信ではありません。

通信記録はローカルのtest-results/network-*.json、
実画像の比較・品質・通信記録はtest-results/real-validation-*.jsonにあります。
これらはgitignore対象で、テストを再実行すると置き換わります。
画像・元のメタデータをサーバーへ送る処理もソース上に存在しません。

## 未検証・制約

1. 公開URL上のWorker/WASM/ICC読み込みと変換。予定URLは2026-10-02時点で404です。
2. GitHub上でのActions実行・Pagesデプロイ。ローカルで同じインストール・検証・ビルドは確認済みです。
3. OSフォルダ選択ダイアログ、任意の実フォルダへの保存、権限再付与の実機操作。
4. 独立したiPhone由来.heif実ファイル。実HEICの.heif名と合成HEIFは確認済みです。
5. 実際のmacOS Safari・iOS/iPadOS・Android、低メモリ端末。
6. 異なる実iPhone写真20種類、48MP等の大画像や機種別HDR素材の網羅検証。

ICCなしのPQ/HLG HDR、未対応CICPは現在エラー表示とします。
HDRトーンマッピングは実装していません。一般的なSDRとICC付き入力が対象です。
File System Access APIには原子的なcreate-if-absentがないため、
外部アプリとの同時作成競合を完全には防げません。READMEに制約を記載しています。

## 公開に残る操作

1. 変更をレビューし、明示的にコミット・pushする（今回未実行）。
2. Settings → Pages → SourceをGitHub Actionsへ設定する。
3. mainへのpushまたはworkflow_dispatchで公開ワークフローを実行する。
4. https://hyodoarch.github.io/jpeg-converter-web/ でWorker/WASM/ICCの200読み込み、
   実HEIC変換・保存・HTTP通信を確認する。
5. デスクトップEdge/Chromeで実出力フォルダの選択・既存名保護を実機確認する。

## 変更ファイル

既存変更：README.md、.gitignore（既存ルールを保持して追記）。

追加：

- .github/workflows/pages.yml
- index.html、package.json、package-lock.json、vite.config.js、playwright.config.js
- THIRD_PARTY_NOTICES.md、VALIDATION.md、public/favicon.svg
- src/app.js、core.js、convert.js、color.js、error.js、saving.js、worker.js、zip-worker.js、style.css
- src/assets/sRGB.icc、cicp-1-1.icc、cicp-12-1.icc、cicp-12-13.icc、cicp-9-1.icc、cicp-9-13.icc
- scripts/check-source.mjs、licenses.mjs、verify-dist.mjs
- scripts/make-fixtures.py、make-heif-fixtures.py、make-color-profiles.py（開発補助）
- tests/core.test.mjs、convert.test.mjs、helpers.mjs、browser/app.spec.js
- tests/fixtures/README.md、orientation-1〜8.jpg、expected-1〜8.png、
  pattern.heic、pattern.heif、nclx-1-1.heif、nclx-12-13.heif、nclx-9-13.heif、
  各nclxのexpected PNG、nclx-hdr.heif

生成物：dist、public/licenses、test-results、.local-testsはgitignore対象です。
distにはアプリMIT、magick-wasmの完全なLICENSE/NOTICE、fflateとViteのLICENSEを同梱します。

## 最終Git状態

~~~text
## main...origin/main
 M .gitignore
 M README.md
?? .github/
?? THIRD_PARTY_NOTICES.md
?? VALIDATION.md
?? index.html
?? package-lock.json
?? package.json
?? playwright.config.js
?? public/
?? scripts/
?? src/
?? tests/
?? vite.config.js
~~~

HEADとorigin/mainの差はahead 0 / behind 0です。
未コミットの変更・新規ファイルがあり、コミット・pushは行っていません。
