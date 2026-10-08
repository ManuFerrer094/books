import { useEffect, useRef, useState } from 'react';
import { LibrarySoundEngine, type LibraryMix } from './library-sound';
import type { SoundLayer } from '../../src/library/bookshelf-atmosphere';

/** The saved mix never implies permission to play. A trusted click creates audio. */
export function useLibrarySound(ownerId: string, mix: LibraryMix) {
  const engine = useRef<LibrarySoundEngine | null>(null);
  const latest = useRef(mix);
  latest.current = mix;
  const generation = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [solo, setSolo] = useState<SoundLayer | null>(null);
  useEffect(() => {
    setPlaying(false);
    setBusy(false);
    setError('');
    setWarning('');
    setSolo(null);
    return () => {
      generation.current++;
      const previous = engine.current;
      engine.current = null;
      if (previous) {
        previous.context.onstatechange = null;
        void previous.dispose();
      }
    };
  }, [ownerId]);
  useEffect(() => {
    engine.current?.update(mix, solo);
  }, [mix, solo]);
  function pause(fade = 0.35) {
    engine.current?.pause(fade);
    setPlaying(false);
  }
  async function toggle() {
    if (playing) {
      pause();
      return;
    }
    if (busy) return;
    const current = generation.current;
    setBusy(true);
    setError('');
    setWarning('');
    try {
      if (!engine.current) {
        if (typeof AudioContext === 'undefined')
          throw new Error(
            'Este navegador no admite sonido ambiental. Prueba con un navegador actualizado.',
          );
        engine.current = new LibrarySoundEngine(
          latest.current,
          undefined,
          () => {
            if (current === generation.current)
              setWarning(
                'Una grabación no está disponible. Su capa usa el sonido sintetizado; pausa y activa de nuevo para reintentar.',
              );
          },
        );
        const audio = engine.current;
        audio.context.onstatechange = () => {
          if (engine.current === audio && audio.context.state !== 'running')
            setPlaying(false);
        };
      }
      engine.current.update(latest.current, solo);
      await engine.current.play();
      if (current === generation.current) setPlaying(true);
    } catch (reason) {
      if (current === generation.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo activar el sonido. Vuelve a intentarlo.',
        );
        const failed = engine.current;
        engine.current = null;
        if (failed) {
          failed.context.onstatechange = null;
          void failed.dispose();
        }
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return {
    playing,
    busy,
    error,
    warning,
    solo,
    setSolo,
    toggle,
    pause,
    chime: () => engine.current?.chime(),
    page: () => engine.current?.page(),
  };
}
