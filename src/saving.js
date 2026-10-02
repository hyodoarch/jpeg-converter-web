import { uniqueName } from './core.js';
export async function nameExists(directory, name) {
  try { await directory.getFileHandle(name); return true; }
  catch (error) {
    if (error.name === 'NotFoundError') return false;
    if (error.name === 'TypeMismatchError') return true;
    throw error;
  }
}
export async function saveToDirectory(directory, inputName, blob, reserved) {
  let name = await uniqueName(inputName, reserved, candidate => nameExists(directory, candidate));
  // This API lacks atomic create-if-absent. Recheck immediately before creation.
  while (await nameExists(directory, name)) name = await uniqueName(inputName, reserved, candidate => nameExists(directory, candidate));
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable({ keepExistingData: false, mode: 'exclusive' });
  try { await writable.write(blob); await writable.close(); }
  catch (error) { await writable.abort().catch(() => {}); throw error; }
  return name;
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.rel = 'noopener';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
