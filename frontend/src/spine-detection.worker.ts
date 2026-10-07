import { detectSpines } from './spine-detection';

self.onmessage = (
  event: MessageEvent<{ buffer: ArrayBuffer; width: number; height: number }>,
) => {
  try {
    const { buffer, width, height } = event.data;
    self.postMessage({
      candidates: detectSpines({
        data: new Uint8ClampedArray(buffer),
        width,
        height,
      }),
    });
  } catch {
    self.postMessage({ candidates: [], error: true });
  }
};
