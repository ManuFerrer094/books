import { useRef, useState, type FormEvent } from 'react';
import { Camera, Plus, ArrowLeft } from 'lucide-react';
import { api, ApiError, errorMessage } from './api';
import { normalizeIsbn } from './isbn';
import { Dialog, Feedback, StatusSelect } from './components';
import Scanner from './Scanner';
import type { Book, LibraryBook, ReadingStatus } from './types';

export default function AddBook({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (entry: LibraryBook) => void;
}) {
  const [mode, setMode] = useState<'isbn' | 'manual'>('isbn');
  const [scanning, setScanning] = useState(false);
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [publisher, setPublisher] = useState('');
  const [status, setStatus] = useState<ReadingStatus>('pending');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualSuggested, setManualSuggested] = useState(false);
  const savedBook = useRef<Book | null>(null);
  const draft = useRef('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const normalized = normalizeIsbn(isbn);
    if ((mode === 'isbn' || isbn.trim()) && !normalized) {
      setError(
        'Ese ISBN no es válido. Revisa los 10 o 13 caracteres del libro.',
      );
      return;
    }
    if (mode === 'manual' && !title.trim()) {
      setError('Escribe el título del libro.');
      return;
    }
    setBusy(true);
    setError('');
    setManualSuggested(false);
    try {
      let entry: LibraryBook;
      if (mode === 'isbn')
        entry = await api<LibraryBook>('/me/books/isbn', {
          method: 'POST',
          body: JSON.stringify({ isbn: normalized, status }),
        });
      else {
        const body = {
          title: title.trim(),
          isbn: normalized,
          authors: authors
            .split(';')
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => ({ name })),
          publisher: publisher.trim() || null,
        };
        const serialized = JSON.stringify(body);
        // If personal-library insertion fails, retry the saved catalog book without creating a duplicate.
        if (!savedBook.current || draft.current !== serialized) {
          try {
            savedBook.current = await api<Book>('/books', {
              method: 'POST',
              body: serialized,
            });
          } catch (cause) {
            if (
              !(cause instanceof ApiError) ||
              cause.status !== 409 ||
              !normalized
            )
              throw cause;
            const found = await api<{ book: Book }>(
              `/books/isbn/${normalized}`,
            );
            savedBook.current = found.book;
          }
          draft.current = serialized;
        }
        entry = await api<LibraryBook>('/me/books', {
          method: 'POST',
          body: JSON.stringify({ book_id: savedBook.current.id, status }),
        });
      }
      onAdded(entry);
    } catch (cause) {
      setError(errorMessage(cause));
      setManualSuggested(
        cause instanceof ApiError && [404, 503].includes(cause.status),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Una nueva historia." onClose={onClose} busy={busy}>
      <p className="muted dialog-intro">
        Encuentra un libro y dale un lugar en tu biblioteca.
      </p>
      {scanning ? (
        <Scanner
          onDetected={(value) => {
            setIsbn(value);
            setScanning(false);
            setError('');
          }}
          onCancel={() => setScanning(false)}
        />
      ) : (
        <>
          <div className="segmented">
            <button
              type="button"
              aria-pressed={mode === 'isbn'}
              disabled={busy}
              onClick={() => {
                setMode('isbn');
                setError('');
              }}
            >
              Con ISBN
            </button>
            <button
              type="button"
              aria-pressed={mode === 'manual'}
              disabled={busy}
              onClick={() => {
                setMode('manual');
                setError('');
              }}
            >
              A mano
            </button>
          </div>
          <form onSubmit={submit}>
            {mode === 'isbn' && (
              <button
                type="button"
                className="scan-button"
                disabled={busy}
                onClick={() => setScanning(true)}
              >
                <span className="scan-icon">
                  <Camera size={24} strokeWidth={1.5} />
                </span>
                <span>
                  <strong>Escanear el código de barras</strong>
                  <small>Con la cámara de tu dispositivo</small>
                </span>
                <Plus size={16} />
              </button>
            )}
            {mode === 'manual' && (
              <>
                <label className="field">
                  Título
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={500}
                    placeholder="¿Cómo se llama el libro?"
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  Autor o autores <span className="optional">(opcional)</span>
                  <input
                    value={authors}
                    onChange={(e) => setAuthors(e.target.value)}
                    placeholder="Separa varios autores con ;"
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  Editorial <span className="optional">(opcional)</span>
                  <input
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    maxLength={255}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            <label className="field">
              ISBN{' '}
              {mode === 'manual' && (
                <span className="optional">(opcional)</span>
              )}
              <input
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978…"
                required={mode === 'isbn'}
                maxLength={24}
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <StatusSelect value={status} onChange={setStatus} disabled={busy} />
            <Feedback error={error} />
            {manualSuggested && mode === 'isbn' && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setMode('manual');
                  setError('');
                }}
              >
                <ArrowLeft size={15} /> Añadir los datos a mano
              </button>
            )}
            <button className="button primary full" disabled={busy}>
              <Plus size={17} />
              {busy ? 'Buscando y guardando…' : 'Añadir a mi biblioteca'}
            </button>
            {busy && (
              <p className="small-note" role="status">
                Consultar los catálogos puede llevar unos segundos.
              </p>
            )}
          </form>
        </>
      )}
    </Dialog>
  );
}
