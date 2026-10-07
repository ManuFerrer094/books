import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpineCandidate } from './spine-detection';
import type { SpineQuad } from './spine-perspective';

export function useSpineDetection(
  source: HTMLCanvasElement | null,
  onSelect: (quad: SpineQuad) => void,
  enabled = true,
) {
  const [candidates, setCandidates] = useState<SpineCandidate[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const select = useRef(onSelect);
  select.current = onSelect;
  const cancel = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setDetecting(false);
  }, []);
  useEffect(() => {
    setCandidates([]);
    setMessage('');
    if (!source || !enabled) {
      setDetecting(false);
      return;
    }
    let active = true;
    const unavailable = () => {
      if (!active) return;
      setDetecting(false);
      setMessage(
        'No se han encontrado bordes claros. Marca las cuatro esquinas del lomo.',
      );
    };
    setDetecting(true);
    let timeout: ReturnType<typeof setTimeout>;
    try {
      const scale = Math.min(1, 512 / Math.max(source.width, source.height));
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(source.width * scale));
      small.height = Math.max(1, Math.round(source.height * scale));
      const context = small.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(source, 0, 0, small.width, small.height);
      const pixels = context.getImageData(0, 0, small.width, small.height);
      const detector = new Worker(
        new URL('./spine-detection.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = detector;
      timeout = setTimeout(() => {
        if (!active || worker.current !== detector) return;
        detector.terminate();
        worker.current = null;
        unavailable();
      }, 12000);
      timer.current = timeout;
      detector.onmessage = (
        event: MessageEvent<{ candidates: SpineCandidate[] }>,
      ) => {
        clearTimeout(timeout);
        if (!active || worker.current !== detector) return;
        const choices = event.data.candidates.map((candidate) => ({
          ...candidate,
          quad: candidate.quad.map((p) => ({
            x: (p.x * source.width) / small.width,
            y: (p.y * source.height) / small.height,
          })) as SpineQuad,
        }));
        setCandidates(choices);
        setDetecting(false);
        if (choices.length) {
          select.current(choices[0].quad);
          setMessage(
            choices.length > 1
              ? 'Hay varios posibles lomos. Elige el tuyo y revisa sus esquinas.'
              : 'Bordes detectados. Revisa las cuatro esquinas del lomo.',
          );
        } else unavailable();
        detector.terminate();
        worker.current = null;
      };
      detector.onerror = () => {
        clearTimeout(timeout);
        if (!active || worker.current !== detector) return;
        detector.terminate();
        worker.current = null;
        unavailable();
      };
      detector.postMessage(
        {
          buffer: pixels.data.buffer,
          width: small.width,
          height: small.height,
        },
        [pixels.data.buffer],
      );
    } catch {
      clearTimeout(timer.current);
      worker.current?.terminate();
      worker.current = null;
      unavailable();
    }
    return () => {
      active = false;
      clearTimeout(timeout);
      worker.current?.terminate();
      worker.current = null;
    };
  }, [source, enabled, attempt]);
  return {
    candidates,
    detecting,
    detectionMessage: message,
    detectAgain: () => setAttempt((n) => n + 1),
    cancelDetection: cancel,
  };
}
