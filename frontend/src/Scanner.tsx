import { useEffect, useRef, useState } from 'react';
import { Camera, Keyboard } from 'lucide-react';
import { normalizeIsbn } from './isbn';

export default function Scanner({
  onDetected,
  onCancel,
}: {
  onDetected: (isbn: string) => void;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const detect = useRef(onDetected);
  detect.current = onDetected;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let handled = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    const stop = () => {
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error('secure');
        const [
          { BrowserMultiFormatReader },
          { BarcodeFormat, DecodeHintType },
        ] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (disposed) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
          },
        });
        if (disposed) {
          stop();
          return;
        }
        const reader = new BrowserMultiFormatReader(
          new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]]]),
        );
        controls = await reader.decodeFromStream(
          stream,
          video.current!,
          (result, _error, scannerControls) => {
            if (!result || handled || disposed) return;
            const isbn = normalizeIsbn(result.getText());
            if (!isbn) return;
            handled = true;
            scannerControls.stop();
            stop();
            detect.current(isbn);
          },
        );
        if (disposed || handled) stop();
        else setReady(true);
      } catch (cause) {
        stop();
        if (disposed) return;
        const name =
          cause && typeof cause === 'object' && 'name' in cause
            ? cause.name
            : '';
        setError(
          name === 'NotAllowedError'
            ? 'No tenemos permiso para usar la cámara. Puedes escribir el ISBN.'
            : name === 'NotFoundError'
              ? 'No encontramos una cámara en este dispositivo.'
              : 'No podemos abrir la cámara. Usa HTTPS o localhost y comprueba que otra app no esté utilizando la cámara.',
        );
      }
    }
    void start();
    return () => {
      disposed = true;
      stop();
    };
  }, []);
  return (
    <div className="scanner">
      <div className="camera-view">
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Vista de la cámara para escanear el ISBN"
        />
        <div className="scan-target" aria-hidden="true" />
        {!ready && !error && (
          <span className="camera-loading">
            <Camera size={23} /> Abriendo la cámara…
          </span>
        )}
      </div>
      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : (
        <p className="scanner-hint">
          Acerca el código de barras del libro al recuadro. Busca el que empieza
          por 978 o 979.
        </p>
      )}
      <button
        type="button"
        className="button secondary full"
        onClick={onCancel}
      >
        <Keyboard size={17} /> Escribir el ISBN
      </button>
    </div>
  );
}
