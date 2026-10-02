import { test, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { initMagick, inspect, assertCleanJpeg, difference } from '../helpers.mjs';

const fixture = name => 'tests/fixtures/' + name;
async function downloadedBytes(download) { return new Uint8Array(await readFile(await download.path())); }
async function start(page) { await page.locator('#convertButton').click(); await expect(page.locator('#progressLabel')).toHaveText('完了', { timeout: 110000 }); }
test.beforeAll(initMagick);
test('browser conversion, error isolation, ZIP, individual saving, and network privacy', async ({ page, context }) => {
  const requests = [], failures = [];
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('./');
  const files = [
    { name: 'PRIVATE_FILENAME_6.jpg', mimeType: 'image/jpeg', buffer: await readFile(fixture('orientation-6.jpg')) },
    { name: 'PRIVATE_FILENAME_bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([255,216,255,0]) },
    { name: 'PRIVATE_FILENAME_heic.heic', mimeType: 'image/heic', buffer: await readFile(fixture('pattern.heic')) },
    { name: 'PRIVATE_FILENAME_heif.heif', mimeType: 'image/heif', buffer: await readFile(fixture('pattern.heif')) },
  ];
  await page.locator('#fileInput').setInputFiles(files); await start(page);
  await expect(page.locator('#successCount')).toHaveText('3'); await expect(page.locator('#failureCount')).toHaveText('1');
  const singleWait = page.waitForEvent('download');
  await page.locator('.download-one').first().click(); const single = await singleWait;
  assert.equal(single.suggestedFilename(), 'PRIVATE_FILENAME_6.jpg');
  const bytes = await downloadedBytes(single);
  assertCleanJpeg(assert, bytes); assert.deepEqual([inspect(bytes).width, inspect(bytes).height], [240, 320]);
  const zipWait = page.waitForEvent('download'); await page.locator('#zipButton').click();
  const archive = unzipSync(await downloadedBytes(await zipWait));
  assert.equal(Object.keys(archive).length, 3);
  for (const bytes of Object.values(archive)) assertCleanJpeg(assert, bytes);
  assert.deepEqual(failures, []);
  assert.ok(requests.some(r => r.url.endsWith('.wasm')), 'WASM request recorded');
  assert.ok(requests.some(r => /worker-.*\.js/.test(r.url)), 'worker request recorded');
  for (const request of requests) {
    if (['data:', 'edge:'].includes(new URL(request.url).protocol)) continue;
    assert.equal(new URL(request.url).origin, 'http://127.0.0.1:4173', 'Unexpected URL: ' + request.url.slice(0, 200));
    assert.equal(request.method, 'GET'); assert.equal(request.body, null);
    assert.ok(!request.url.includes('PRIVATE')); assert.equal(new URL(request.url).search, '');
  }
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/network-' + test.info().project.name + '.json', JSON.stringify(requests.map(r => new URL(r.url).protocol === 'data:' ? { url: 'data:(local browser resource)', method: r.method, body: null } : r), null, 2));
  await page.screenshot({ path: 'test-results/desktop-' + test.info().project.name + '.png', fullPage: true });
});
test('20 images sequentially, duplicates, limits, settings and cancellation', async ({ page }) => {
  await page.goto('./');
  await page.locator('#longEdge').selectOption('custom'); await page.locator('#customLongEdge').fill('100'); await page.locator('#customLongEdge').dispatchEvent('change');
  await page.locator('#quality').fill('72'); await page.locator('#quality').dispatchEvent('input');
  await page.reload(); await expect(page.locator('#customLongEdge')).toHaveValue('100'); await expect(page.locator('#quality')).toHaveValue('72');
  const data = await readFile(fixture('orientation-6.jpg'));
  const files = Array.from({ length: 20 }, () => ({ name: 'same.jpg', mimeType: 'image/jpeg', buffer: data }));
  await page.locator('#fileInput').setInputFiles([...files, files[0]]);
  await expect(page.locator('#selectionError')).toContainText('20枚'); await expect(page.locator('#fileCount')).toHaveText('0枚');
  await page.locator('#fileInput').setInputFiles(files); await start(page);
  await expect(page.locator('#successCount')).toHaveText('20');
  const zipWait = page.waitForEvent('download'); await page.locator('#zipButton').click();
  const archive = unzipSync(await downloadedBytes(await zipWait));
  assert.equal(Object.keys(archive).length, 20); assert.ok(archive['same_20.jpg']);
  for (const bytes of Object.values(archive)) assert.deepEqual([inspect(bytes).width, inspect(bytes).height], [75, 100]);
  await page.locator('#cancelButton').click(); await expect(page.locator('#fileCount')).toHaveText('0枚');
  await page.locator('#fileInput').setInputFiles(files);
  await page.locator('#convertButton').click(); await page.locator('#cancelButton').click();
  await expect(page.locator('#progressLabel')).toHaveText('完了', { timeout: 10000 });
  const success = Number(await page.locator('#successCount').textContent());
  const skipped = Number(await page.locator('#skipCount').textContent());
  assert.equal(success + skipped, 20);
});
test('drag and drop, unsupported format, mobile layout and corrupt settings', async ({ page }) => {
  await page.goto('./'); await page.evaluate(() => localStorage.setItem('local-jpeg-converter-settings-v1', '{broken')); await page.reload();
  await expect(page.locator('#longEdge')).toHaveValue('1200'); await expect(page.locator('#quality')).toHaveValue('85');
  const buffer = [...await readFile(fixture('orientation-1.jpg'))];
  await page.evaluate(bytes => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'drop.jpg', { type: 'image/jpeg' }));
    dt.items.add(new File(['oops'], 'unsupported.png', { type: 'image/png' }));
    document.getElementById('dropZone').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  }, buffer);
  await expect(page.locator('#fileCount')).toHaveText('2枚'); await start(page);
  await expect(page.locator('#successCount')).toHaveText('1'); await expect(page.locator('#skipCount')).toHaveText('1');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'test-results/mobile-' + test.info().project.name + '.png', fullPage: true });
});
test('directory API writes without overwriting and releases saved blobs', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'OS folder API is Chrome/Edge only');
  await page.goto('./');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('jpeg-test-' + crypto.randomUUID(), { create: true });
    const initial = await dir.getFileHandle('same.jpg', { create: true });
    const writer = await initial.createWritable(); await writer.write('ORIGINAL'); await writer.close();
    window.testDirectory = dir;
    window.showDirectoryPicker = async () => dir;
  });
  await page.locator('#chooseFolder').click();
  await page.locator('#fileInput').setInputFiles([{ name: 'same.heic', mimeType: 'image/heic', buffer: await readFile(fixture('pattern.heic')) }]);
  await start(page); await expect(page.locator('#fileList')).toContainText('保存完了: same_2.jpg');
  assert.equal(await page.evaluate(async () => (await (await window.testDirectory.getFileHandle('same.jpg')).getFile()).text()), 'ORIGINAL');
  const output = new Uint8Array(await page.evaluate(async () => [...new Uint8Array(await (await (await window.testDirectory.getFileHandle('same_2.jpg')).getFile()).arrayBuffer())]));
  assertCleanJpeg(assert, output);
  await expect(page.locator('#zipButton')).toBeDisabled(); assert.equal(await page.locator('.download-one').count(), 0);
});
test('WASM loading failure settles each image without hanging', async ({ page }) => {
  await page.route('**/*.wasm', route => route.abort());
  await page.goto('./'); await page.locator('#fileInput').setInputFiles([fixture('orientation-1.jpg'), fixture('orientation-6.jpg')]); await start(page);
  await expect(page.locator('#failureCount')).toHaveText('2'); await expect(page.locator('#cancelButton')).toBeEnabled();
});
test('real iPhone images: 20 conversions and independent native reference', async ({ page, context, browserName }) => {
  const requests = [], errors = [];
  context.on('request', r => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
  page.on('pageerror', e => errors.push(e.message));
  test.skip(!process.env.REAL_IMAGE_MANIFEST || browserName !== 'chromium', 'Optional private local fixtures are never committed');
  const manifest = JSON.parse(await readFile(process.env.REAL_IMAGE_MANIFEST, 'utf8'));
  await page.goto('./');
  const files = await Promise.all(Array.from({ length: 20 }, async (_, i) => {
    const source = manifest[i % manifest.length];
    return { name: 'local-real-' + i + '.' + source.extension, mimeType: source.extension === 'jpg' ? 'image/jpeg' : 'image/heif', buffer: await readFile(source.path) };
  }));
  await page.locator('#fileInput').setInputFiles(files); await start(page); await expect(page.locator('#successCount')).toHaveText('20');
  const zipWait = page.waitForEvent('download'); await page.locator('#zipButton').click(); const archive = unzipSync(await downloadedBytes(await zipWait));
  const comparisons = [];
  for (let i = 0; i < 20; i++) {
    const source = manifest[i % manifest.length], bytes = archive['local-real-' + i + '.jpg'];
    assertCleanJpeg(assert, bytes);
    assert.deepEqual([inspect(bytes).width, inspect(bytes).height], source.dimensions);
    const reference = new Uint8Array(await readFile(source.reference));
    const error = difference(bytes, reference);
    comparisons.push({ extension: source.extension, dimensions: source.dimensions, normalizedMeanAbsoluteError: error });
    assert.ok(error < 0.025, 'orientation/color agree with native ImageMagick reference');
  }
  const actualQuality = [];
  for (const quality of [20, 95]) {
    await page.locator('#cancelButton').click();
    await page.locator('#quality').fill(String(quality)); await page.locator('#quality').dispatchEvent('input');
    await page.locator('#fileInput').setInputFiles([files[0]]); await start(page);
    const wait = page.waitForEvent('download'); await page.locator('.download-one').click();
    const output = await downloadedBytes(await wait); assertCleanJpeg(assert, output);
    actualQuality.push(output.length);
  }
  assert.ok(actualQuality[1] > actualQuality[0]);
  for (const r of requests) {
    if (['data:', 'edge:'].includes(new URL(r.url).protocol)) continue;
    assert.equal(new URL(r.url).origin, 'http://127.0.0.1:4173', 'Unexpected URL: ' + r.url.slice(0, 200));
    assert.equal(r.method, 'GET'); assert.equal(r.body, null);
    assert.equal(new URL(r.url).search, ''); assert.ok(!r.url.includes('local-real-'));
  }
  assert.deepEqual(errors, []);
  await writeFile('test-results/real-validation-' + test.info().project.name + '.json', JSON.stringify({ comparisons, actualQuality, requests: requests.map(r => new URL(r.url).protocol === 'data:' ? { url: 'data:(local browser resource)', method: r.method, body: null } : r) }, null, 2));
});

// A folder write failure must retain a saveable JPEG and let later images finish.
test('folder write errors fall back to downloads without stopping batch', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Directory picker branch is Chrome/Edge only');
  await page.goto('./');
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => ({
      name: 'write-failure', queryPermission: async () => 'granted',
      getFileHandle: async (name, options) => {
        if (!options?.create) throw new DOMException('', 'NotFoundError');
        return { createWritable: async () => { throw new DOMException('Disk full', 'QuotaExceededError'); } };
      },
    });
  });
  await page.locator('#chooseFolder').click();
  await page.locator('#fileInput').setInputFiles([fixture('orientation-1.jpg'), fixture('orientation-6.jpg')]);
  await start(page); await expect(page.locator('#successCount')).toHaveText('2');
  await expect(page.locator('#fileList')).toContainText('フォルダ保存失敗');
  assert.equal(await page.locator('.download-one').count(), 2);
  const wait = page.waitForEvent('download'); await page.locator('#zipButton').click();
  assert.equal(Object.keys(unzipSync(await downloadedBytes(await wait))).length, 2);
});
test('nclx-only HEIF color management, HDR errors, and worker cleanup', async ({ page }) => {
  await page.goto('./');
  await page.locator('#fileInput').setInputFiles([
    fixture('nclx-12-13.heif'), fixture('nclx-1-1.heif'), fixture('nclx-9-13.heif'), fixture('nclx-hdr.heif'), fixture('orientation-1.jpg'),
  ]);
  await start(page); await expect(page.locator('#successCount')).toHaveText('4'); await expect(page.locator('#failureCount')).toHaveText('1');
  await expect(page.locator('#fileList')).toContainText('HDR');
  for (let i = 0; i < 3; i++) {
    const wait = page.waitForEvent('download'); await page.locator('.download-one').nth(i).click();
    const bytes = await downloadedBytes(await wait), name = ['nclx-12-13','nclx-1-1','nclx-9-13'][i];
    assertCleanJpeg(assert, bytes);
    assert.ok(difference(bytes, new Uint8Array(await readFile(fixture(name + '-expected.png')))) < 0.025);
  }
  await expect.poll(() => page.workers().length).toBe(0);
});
