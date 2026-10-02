import './style.css';

import { DEFAULTS, LIMITS, SETTINGS_KEY, normalizeSettings, validateOptions, fileError, uniqueName, formatBytes } from './core.js';
import { saveToDirectory, download } from './saving.js';
import { imageError } from './error.js';
const $ = id => document.getElementById(id);
let records = [], directory = null, processing = false, cancelled = false, worker = null, pending = null, zipping = false;
const reserved = new Set();
const controls = ['longEdge', 'customLongEdge', 'quality', 'chooseFolder', 'useDownloads', 'chooseFiles', 'fileInput'];
function showError(message) { $('selectionError').textContent = message; $('selectionError').classList.toggle('hidden', !message); }
function syncSettings() {
  $('customField').classList.toggle('hidden', $('longEdge').value !== 'custom');
  $('qualityValue').textContent = $('quality').value;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ longEdge: $('longEdge').value, customLongEdge: Number($('customLongEdge').value), quality: Number($('quality').value) })); } catch {}
}
function loadSettings() {
  let saved = DEFAULTS;
  try { saved = normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')); } catch {}
  for (const [key, value] of Object.entries(saved)) $(key).value = value;
  syncSettings();
}
function addFiles(fileList) {
  if (processing || zipping) return;
  const files = Array.from(fileList);
  if (records.length + files.length > LIMITS.files) { showError('一度に20枚までです。クリアするか、選択枚数を減らしてください。'); return; }
  showError('');
  for (const file of files) {
    const message = fileError(file);
    records.push({ id: crypto.randomUUID(), file: message ? null : file, name: file.name, inputSize: file.size, state: message ? 'skipped' : 'waiting', message: message || '待機', blob: null, outputSize: 0 });
  }
  render();
}
function render() {
  const done = records.filter(r => ['success', 'error', 'skipped'].includes(r.state)).length;
  const success = records.filter(r => r.state === 'success');
  $('fileList').replaceChildren(...records.map(record => {
    const row = document.createElement('tr'), cells = Array.from({ length: 4 }, () => document.createElement('td'));
    cells[0].textContent = record.name; cells[1].textContent = record.name.split('.').pop().toUpperCase();
    cells[2].textContent = formatBytes(record.inputSize) + (record.outputSize ? ' → ' + formatBytes(record.outputSize) : '');
    const badge = document.createElement('span'); badge.className = 'state ' + record.state;
    badge.textContent = record.message + (record.width ? ' · ' + record.width + ' × ' + record.height + ' px' : '');
    cells[3].append(badge);
    if (record.blob) {
      const button = document.createElement('button'); button.className = 'secondary download-one'; button.textContent = '保存'; button.disabled = processing || zipping;
      button.addEventListener('click', () => download(record.blob, record.outputName)); cells[3].append(button);
    }
    row.append(...cells); return row;
  }));
  $('fileCount').textContent = records.length + '枚';
  $('filePanel').classList.toggle('hidden', !records.length); $('progressPanel').classList.toggle('hidden', !records.length);
  const percent = records.length ? Math.round(done / records.length * 100) : 0;
  $('progressBar').value = percent; $('progressPercent').textContent = percent + '%';
  $('progressLabel').textContent = processing ? '変換中 ' + done + '/' + records.length : done === records.length && records.length ? '完了' : '準備中';
  $('successCount').textContent = success.length;
  $('failureCount').textContent = records.filter(r => r.state === 'error').length;
  $('skipCount').textContent = records.filter(r => r.state === 'skipped').length;
  $('sizeSummary').textContent = success.length ? formatBytes(success.reduce((n, r) => n + r.inputSize, 0)) + ' → ' + formatBytes(success.reduce((n, r) => n + r.outputSize, 0)) : '';
  $('convertButton').disabled = processing || zipping || !records.some(r => r.state === 'waiting');
  $('cancelButton').disabled = !records.length || zipping; $('cancelButton').textContent = processing ? 'キャンセル' : 'クリア';
  $('zipButton').disabled = processing || zipping || !records.some(r => r.blob); $('zipButton').textContent = zipping ? 'ZIP作成中…' : 'まとめてZIP保存';
  for (const id of controls) $(id).disabled = processing || zipping || (id === 'chooseFolder' && !('showDirectoryPicker' in window));
  $('dropZone').setAttribute('aria-disabled', String(processing || zipping)); $('dropZone').tabIndex = processing || zipping ? -1 : 0;
}
function stopWorker() {
  worker?.terminate(); worker = null;
  if (pending) { const active = pending; pending = null; clearTimeout(active.timer); active.reject(new DOMException('処理を中止しました。', 'AbortError')); }
}
function convertInWorker(buffer, options, record) {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (!pending || data.id !== pending.id) return;
      if (data.type === 'progress') { pending.record.message = data.message; render(); return; }
      const active = pending; pending = null; clearTimeout(active.timer);
      if (data.type === 'result') active.resolve(data); else active.reject(new Error(data.message));
    };
    const workerFailed = () => {
      const active = pending; pending = null; worker?.terminate(); worker = null;
      if (active) { clearTimeout(active.timer); active.reject(new Error('画像処理Workerでエラーが発生しました。メモリ不足、またはWASMの読み込み失敗の可能性があります。')); }
    };
    worker.onerror = event => { event.preventDefault(); workerFailed(); }; worker.onmessageerror = workerFailed;
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending = null; worker?.terminate(); worker = null; reject(new Error('処理がタイムアウトしました（120秒）。画像サイズを減らして再試行してください。'));
    }, 120000);
    pending = { id: record.id, resolve, reject, timer, record };
    try { worker.postMessage({ id: record.id, buffer, options }, [buffer]); }
    catch (error) { clearTimeout(timer); pending = null; reject(error); }
  });
}
async function startConversion() {
  if (processing || zipping) return;
  let options;
  try {
    const custom = $('longEdge').value === 'custom', edge = Number(custom ? $('customLongEdge').value : $('longEdge').value);
    if (custom && edge < 1) throw new Error('カスタム長辺は1〜100000pxの整数にしてください。');
    options = validateOptions({ longEdge: edge, quality: Number($('quality').value) });
  } catch (error) { showError(error.message); return; }
  processing = true; cancelled = false; showError(''); render();
  const started = performance.now();
  try {
    if (directory && await directory.queryPermission({ mode: 'readwrite' }) !== 'granted' && await directory.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('保存先の書き込み権限がありません。ダウンロード保存へ切り替えるか、フォルダを選び直してください。');
    for (const record of records.filter(r => r.state === 'waiting')) {
      if (cancelled) { record.state = 'skipped'; record.message = 'キャンセル'; record.file = null; continue; }
      record.state = 'processing'; record.message = 'WASMを準備中'; render();
      try {
        const buffer = await record.file.arrayBuffer(); record.file = null;
        if (cancelled) throw new DOMException('キャンセル', 'AbortError');
        const result = await convertInWorker(buffer, options, record);
        const blob = new Blob([result.bytes], { type: 'image/jpeg' });
        record.width = result.width; record.height = result.height; record.outputSize = blob.size;
        let saveError = '';
        if (directory) {
          record.message = 'フォルダへ保存中'; render();
          try { record.outputName = await saveToDirectory(directory, record.name, blob, reserved); record.message = '保存完了: ' + record.outputName; }
          catch (error) { saveError = '変換完了・フォルダ保存失敗: ' + error.message; }
        }
        if (!directory || saveError) {
          const retained = records.reduce((sum, r) => sum + (r.blob?.size || 0), 0);
          if (retained + blob.size > LIMITS.retainedBytes) throw new Error('保存待ちデータが256MBを超えます。フォルダ保存、または少ない枚数で変換してください。');
          record.outputName = await uniqueName(record.name, reserved); record.blob = blob;
          record.message = saveError || '変換完了: ' + record.outputName + '（保存待ち）';
        }
        record.state = 'success'; $('magickStatus').textContent = '動作確認済み'; $('magickDot').classList.add('ok');
      } catch (error) { record.state = error.name === 'AbortError' ? 'skipped' : 'error'; record.message = error.name === 'AbortError' ? 'キャンセル' : 'エラー: ' + imageError(error); }
      finally { record.file = null; render(); }
    }
  } catch (error) { showError(error.message); }
  finally {
    // Native images are disposed per read callback; release the WASM heap too.
    stopWorker(); processing = false;
    $('timeSummary').textContent = '処理時間 ' + ((performance.now() - started) / 1000).toFixed(1) + '秒'; render();
  }
}
async function chooseFolder() {
  if (processing || zipping) return;
  try { directory = await window.showDirectoryPicker({ mode: 'readwrite' }); $('folderStatus').textContent = directory.name + '（直接保存）'; showError(''); }
  catch (error) { if (error.name !== 'AbortError') showError('フォルダを選択できませんでした: ' + error.message); }
  render();
}
async function downloadZip() {
  if (processing || zipping) return;
  const targets = records.filter(r => r.blob); if (!targets.length) return;
  zipping = true; render(); showError('');
  try {
    const entries = Object.create(null);
    for (const r of targets) entries[r.outputName] = new Uint8Array(await r.blob.arrayBuffer());
    const zipped = await new Promise((resolve, reject) => {
      const zipWorker = new Worker(new URL('./zip-worker.js', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { zipWorker.terminate(); reject(new Error('ZIP作成がタイムアウトしました。')); }, 120000);
      zipWorker.onmessage = ({ data }) => { clearTimeout(timer); zipWorker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data.bytes); };
      zipWorker.onerror = () => { clearTimeout(timer); zipWorker.terminate(); reject(new Error('ZIP Workerを実行できませんでした。')); };
      zipWorker.postMessage(entries, Object.values(entries).map(bytes => bytes.buffer));
    });
    download(new Blob([zipped], { type: 'application/zip' }), 'jpeg-converted-' + new Date().toISOString().replace(/[:.]/g, '-') + '.zip');
  } catch (error) { showError('ZIPを作成できませんでした。個別保存をお試しください: ' + error.message); }
  finally { zipping = false; render(); }
}
$('longEdge').addEventListener('change', syncSettings); $('customLongEdge').addEventListener('change', syncSettings); $('quality').addEventListener('input', syncSettings);
$('chooseFolder').addEventListener('click', chooseFolder);
$('useDownloads').addEventListener('click', () => { directory = null; $('folderStatus').textContent = '個別ダウンロード / ZIP'; render(); });
$('chooseFiles').addEventListener('click', event => { event.stopPropagation(); if (!processing && !zipping) $('fileInput').click(); });
$('fileInput').addEventListener('change', () => { addFiles($('fileInput').files); $('fileInput').value = ''; });
$('dropZone').addEventListener('click', event => { if (!processing && !zipping && event.target !== $('chooseFiles')) $('fileInput').click(); });
$('dropZone').addEventListener('keydown', event => { if (!processing && !zipping && event.target === $('dropZone') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); $('fileInput').click(); } });
for (const type of ['dragenter', 'dragover']) $('dropZone').addEventListener(type, event => { event.preventDefault(); if (!processing && !zipping) $('dropZone').classList.add('dragover'); });
for (const type of ['dragleave', 'drop']) $('dropZone').addEventListener(type, event => { event.preventDefault(); $('dropZone').classList.remove('dragover'); });
$('dropZone').addEventListener('drop', event => addFiles(event.dataTransfer.files));
for (const type of ['dragover', 'drop']) window.addEventListener(type, event => event.preventDefault());
$('convertButton').addEventListener('click', startConversion);
$('cancelButton').addEventListener('click', () => {
  if (processing) { cancelled = true; stopWorker(); }
  else { records = []; reserved.clear(); $('fileInput').value = ''; $('timeSummary').textContent = ''; showError(''); render(); }
});
$('zipButton').addEventListener('click', downloadZip);
if (!('showDirectoryPicker' in window)) $('folderStatus').textContent = '個別ダウンロード / ZIP（フォルダ選択は非対応）';
loadSettings(); render();
