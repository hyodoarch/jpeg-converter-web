# JPEGコンバーター

HEIC / HEIF / JPG / JPEGをJPEGへ変換する完全ブラウザ版です。利用者にはPython・Node.js・ImageMagickのインストールも、ローカルサーバー起動も不要です。

公開先（公開設定・push後）：https://hyodoarch.github.io/jpeg-converter-web/

## 使い方

1. 長辺と品質を設定します。初期値は**1200px・品質85**。
2. 必要なら「フォルダを選択」で直接保存先を選びます。未選択ならダウンロード保存です。
3. ドラッグ＆ドロップ、または「ファイルを選択」で合計20枚まで追加します。
4. 「変換開始」で1枚ずつ変換します。状態・変換前後の容量・寸法を表示します。
5. フォルダ未選択時は各行の「保存」、または「まとめてZIP保存」を押します。
6. 「クリア」で保持データを解放します。処理中は「キャンセル」でWorkerを終了できます。

長辺は原寸、1800、1500、1200、900、600、450px、カスタム（1〜100000px）。
縦横比を維持し、拡大しません。品質は1〜100。設定はlocalStorageに保存し、保存不可でも動作します。

1ファイル100MB・1億画素まで。処理可能サイズはブラウザのメモリにも依存します。
ダウンロード待ちJPEGは合計256MBまで保持します。大きな画像にはフォルダ保存か少ない枚数を使ってください。
キャンセル済み・失敗した画像はクリアして再選択します。変換後に容量が増える場合もあります。

## 変換処理

Vite＋JavaScript、@imagemagick/magick-wasmを使用します。

- バイナリヘッダー検査後、JPEG / HEICデコーダーに限定して最初の画像を読み込みます。
- 向きを画素へ反映 → 元のICCでsRGBへ変換 → 白背景で透明部分除去 → 縮小 → メタデータ削除 → JPEG出力。
- ICCなしのHEIFでもnclx/CICPのSDR色指定（sRGB・Display P3・BT.709・BT.2020）を標準プロファイルで変換します。色指定も不明な画像はsRGBとみなします。
- ICCなしのPQ/HLG HDRおよび未対応CICPは、色を誤って出力せず、画像別のエラーとして表示します。
- EXIF（GPS含む）・XMP・IPTC・コメント・元のICCを削除し、アプリ共通のsRGB ICCだけを付け直します。
- JPEGは8bit・4:2:0・プログレッシブ。HDR表示維持を目的とした出力ではありません。
- HEIFの複数画像、Live Photosの動画・深度情報は出力しません。
- 1枚の失敗で全体を止めず、120秒のタイムアウト後も次へ進みます。

画像処理は専用Workerで逐次実行し、入力・出力バッファはtransferします。
各画像のネイティブ領域を解放し、バッチ完了・キャンセル時にはWorkerも終了します。
直接保存したJPEGは保持しません。ダウンロード待ちBlobは再保存・ZIP用に保持し、
クリアまたはページ終了で解放します。ダウンロード用URLは最長30秒で失効します。ZIPも同じサイトから配信する別Workerで生成します。

## 保存と同名ファイル

デスクトップEdge / ChromeのHTTPS環境ではFile System Access APIを使用します。
フォルダ選択はユーザーのクリックで行い、書き込み権限が必要です。
保存失敗時は変換済みJPEGを個別・ZIPで保存できます（保持上限以内）。
フォルダ権限はセッション内で扱い、再訪時に選び直します。

既存ファイルを確認してphoto.jpg、photo_2.jpgと連番を付けます。
バッチ内の予約名は大文字小文字を区別せず、不正文字・Windows予約名も処理します。
書き込み直前にも存在を確認しますが、APIに原子的な「存在しなければ作成」がないため、
別アプリが同時に同名を作る競合は完全には防げません。出力中は同じ保存先へ同名を書かないでください。

ダウンロードの保存先・重複時の処理はブラウザが管理します。
ZIP内の名前は重複せず、ZIP名には日時を付けます。

## 対応ブラウザ

| ブラウザ | 個別・ZIP保存 | 選択フォルダへ直接保存 |
| --- | --- | --- |
| デスクトップChrome / Edge | 対応 | 対応（HTTPS・権限が必要） |
| Firefox | 対応 | 非対応 |
| Safari | 対応する環境を想定 | 非対応 |
| モバイル | メモリ・保存UIに依存 | 通常非対応 |

