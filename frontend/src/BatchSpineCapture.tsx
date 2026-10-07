import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Dialog } from './components';
import { api, errorMessage } from './api';
import { supabase } from './supabase';
import SpinePhotoCropper from './SpinePhotoCropper';
import {
  clampCrop,
  drawSpineSelection,
  initialCrop,
  prepareSpineImage,
  spinePhotoBlob,
  validateSpineFile,
  type CropRect,
} from './spine-photo';
import { spineStyle } from './bookshelf-layout';
import type { LibraryBook } from './types';

interface Slot {
  id: string;
  crop: CropRect;
  book_id: number | null;
  saved: boolean;
  path?: string;
  error: string;
}
function CropPreview({
  source,
  slot,
  books,
}: {
  source: HTMLCanvasElement;
  slot: Slot;
  books: LibraryBook[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const book = books.find((book) => book.book_id === slot.book_id);
  useEffect(() => {
    const size = book
      ? spineStyle(book)
      : { width: slot.crop.width, height: slot.crop.height };
    if (canvas.current)
      drawSpineSelection(
        canvas.current,
        source,
        slot.crop,
        Math.max(0.08, Math.min(0.6, size.width / size.height)),
      );
  }, [source, slot.crop, book]);
  return (
    <canvas
      className="batch-spine-preview"
      ref={canvas}
      aria-label="Vista previa del recorte"
    />
  );
}
export default function BatchSpineCapture({
  ownerId,
  books,
  onClose,
  onUpdated,
}: {
  ownerId: string;
  books: LibraryBook[];
  onClose: () => void;
  onUpdated: (book: LibraryBook) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null),
    [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(0),
    [straighten, setStraighten] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]),
    [active, setActive] = useState('');
  const [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    working = useRef(false),
    loadId = useRef(0);
  const activeSlot = slots.find((slot) => slot.id === active);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ++loadId.current;
    };
  }, []);
  useEffect(() => {
    if (!image) return;
    try {
      const next = prepareSpineImage(image, rotation + straighten);
      setSource(next);
      // Transformed selections remain inside the new image; previews expose the exact result.
      setSlots((old) =>
        old.map((slot) => ({ ...slot, crop: clampCrop(slot.crop, next) })),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [image, rotation, straighten]);
  async function selectFile(file?: File) {
    if (!file || working.current) return;
    try {
      validateSpineFile(file);
      const request = ++loadId.current,
        url = URL.createObjectURL(file);
      try {
        const photo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () =>
            reject(new Error('No se puede leer esta fotografía.'));
          img.src = url;
        });
        if (!alive.current || request !== loadId.current) return;
        if (
          !photo.naturalWidth ||
          photo.naturalWidth * photo.naturalHeight > 40000000
        )
          throw new Error('Esta foto es demasiado grande. Elige otra.');
        setImage(photo);
        setSlots([]);
        setActive('');
        setRotation(0);
        setStraighten(0);
        setError('');
        setNotice('Marca un lomo, asígnalo a un libro y añade el siguiente.');
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (cause) {
      if (alive.current) setError(errorMessage(cause));
    }
  }
  function addSlot() {
    if (!source || slots.length >= 40) return;
    const id = crypto.randomUUID(),
      crop = initialCrop(source, 0.2);
    const last = slots.at(-1);
    if (last) {
      crop.x = Math.min(
        source.width - crop.width,
        last.crop.x + last.crop.width,
      );
      crop.y = Math.min(last.crop.y, source.height - crop.height);
    }
    setSlots((old) => [
      ...old,
      { id, crop, book_id: null, saved: false, error: '' },
    ]);
    setActive(id);
    setQuery('');
  }
  const update = (id: string, patch: Partial<Slot>) =>
    setSlots((old) =>
      old.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    );
  async function saveAll() {
    if (
      !source ||
      working.current ||
      !slots.length ||
      slots.some((slot) => !slot.book_id)
    )
      return;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('Guardando los recortes…');
    let failures = 0,
      savedCount = slots.filter((slot) => slot.saved).length;
    try {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      if (!session || session.user.id !== ownerId)
        throw new Error('La cuenta ha cambiado. Vuelve a abrir tu biblioteca.');
      for (const slot of slots) {
        if (slot.saved || !alive.current) continue;
        const book = books.find((book) => book.book_id === slot.book_id);
        if (!book) {
          update(slot.id, { error: 'Este libro ya no está en tu biblioteca.' });
          failures++;
          continue;
        }
        let path = slot.path;
        try {
          // Resolve any ambiguous PATCH before uploading another image.
          if (path) {
            const current = await api<LibraryBook>(
              `/me/books/${book.book_id}`,
              {},
              ownerId,
            );
            if (current.spine?.image_path === path) {
              update(slot.id, { saved: true, error: '' });
              onUpdated(current);
              savedCount++;
              continue;
            }
          } else {
            const canvas = document.createElement('canvas'),
              style = spineStyle(book);
            drawSpineSelection(
              canvas,
              source,
              slot.crop,
              style.width / style.height,
            );
            const blob = await spinePhotoBlob(canvas);
            path = `${ownerId}/${book.book_id}/${crypto.randomUUID()}.jpg`;
            const { error: uploadError } = await supabase!.storage
              .from('book-spines')
              .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
            if (uploadError) {
              await supabase!.storage.from('book-spines').remove([path]);
              path = undefined;
              throw new Error('No se ha podido subir este recorte.');
            }
            update(slot.id, { path });
          }
          const saved = await api<LibraryBook>(
            `/me/books/${book.book_id}/spine`,
            { method: 'PATCH', body: JSON.stringify({ image_path: path }) },
            ownerId,
          );
          if (!alive.current) return;
          update(slot.id, { saved: true, path, error: '' });
          onUpdated(saved);
          savedCount++;
        } catch (cause) {
          if (!alive.current) return;
          failures++;
          update(slot.id, { error: errorMessage(cause), path });
        }
      }
      if (alive.current)
        setNotice(
          failures
            ? `${savedCount} lomos guardados. Puedes reintentar los ${failures} pendientes sin repetir los demás.`
            : `${savedCount} lomos guardados. Tu fila ya está en la biblioteca.`,
        );
    } catch (cause) {
      if (alive.current) setError(errorMessage(cause));
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    if (
      slots.some((slot) => !slot.saved) &&
      !window.confirm(
        'Cerrar descarta los recortes pendientes. Los lomos ya guardados se conservan.',
      )
    )
      return;
    // Ambiguous uploaded paths are retained: they may already be referenced by the server.
    onClose();
  }
  return (
    <Dialog title="Una foto, muchos lomos" onClose={close} busy={busy} wide>
      <p className="dialog-intro">
        Fotografía una fila de frente. Marca cada lomo y elige a qué libro
        pertenece; solo guardaremos sus recortes.
      </p>
      <input
        hidden
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          void selectFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        hidden
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          void selectFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="studio-button-row">
        <button
          className="button secondary"
          disabled={busy || slots.some((s) => !!s.path)}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={15} /> Elegir foto
        </button>
        <button
          className="button secondary"
          disabled={busy || slots.some((s) => !!s.path)}
          onClick={() => camera.current?.click()}
        >
          <Camera size={15} /> Hacer foto
        </button>
      </div>
      {source && (
        <>
          <div className="batch-workspace">
            <div>
              <div className="studio-button-row">
                <button
                  className="text-button"
                  disabled={busy || slots.length > 0}
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                >
                  <RotateCw size={15} /> Girar 90°
                </button>
                <label className="field">
                  Enderezar antes de marcar
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="0.5"
                    value={straighten}
                    disabled={busy || slots.length > 0}
                    onChange={(e) => setStraighten(Number(e.target.value))}
                  />
                </label>
              </div>
              {activeSlot ? (
                <SpinePhotoCropper
                  source={source}
                  crop={activeSlot.crop}
                  disabled={busy || activeSlot.saved || !!activeSlot.path}
                  onChange={(crop) =>
                    update(activeSlot.id, { crop, error: '' })
                  }
                />
              ) : (
                <img
                  className="batch-source-image"
                  src={source.toDataURL('image/jpeg', 0.7)}
                  alt="Fila de libros para recortar"
                />
              )}
              <button
                className="button secondary"
                disabled={busy || slots.length >= 40}
                onClick={addSlot}
              >
                <Plus size={15} /> Marcar otro lomo
              </button>
            </div>
            <div className="batch-slots">
              {slots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`batch-slot ${active === slot.id ? 'active' : ''}`}
                >
                  <button
                    className="batch-slot-select"
                    aria-pressed={active === slot.id}
                    aria-label={`Editar recorte ${index + 1}`}
                    disabled={busy}
                    onClick={() => {
                      setActive(slot.id);
                      setQuery('');
                    }}
                  >
                    <CropPreview source={source} slot={slot} books={books} />
                    <span>
                      {books.find((book) => book.book_id === slot.book_id)?.book
                        .title || `Recorte ${index + 1}`}
                    </span>
                    {slot.saved && <Check size={16} />}
                  </button>
                  {!slot.saved && !slot.path && (
                    <button
                      className="icon-button"
                      aria-label={`Eliminar recorte ${index + 1}`}
                      disabled={busy}
                      onClick={() => {
                        setSlots((old) => old.filter((s) => s.id !== slot.id));
                        if (active === slot.id)
                          setActive(
                            slots.find((s) => s.id !== slot.id)?.id ?? '',
                          );
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  {slot.error && <p role="alert">{slot.error}</p>}
                </div>
              ))}
            </div>
          </div>
          {activeSlot && (
            <section className="batch-assignment">
              <label className="field">
                Buscar libro para este recorte
                <input
                  type="search"
                  value={query}
                  disabled={busy || activeSlot.saved || !!activeSlot.path}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Título o autor"
                />
              </label>
              <div className="batch-book-options">
                {books
                  .filter((book) =>
                    `${book.book.title} ${book.book.authors.map((a) => a.name).join(' ')}`
                      .toLocaleLowerCase('es')
                      .includes(query.toLocaleLowerCase('es')),
                  )
                  .map((book) => (
                    <button
                      key={book.book_id}
                      className="text-button"
                      aria-pressed={activeSlot.book_id === book.book_id}
                      disabled={
                        busy ||
                        activeSlot.saved ||
                        !!activeSlot.path ||
                        slots.some(
                          (slot) =>
                            slot.id !== activeSlot.id &&
                            slot.book_id === book.book_id,
                        )
                      }
                      onClick={() =>
                        update(activeSlot.id, { book_id: book.book_id })
                      }
                    >
                      {activeSlot.book_id === book.book_id && (
                        <Check size={14} />
                      )}{' '}
                      {book.book.title}
                    </button>
                  ))}
              </div>
            </section>
          )}
          <button
            className="button primary"
            disabled={
              busy ||
              !slots.length ||
              slots.some((slot) => !slot.book_id) ||
              slots.every((slot) => slot.saved)
            }
            onClick={() => void saveAll()}
          >
            {busy
              ? 'Guardando…'
              : slots.some((slot) => slot.error)
                ? 'Reintentar lomos pendientes'
                : 'Guardar todos los lomos'}
          </button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="small-note" role="status">
          {notice}
        </p>
      )}
    </Dialog>
  );
}
