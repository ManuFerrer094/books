import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  RotateCcw,
  RotateCw,
  Save,
  X,
} from 'lucide-react';
import { api, errorMessage } from './api';
import { automaticSpine, spineColors, spineStyle } from './bookshelf-layout';
import {
  clampCrop,
  drawSpineSelection,
  initialCrop,
  prepareSpineImage,
  spinePhotoBlob,
  validateSpineFile,
  zoomCrop,
  type CropRect,
} from './spine-photo';
import { supabase } from './supabase';
import Spine from './Spine';
import SpinePhotoCropper from './SpinePhotoCropper';
import { Cover } from './components';
import type { LibraryBook, SpineAppearance } from './types';

export default function BookAppearanceEditor({
  ownerId,
  entry,
  onUpdated,
  onClose,
  onBusy,
  kind = 'spine',
}: {
  ownerId: string;
  entry: LibraryBook;
  onUpdated: (entry: LibraryBook) => void;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  kind?: 'spine' | 'cover';
}) {
  const isCover = kind === 'cover';
  const noun = isCover ? 'portada' : 'lomo';
  const article = isCover ? 'la portada' : 'el lomo';
  const bucket = isCover ? 'book-covers' : 'book-spines';
  const savedNotice = isCover ? 'Portada guardada.' : 'Lomo guardado.';
  const photoPath = (item: LibraryBook) =>
    isCover ? item.book.cover_image_path : item.spine?.image_path;
  const savedAppearance = (item: LibraryBook): SpineAppearance =>
    isCover
      ? { ...automaticSpine, image_path: item.book.cover_image_path ?? null }
      : (item.spine ?? automaticSpine);
  const [appearance, setAppearance] = useState<SpineAppearance>(
    savedAppearance(entry),
  );
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [cropping, setCropping] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ambiguousPath, setAmbiguousPath] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cropHeading = useRef<HTMLHeadingElement>(null);
  const previousTransform = useRef<{
    image: HTMLImageElement;
    rotation: number;
    source: HTMLCanvasElement;
  } | null>(null);
  const pending = useRef(false);
  const alive = useRef(false);
  const preview = { ...entry, spine: appearance };
  const style = isCover
    ? { width: 144, height: 216, color: '#f3eedf' }
    : spineStyle(preview);
  const ratio = useRef(style.width / style.height);
  ratio.current = style.width / style.height;
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
    if (!image) {
      setSource(null);
      setCrop(null);
      previousTransform.current = null;
      return;
    }
    try {
      const prepared = prepareSpineImage(image, rotation + straighten);
      const previous = previousTransform.current;
      setCrop((old) =>
        old && previous?.image === image && previous.rotation === rotation
          ? clampCrop(
              {
                ...old,
                x: old.x + (prepared.width - previous.source.width) / 2,
                y: old.y + (prepared.height - previous.source.height) / 2,
              },
              prepared,
            )
          : initialCrop(prepared, ratio.current),
      );
      setSource(prepared);
      previousTransform.current = { image, rotation, source: prepared };
      setZoom(1);
    } catch (cause) {
      setError(errorMessage(cause));
      setSource(null);
      setCrop(null);
    }
  }, [image, rotation, straighten]);
  useEffect(() => {
    if (source && crop && canvas.current) {
      try {
        drawSpineSelection(
          canvas.current,
          source,
          crop,
          style.width / style.height,
        );
      } catch (cause) {
        setError(errorMessage(cause));
        setSource(null);
      }
    }
  }, [source, crop, style.width, style.height]);
  useEffect(() => {
    if (image && cropping) {
      cropHeading.current?.scrollIntoView({
        block: 'start',
        behavior: 'instant',
      });
      cropHeading.current?.focus({ preventScroll: true });
    }
  }, [image, cropping]);
  function changeCrop(next: CropRect) {
    setCrop(next);
    setZoom(1);
    setNotice('');
  }
  function selectFile(next?: File) {
    if (!next) return;
    try {
      validateSpineFile(next);
      setError('');
      setNotice('');
      setImage(null);
      setFile(next);
      setSource(null);
      setCrop(null);
      setCropping(true);
      setRotation(0);
      setStraighten(0);
      setZoom(1);
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
        await supabase!.storage.from(bucket).remove([path]);
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
      if (photoPath(current) === path) {
        if (alive.current) {
          setAppearance(savedAppearance(current));
          setFile(null);
          setNotice(savedNotice);
          setError('');
          onUpdated(current);
        }
      } else {
        await cleanup(path);
        if (alive.current)
          setError(`No se ha guardado ${article}. Puedes volver a intentarlo.`);
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
    if (
      !alive.current ||
      pending.current ||
      ambiguousPath ||
      (file && (!source || !crop || cropping))
    )
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
        drawSpineSelection(
          canvas.current!,
          source!,
          crop!,
          style.width / style.height,
        );
        const blob = await spinePhotoBlob(canvas.current!);
        const {
          data: { session },
        } = await supabase!.auth.getSession();
        if (!session || session.user.id !== ownerId || !alive.current)
          throw new Error(`Vuelve a entrar para guardar ${article}.`);
        const path = `${session.user.id}/${entry.book_id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase!.storage
          .from(bucket)
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
        `/me/books/${entry.book_id}/${kind}`,
        {
          method: 'PATCH',
          body: JSON.stringify(
            isCover ? { image_path: next.image_path } : next,
          ),
        },
        ownerId,
      );
      if (alive.current) {
        setAppearance(savedAppearance(saved));
        setFile(null);
        setNotice(savedNotice);
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
    <section
      className={`spine-editor ${isCover ? 'cover-editor' : ''}`}
      aria-label={isCover ? 'Personalizar portada' : 'Personalizar lomo'}
    >
      <div className="spine-editor-heading">
        <h3>
          {isCover
            ? 'La portada de tu ejemplar.'
            : 'Tu libro, tal como lo recuerdas.'}
        </h3>
        <button
          type="button"
          className="icon-button"
          disabled={busy || checking}
          aria-label={
            isCover ? 'Cerrar edición de portada' : 'Cerrar personalización'
          }
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy || checking || !!ambiguousPath}>
          {file && (
            <section
              className="spine-photo-workspace"
              aria-label={`Recortar foto ${isCover ? 'de la portada' : 'del lomo'}`}
            >
              <div className="spine-photo-heading">
                <h4 ref={cropHeading} tabIndex={-1}>
                  {cropping
                    ? `Encuadra solo ${article}`
                    : 'Tu recorte está listo'}
                </h4>
                <p>
                  {cropping
                    ? 'Arrastra el marco y sus bordes para dejar fuera la mano y el fondo. Verás el resultado al instante.'
                    : 'Esta es la foto que se guardará. Puedes volver a recortarla antes de guardar.'}
                </p>
              </div>
              <div
                className={`spine-photo-layout ${cropping ? '' : 'crop-confirmed'}`}
              >
                {cropping ? (
                  source && crop ? (
                    <SpinePhotoCropper
                      source={source}
                      crop={crop}
                      onChange={changeCrop}
                      disabled={busy || checking || !!ambiguousPath}
                      subject={noun}
                    />
                  ) : (
                    <div className="spine-crop-stage" role="status">
                      Preparando tu foto…
                    </div>
                  )
                ) : (
                  <div className="spine-photo-summary">
                    <Check size={20} />
                    <p>Solo se usará el área que has seleccionado.</p>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setCropping(true);
                        setNotice('');
                      }}
                    >
                      Volver a recortar
                    </button>
                  </div>
                )}
                <div className="spine-preview">
                  <canvas
                    ref={canvas}
                    className={isCover ? 'photo-cover' : 'photo-spine'}
                    style={
                      isCover
                        ? undefined
                        : { width: style.width, height: style.height }
                    }
                    aria-label={`Vista previa del recorte ${isCover ? 'de la portada' : 'del lomo'}`}
                  />
                  <span>Así quedará</span>
                </div>
              </div>
              {cropping && source && crop && (
                <>
                  <div className="spine-photo-transform">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setRotation((old) => (old + 90) % 360);
                        setStraighten(0);
                      }}
                    >
                      <RotateCw size={15} /> Girar 90°
                    </button>
                    <label className="field">
                      Enderezar <span>{straighten}°</span>
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        step="0.5"
                        value={straighten}
                        onChange={(e) => setStraighten(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <details className="spine-crop-controls">
                    <summary>Ajustes precisos del recorte</summary>
                    <label className="field">
                      Ampliar
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="0.05"
                        value={zoom}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setCrop(zoomCrop(crop, next / zoom, source));
                          setZoom(next);
                        }}
                      />
                    </label>
                    <label className="field">
                      Desplazar horizontalmente
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.01"
                        value={
                          source.width === crop.width
                            ? 0
                            : (crop.x * 2) / (source.width - crop.width) - 1
                        }
                        onChange={(e) =>
                          setCrop({
                            ...crop,
                            x:
                              ((source.width - crop.width) *
                                (Number(e.target.value) + 1)) /
                              2,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Desplazar verticalmente
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.01"
                        value={
                          source.height === crop.height
                            ? 0
                            : (crop.y * 2) / (source.height - crop.height) - 1
                        }
                        onChange={(e) =>
                          setCrop({
                            ...crop,
                            y:
                              ((source.height - crop.height) *
                                (Number(e.target.value) + 1)) /
                              2,
                          })
                        }
                      />
                    </label>
                  </details>
                  <div className="spine-crop-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        changeCrop(
                          initialCrop(source, style.width / style.height),
                        )
                      }
                    >
                      <RotateCcw size={14} /> Reiniciar marco
                    </button>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => {
                        setCropping(false);
                        setNotice(
                          `Recorte listo. Guarda ${article} cuando quieras.`,
                        );
                      }}
                    >
                      <Check size={16} /> Usar este recorte
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          <div className={`spine-editor-layout ${file ? 'has-photo' : ''}`}>
            {!file && (
              <div className="spine-preview">
                {isCover ? (
                  <Cover
                    book={{
                      ...entry.book,
                      cover_image_path: appearance.image_path,
                    }}
                  />
                ) : (
                  <Spine entry={preview} />
                )}
                <span>Vista previa</span>
              </div>
            )}
            <div className="spine-settings">
              {!isCover && (
                <>
                  <label className="field">
                    Color del lomo
                    <input
                      type="color"
                      value={style.color}
                      onChange={(e) =>
                        setAppearance((old) => ({
                          ...old,
                          color: e.target.value,
                        }))
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
                        onClick={() =>
                          setAppearance((old) => ({ ...old, color }))
                        }
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
                </>
              )}
              <div className="book-photo-inputs">
                <label className="button secondary spine-upload">
                  <ImagePlus size={16} />{' '}
                  {`Elegir foto ${isCover ? 'de la portada' : 'del lomo'}`}
                  <input
                    ref={input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={`Foto ${isCover ? 'de la portada' : 'del lomo'}`}
                    onChange={(e) => {
                      selectFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                <label className="button secondary spine-upload spine-camera">
                  <Camera size={16} /> Hacer foto
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    aria-label={`Hacer foto ${isCover ? 'de la portada' : 'del lomo'}`}
                    onChange={(e) => {
                      selectFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <p className="small-note">
                JPEG, PNG o WebP · hasta 5 MB. Encuadra solo {article} de tu
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
              <RotateCcw size={14} />{' '}
              {isCover
                ? 'Restaurar portada original'
                : 'Restaurar aspecto automático'}
            </button>
            <button
              className="button primary"
              disabled={busy || (!!file && (!source || !crop || cropping))}
            >
              <Save size={15} />
              {busy ? 'Guardando…' : `Guardar ${noun}`}
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
          {busy ? `Guardando tu ${noun}…` : notice}
        </p>
      </form>
    </section>
  );
}
