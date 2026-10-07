// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpineDetection } from './useSpineDetection';
import { rectQuad } from './spine-perspective';

class Detector {
  static created: Detector[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    Detector.created.push(this);
  }
  deliver() {
    this.onmessage?.({
      data: {
        candidates: [
          {
            quad: rectQuad({ x: 40, y: 20, width: 45, height: 180 }),
            confidence: 0.9,
          },
        ],
      },
    });
  }
}
const source = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 2048;
  return canvas;
};
beforeEach(() => {
  Detector.created = [];
  vi.stubGlobal('Worker', Detector);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        drawImage: vi.fn(),
        getImageData: () => ({
          data: new Uint8ClampedArray(this.width * this.height * 4),
        }),
      } as unknown as CanvasRenderingContext2D;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('detección cancelable de lomos', () => {
  it('maps the bounded worker result to full-resolution photo coordinates', () => {
    const select = vi.fn(),
      photo = source();
    const { result } = renderHook(() => useSpineDetection(photo, select));
    // Keep a stable source: changing photographs intentionally replaces the worker.
    act(() => Detector.created[0].deliver());
    expect(select).toHaveBeenCalledWith(
      rectQuad({ x: 320, y: 160, width: 360, height: 1440 }),
    );
    expect(result.current.detecting).toBe(false);
  });
  it('ignores a previous photograph that finishes after a replacement', () => {
    const select = vi.fn();
    const first = source(),
      next = source();
    const { rerender } = renderHook(
      ({ photo }) => useSpineDetection(photo, select),
      { initialProps: { photo: first } },
    );
    const old = Detector.created[0];
    rerender({ photo: next });
    expect(old.terminate).toHaveBeenCalled();
    act(() => old.deliver());
    expect(select).not.toHaveBeenCalled();
    act(() => Detector.created[1].deliver());
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('manual corner adjustment cancels detection, and retry starts a fresh worker', () => {
    const photo = source(),
      select = vi.fn();
    const { result } = renderHook(() => useSpineDetection(photo, select));
    const old = Detector.created[0];
    act(() => result.current.cancelDetection());
    act(() => old.deliver());
    expect(result.current.detecting).toBe(false);
    expect(select).not.toHaveBeenCalled();
    expect(old.terminate).toHaveBeenCalled();
    act(() => result.current.detectAgain());
    expect(Detector.created).toHaveLength(2);
    act(() => Detector.created[1].deliver());
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('returns to manual editing on timeout and ignores callbacks after unmounting', () => {
    vi.useFakeTimers();
    const photo = source(),
      select = vi.fn();
    const { result, unmount } = renderHook(() =>
      useSpineDetection(photo, select),
    );
    act(() => vi.advanceTimersByTime(12000));
    expect(result.current.detecting).toBe(false);
    expect(result.current.detectionMessage).toContain('cuatro esquinas');
    const old = Detector.created[0];
    act(() => old.deliver());
    expect(select).not.toHaveBeenCalled();
    unmount();
    act(() => old.deliver());
    expect(select).not.toHaveBeenCalled();
  });
  it('ignores late results after a worker error and permits a fresh retry', () => {
    const photo = source(),
      select = vi.fn();
    const { result } = renderHook(() => useSpineDetection(photo, select));
    const old = Detector.created[0];
    act(() => old.onerror?.());
    act(() => old.deliver());
    expect(result.current.detecting).toBe(false);
    expect(select).not.toHaveBeenCalled();
    act(() => result.current.detectAgain());
    act(() => Detector.created[1].deliver());
    expect(select).toHaveBeenCalledTimes(1);
    act(() => old.onerror?.());
    expect(result.current.detectionMessage).toContain('Bordes detectados');
  });
});