現在のWASM・Worker対応ブラウザを対象にしています。
WindowsのPlaywright Chromium・Firefox・WebKitで自動検証します。
WebKit検証は実際のmacOS / iOS Safari端末での確認を代替しません。
結果と未検証事項は [VALIDATION.md](VALIDATION.md) を参照してください。

## 画像を送信しない仕組み

画像・ファイル名・元のメタデータを送るAPIはありません。
File APIで読み込み、Worker内で処理します。画像をlocalStorageに保存しません。

JS・WASM・ICC・CSS・ZIPコードはすべて同じサイトから配信します。
外部API・CDN・解析・追跡サービス・外部フォントを使いません。
Content Security Policyも接続先とWorkerを同じオリジンに制限します。
ページと静的資産の読み込みでは通常のネット通信が発生し、Pages側にIP等のアクセス情報が届きます。
画像の送信は行いません。

初回は約15MBのWASMを読み込みます。Service Workerによるオフライン利用は保証していません。

## 開発方法（開発者のみ）

Node.js 24系を使用します。利用者には不要です。

~~~sh
npm ci
npm run check
npm run dev
~~~

開発URLは /jpeg-converter-web/ です。
開発サーバーでのみCSS注入・ローカルHMRを許可します。本番ビルドでは厳格なCSPを維持します。
最終表示と動作は本番previewで確認してください。

~~~sh
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
npm run preview
~~~

checkは設定・制限・同名保護・保存失敗・8種類の向き・寸法・品質による量子化テーブル変化・
メタデータ削除・sRGB・HEIC/HEIFを検証します。ブラウザテストは本番distを指定baseで配信し、
20枚処理・保存・Worker/WASM・通信記録を検証します。

tests/fixturesには個人写真を含まない合成素材を同梱します。
scripts/make-fixtures.pyは生成用の開発補助です。HEIFはscripts/make-heif-fixtures.py、標準色プロファイルはscripts/make-color-profiles.pyで生成しました。通常のテストやビルドにPythonは不要です。
実写真はコミットせず、gitignore対象の.local-tests/manifest.jsonへ次の形式でローカルパスを指定します。

~~~json
[
  {
    "path": "LOCAL_PRIVATE_PATH",
    "extension": "heic",
    "dimensions": [900, 1200],
    "reference": ".local-tests/native-reference.jpg"
  }
]
~~~

REAL_IMAGE_MANIFEST環境変数へJSONパスを設定するとChromiumの実写真20枚テストを実行します。
比較用JPEGは別のImageMagickでsRGB ICCを使って作成します。
test-resultsにも個人写真をコミットしないでください。
TEST_EDGE=1を設定するとインストール済みのEdgeもテスト対象になります。

## GitHub Pagesへの公開

1. この変更をレビューし、明示的な操作でコミット・pushします。
2. **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
3. Actionsを有効にし、mainへのpushまたは「Validate and deploy GitHub Pages」のRun workflowを実行します。
4. npm ci → 検証 → ビルド → ブラウザテストを通過するとdistを公開します。PRは検証のみです。
5. https://hyodoarch.github.io/jpeg-converter-web/ を開き、DevToolsでWorker・WASM・ICCが同じサイトから200で読み込まれることと、HEIC変換・保存を確認します。

Viteのbaseは **/jpeg-converter-web/** です。
リポジトリ名変更時はvite.config.jsとブラウザテストのbaseURLを合わせてください。
package-lock.jsonを管理し、CIはnpm ciを使用します。

## 旧アプリからの引き継ぎ

指定された旧jpeg-drop-converterのconfig/default.json、webのHTML・JS・CSS、
server/imagemagick.jsを参照しました。初期値1200px・85、20枚、選択肢、配色、設定キー、
白背景、元画像保持、拡大しない処理、プログレッシブJPEGを引き継ぎました。

ローカルHTTPサーバー・ImageMagick実行ファイルへの依存を削除し、
並列数3をWorker内の逐次処理へ変更しました。ICCによる色変換とダウンロード・ZIPを追加しました。

## ライセンス

既存の [MIT LICENSE](LICENSE) を保持しています。
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

ビルド時にmagick-wasmのLICENSEと全NOTICE、fflateのMIT LICENSE、
ViteのLICENSEをdist/licensesへコピーします。
画面の「ライセンス・NOTICE」から一覧を確認できます。
