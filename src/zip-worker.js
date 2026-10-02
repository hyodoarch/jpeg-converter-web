import { zipSync } from 'fflate';
self.onmessage = ({ data }) => {
  try {
    const bytes = zipSync(data, { level: 0 });
    self.postMessage({ bytes }, [bytes.buffer]);
  } catch (error) { self.postMessage({ error: error.message || 'ZIP作成に失敗しました。' }); }
};
