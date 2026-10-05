import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, RotateCcw, Save, X } from 'lucide-react';
import { api, errorMessage } from './api';
import { automaticSpine, spineColors, spineStyle } from './bookshelf-layout';
import {
  drawSpinePhoto,
  spinePhotoBlob,
  validateSpineFile,
} from './spine-photo';
import { supabase } from './supabase';
import Spine from './Spine';
import type { LibraryBook, SpineAppearance } from './types';

export default function SpineEditor({
  ownerId,
  entry,
  onUpdated,
  onClose,
  onBusy,
}: {
  ownerId: string;
  entry: LibraryBook;
  onUpdated: (entry: LibraryBook) => void;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [appearance, setAppearance] = useState<SpineAppearance>(
    entry.spine ?? automaticSpine,
  );
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ambiguousPath, setAmbiguousPath] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const alive = useRef(false);
  const preview = { ...entry, spine: appearance };
  const style = spineStyle(preview);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setImage(null);
      return;
    }
    let active = true;
    const url = URL.createObjectURL(file);
    const photo = new Image();
    photo.onload = () => {
      if (!active) return;
      // Avoid enormous decoded images and impossible crops.
      if (
        !photo.naturalWidth ||
        !photo.naturalHeight ||
        photo.naturalWidth * photo.naturalHeight > 40000000
      ) {
        setError(
          'Esta imagen es demasiado grande o no se puede leer. Elige otra foto.',
        );
        setFile(null);
        return;
      }
      setImage(photo);
    };
    photo.onerror = () => {
      if (active) {
        setError('No podemos leer esta foto. Elige otra imagen.');
        setFile(null);
      }
    };
    photo.src = url;
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    if (image && canvas.current) {
      try {
        drawSpinePhoto(
          canvas.current,
          image,
          style.width / style.height,
          zoom,
          x,
          y,
        );
      } catch (cause) {
        setError(errorMessage(cause));
        setImage(null);
      }
    }
  }, [image, style.width, style.height, zoom, x, y]);
  function selectFile(next?: File) {
    if (!next) return;
    try {
      validateSpineFile(next);
      setError('');
      setNotice('');
      setImage(null);
      setFile(next);
      setZoom(1);
      setX(0);
      setY(0);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  async function cleanup(path: string) {
    try {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      if (session?.user.id === ownerId)
        await supabase!.storage.from('book-spines').remove([path]);
    } catch {
      /* A failed cleanup never hides the save result. */
    }
  }
  async function checkPending(path: string) {
    // A timed-out PATCH may already have committed. Never delete a potentially active photo.
    try {
      const current = await api<LibraryBook>(
        `/me/books/${entry.book_id}`,
        {},
        ownerId,
      );
      if (current.spine?.image_path === path) {
        if (alive.current) {
          setAppearance(current.spine);
          setFile(null);
          setNotice('Lomo guardado.');
          setError('');
          onUpdated(current);
        }
      } else {
        await cleanup(path);
        if (alive.current)
          setError('No se ha guardado el lomo. Puedes volver a intentarlo.');
      }
      if (alive.current) setAmbiguousPath(null);
    } catch (cause) {
      if (cause instanceof Error && 'status' in cause && cause.status === 404) {
        await cleanup(path);
        if (alive.current) {
          setAmbiguousPath(null);
          setError('Este libro ya no está en tu biblioteca.');
        }
        return;
      }
      if (alive.current) {
        setAmbiguousPath(path);
        setError(
          'No podemos confirmar si se guardó la foto. Comprueba el guardado antes de volver a intentarlo.',
        );
      }
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!alive.current || pending.current || ambiguousPath || (file && !image))
      return;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setNotice('');
    let uploaded: string | null = null;
    let patchStarted = false;
    try {
      const next = { ...appearance };
      if (file) {
        const blob = await spinePhotoBlob(canvas.current!);
        const {
          data: { session },
        } = await supabase!.auth.getSession();
        if (!session || session.user.id !== ownerId || !alive.current)
          throw new Error('Vuelve a entrar para guardar el lomo.');
        const path = `${session.user.id}/${entry.book_id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase!.storage
          .from('book-spines')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) {
          await cleanup(path);
          throw new Error('No hemos podido subir la foto. Inténtalo de nuevo.');
        }
        uploaded = path;
        next.image_path = path;
      }
      if (!alive.current) {
        if (uploaded) await cleanup(uploaded);
        return;
      }
      patchStarted = true;
      const saved = await api<LibraryBook>(
        `/me/books/${entry.book_id}/spine`,
        { method: 'PATCH', body: JSON.stringify(next) },
        ownerId,
      );
      if (alive.current) {
        setAppearance(saved.spine ?? automaticSpine);
        setFile(null);
        setNotice('Lomo guardado.');
        onUpdated(saved);
      }
    } catch (cause) {
      if (uploaded && patchStarted) await checkPending(uploaded);
      else {
        if (uploaded) await cleanup(uploaded);
        if (alive.current) setError(errorMessage(cause));
      }
    } finally {
      pending.current = false;
      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <section className="spine-editor" aria-label="Personalizar lomo">
      <div className="spine-editor-heading">
        <h3>Tu libro, tal como lo recuerdas.</h3>
        <button
          type="button"
          className="icon-button"
          disabled={busy || checking}
          aria-label="Cerrar personalización"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy || checking || !!ambiguousPath}>
          <div className="spine-editor-layout">
            <div className="spine-preview">
              {file ? (
                <canvas
                  ref={canvas}
                  className="photo-spine"
                  style={{ width: style.width, height: style.height }}
                  aria-label="Vista previa del recorte del lomo"
                />
              ) : (
                <Spine entry={preview} />
              )}
              <span>Vista previa</span>
            </div>
            <div className="spine-settings">
              <label className="field">
                Color del lomo
                <input
                  type="color"
                  value={style.color}
                  onChange={(e) =>
                    setAppearance((old) => ({ ...old, color: e.target.value }))
                  }
                />
              </label>
              <div className="spine-swatches" aria-label="Colores del lomo">
                {spineColors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={`Color ${color}`}
                    aria-pressed={style.color === color}
                    style={{ background: color }}
                    onClick={() => setAppearance((old) => ({ ...old, color }))}
                  />
                ))}
              </div>
              <label className="field">
                Grosor <span>{style.width} px</span>
                <input
                  type="range"
                  min="28"
                  max="64"
                  value={style.width}
                  onChange={(e) =>
                    setAppearance((old) => ({
                      ...old,
                      width: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                Altura <span>{style.height} px</span>
                <input
                  type="range"
                  min="160"
                  max="240"
                  value={style.height}
                  onChange={(e) =>
                    setAppearance((old) => ({
                      ...old,
                      height: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="button secondary spine-upload">
                <Camera size={16} /> Elegir foto del lomo
                <input
                  ref={input}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Foto del lomo"
                  onChange={(e) => {
                    selectFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="small-note">
                JPEG, PNG o WebP · hasta 5 MB. Encuadra solo el lomo de tu
                ejemplar.
              </p>
              {(file || appearance.image_path) && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setFile(null);
                    setAppearance((old) => ({ ...old, image_path: null }));
                  }}
                >
                  Quitar foto
                </button>
              )}
            </div>
            {file && (
              <div className="spine-crop-controls">
                <p>
                  Ajusta la foto hasta que el lomo ocupe toda la vista previa.
                </p>
                <label className="field">
                  Ampliar
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Desplazar horizontalmente
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={x}
                    onChange={(e) => setX(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Desplazar verticalmente
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={y}
                    onChange={(e) => setY(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
          <div className="spine-editor-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAppearance({ ...automaticSpine });
                setFile(null);
                setError('');
                setNotice('');
              }}
            >
              <RotateCcw size={14} /> Restaurar aspecto automático
            </button>
            <button
              className="button primary"
              disabled={busy || (!!file && !image)}
            >
              <Save size={15} />
              {busy ? 'Guardando…' : 'Guardar lomo'}
            </button>
          </div>
        </fieldset>
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        {ambiguousPath && (
          <button
            type="button"
            className="button secondary"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              onBusy(true);
              await checkPending(ambiguousPath);
              if (alive.current) {
                setChecking(false);
                onBusy(false);
              }
            }}
          >
            Comprobar guardado
          </button>
        )}
        <p className="spine-save-status" role="status">
          {busy ? 'Guardando tu lomo…' : notice}
        </p>
      </form>
    </section>
  );
}
