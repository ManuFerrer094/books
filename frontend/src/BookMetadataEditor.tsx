import { lazy, Suspense, useState, type FormEvent } from 'react';
import { api, errorMessage } from './api';
import { Feedback } from './components';
import type { Book, LibraryBook } from './types';
const BookAppearanceEditor = lazy(() => import('./BookAppearanceEditor'));

type Metadata = Pick<
  Book,
  | 'title'
  | 'authors'
  | 'isbn'
  | 'publisher'
  | 'publication_date'
  | 'pages'
  | 'language'
>;

export default function BookMetadataEditor({
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
  const book = entry.book;
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(
    book.authors.map((author) => author.name),
  );
  const [isbn, setIsbn] = useState(book.isbn ?? '');
  const [publisher, setPublisher] = useState(book.publisher ?? '');
  const [date, setDate] = useState(book.publication_date?.slice(0, 10) ?? '');
  const [pages, setPages] = useState(book.pages?.toString() ?? '');
  const [language, setLanguage] = useState(book.language ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [mode, setMode] = useState<'data' | 'cover' | 'spine'>('data');
  const [visited, setVisited] = useState({ cover: false, spine: false });
  const [photoBusy, setPhotoBusy] = useState(false);

  async function save(reset = false) {
    if (busy || photoBusy) return;
    const next: Metadata = {
      title: title.trim(),
      authors: authors
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name })),
      isbn: isbn.trim() || null,
      publisher: publisher.trim() || null,
      publication_date: date || null,
      pages: pages === '' ? null : Number(pages),
      language: language.trim() || null,
    };
    if (!reset && !next.title) {
      setError('Escribe el título del libro.');
      return;
    }
    // Save only edited fields; untouched fields continue following the catalog.
    const previous: Metadata = {
      title: book.title,
      authors: book.authors.map(({ name }) => ({ name })),
      isbn: book.isbn ?? null,
      publisher: book.publisher ?? null,
      publication_date: book.publication_date?.slice(0, 10) ?? null,
      pages: book.pages ?? null,
      language: book.language ?? null,
    };
    const patch = Object.fromEntries(
      (Object.keys(next) as (keyof Metadata)[])
        .filter(
          (key) => JSON.stringify(next[key]) !== JSON.stringify(previous[key]),
        )
        .map((key) => [key, next[key]]),
    );
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const saved = await api<LibraryBook>(
        `/me/books/${entry.book_id}/metadata`,
        {
          method: reset ? 'DELETE' : 'PATCH',
          ...(reset ? {} : { body: JSON.stringify(patch) }),
        },
        ownerId,
      );
      onUpdated(saved);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void save();
  }

  return (
    <section className="metadata-editor" aria-label="Editar mi libro">
      <p className="small-note">
        Estos cambios se guardan solo en tu biblioteca.
      </p>
      <div className="book-editor-navigation" aria-label="Opciones de edición">
        {(
          [
            ['data', 'Datos del libro'],
            ['cover', 'Portada'],
            ['spine', 'Personalizar lomo'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`button ${mode === value ? 'primary' : 'secondary'}`}
            aria-pressed={mode === value}
            disabled={busy || photoBusy}
            onClick={() => {
              setMode(value);
              if (value !== 'data')
                setVisited((old) => ({ ...old, [value]: true }));
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} hidden={mode !== 'data'}>
        <fieldset disabled={busy}>
          <label className="field">
            Título
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={500}
            />
          </label>
          <div className="field">
            <span>Autor o autores</span>
            {authors.map((name, index) => (
              <div className="author-editor-row" key={index}>
                <input
                  aria-label={`Autor ${index + 1}`}
                  value={name}
                  maxLength={255}
                  onChange={(event) =>
                    setAuthors(
                      authors.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Quitar autor ${index + 1}`}
                  onClick={() =>
                    setAuthors(authors.filter((_, i) => i !== index))
                  }
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() => setAuthors([...authors, ''])}
            >
              Añadir autor
            </button>
          </div>
          <div className="metadata-editor-grid">
            <label className="field">
              Editorial
              <input
                value={publisher}
                maxLength={255}
                onChange={(event) => setPublisher(event.target.value)}
              />
            </label>
            <label className="field">
              Fecha de publicación
              <input
                type="date"
                value={date}
                min="0001-01-01"
                max="9999-12-31"
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="field">
              Páginas
              <input
                type="number"
                min={1}
                max={2147483647}
                step={1}
                value={pages}
                onChange={(event) => setPages(event.target.value)}
              />
            </label>
            <label className="field">
              Idioma
              <input
                value={language}
                maxLength={50}
                onChange={(event) => setLanguage(event.target.value)}
              />
            </label>
            <label className="field">
              ISBN
              <input
                value={isbn}
                maxLength={20}
                onChange={(event) => setIsbn(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <Feedback error={error} />
        <div className="button-row">
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar edición
          </button>
        </div>
        {entry.customized &&
          (confirmReset ? (
            <div className="remove-confirm">
              <p>
                ¿Restaurar todos los datos originales del catálogo? Se quitarán
                tus cambios de la ficha.
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirmReset(false)}
                >
                  Conservar mis cambios
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Sí, restaurar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
            >
              Restaurar datos del catálogo
            </button>
          ))}
      </form>
      {(['cover', 'spine'] as const).map(
        (kind) =>
          visited[kind] && (
            <div key={kind} hidden={mode !== kind}>
              <Suspense
                fallback={
                  <p className="small-note" role="status">
                    Abriendo el editor de fotos…
                  </p>
                }
              >
                <BookAppearanceEditor
                  ownerId={ownerId}
                  entry={entry}
                  kind={kind}
                  onUpdated={onUpdated}
                  onClose={() => setMode('data')}
                  onBusy={(value) => {
                    setPhotoBusy(value);
                    onBusy(value);
                  }}
                />
              </Suspense>
            </div>
          ),
      )}
    </section>
  );
}
