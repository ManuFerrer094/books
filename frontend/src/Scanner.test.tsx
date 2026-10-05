// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import Scanner from './Scanner';

const scanner = vi.hoisted(() => ({
  decode: vi.fn(),
  stop: vi.fn(),
  trackStop: vi.fn(),
}));
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromStream = scanner.decode;
  },
}));
vi.mock('@zxing/library', () => ({
  BarcodeFormat: { EAN_13: 7 },
  DecodeHintType: { POSSIBLE_FORMATS: 2 },
}));
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'isSecureContext', {
    value: true,
    configurable: true,
  });
  scanner.decode.mockResolvedValue({ stop: scanner.stop });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function media(value: Promise<unknown>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => value) },
  });
}
describe('vida útil de la cámara', () => {
  it('detiene la cámara incluso si llega el permiso después de cerrar', async () => {
    let resolve!: (stream: unknown) => void;
    media(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(<Scanner onDetected={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled(),
    );
    view.unmount();
    await act(async () =>
      resolve({ getTracks: () => [{ stop: scanner.trackStop }] }),
    );
    expect(scanner.trackStop).toHaveBeenCalledOnce();
    expect(scanner.decode).not.toHaveBeenCalled();
  });
  it('libera la cámara al cerrar el escáner', async () => {
    media(Promise.resolve({ getTracks: () => [{ stop: scanner.trackStop }] }));
    const view = render(<Scanner onDetected={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(scanner.decode).toHaveBeenCalled());
    view.unmount();
    expect(scanner.stop).toHaveBeenCalled();
    expect(scanner.trackStop).toHaveBeenCalled();
  });
  it('solo detecta una vez un ISBN válido', async () => {
    const detected = vi.fn();
    media(Promise.resolve({ getTracks: () => [{ stop: scanner.trackStop }] }));
    render(<Scanner onDetected={detected} onCancel={vi.fn()} />);
    await waitFor(() => expect(scanner.decode).toHaveBeenCalled());
    const callback = scanner.decode.mock.calls[0][2];
    act(() => {
      callback({ getText: () => '1234567890128' }, undefined, {
        stop: scanner.stop,
      });
      callback({ getText: () => '9788410989788' }, undefined, {
        stop: scanner.stop,
      });
      callback({ getText: () => '9788410989788' }, undefined, {
        stop: scanner.stop,
      });
    });
    expect(detected).toHaveBeenCalledExactlyOnceWith('9788410989788');
    expect(scanner.trackStop).toHaveBeenCalled();
  });
  it('ofrece la entrada por teclado cuando se deniega el permiso', async () => {
    media(Promise.reject(new DOMException('Denied', 'NotAllowedError')));
    render(<Scanner onDetected={vi.fn()} onCancel={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No tenemos permiso',
    );
    expect(
      screen.getByRole('button', { name: 'Escribir el ISBN' }),
    ).toBeDefined();
  });
});
