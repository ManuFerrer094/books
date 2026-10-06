import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Heart,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, errorMessage } from './api';
import { Cover, Dialog, Feedback } from './components';
import { searchText } from './library';
import type { Book, CatalogPage, WishlistBook } from './types';

export default function CatalogView({
  mode,
  ownerId,
  wishlist,
  wishlistLoading,
  wishlistError,
  onRetryWishlist,
  onAddedWish,
  onRemovedWish,
  onExplore,
}: {
  mode: 'catalog' | 'wishlist';
  ownerId: string;
  wishlist: WishlistBook[];
  wishlistLoading: boolean;
  wishlistError: string;
  onRetryWishlist: () => void;
  onAddedWish: (entry: WishlistBook) => void;
  onRemovedWish: (id: number) => void;
  onExplore: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<CatalogPage | null>(null);
  const [loading, setLoading] = useState(mode === 'catalog');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Book | null>(null);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (mode !== 'catalog') return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setCatalog(null);
    const params = new URLSearchParams({
      query: filter,
      page: String(page),
      page_size: '24',
    });
    void api<CatalogPage>(
      `/catalog?${params}`,
      { signal: controller.signal },
      ownerId,
    )
      .then((result) => {
        if (!controller.signal.aborted) setCatalog(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [mode, ownerId, filter, page, retry]);
  const wishes = new Set(wishlist.map((entry) => entry.book_id));
  const visibleWishes = wishlist.filter(({ book }) =>
    searchText(
      `${book.title} ${book.authors.map((author) => author.name).join(' ')} ${book.isbn ?? ''}`,
    ).includes(searchText(filter.trim())),
  );
  const books =
    mode === 'catalog'
      ? (catalog?.books ?? [])
      : visibleWishes.map((entry) => entry.book);
  const pending = mode === 'catalog' ? loading : wishlistLoading;
  const loadError = mode === 'catalog' ? error : wishlistError;
  async function toggleWish(book: Book) {
    if (busyId != null) return;
    const removing = wishes.has(book.id);
    setBusyId(book.id);
    setActionError('');
    setNotice('');
    try {
      if (removing) {
        await api(`/me/wishlist/${book.id}`, { method: 'DELETE' }, ownerId);
        onRemovedWish(book.id);
      } else {
        const entry = await api<WishlistBook>(
          '/me/wishlist',
          { method: 'POST', body: JSON.stringify({ book_id: book.id }) },
          ownerId,
        );
        onAddedWish(entry);
      }
      if (alive.current)
        setNotice(
          removing
            ? 'Libro retirado de tu lista de deseos.'
            : 'Libro guardado en tu lista de deseos.',
        );
    } catch (cause) {
      if (alive.current) setActionError(errorMessage(cause));
    } finally {
      if (alive.current) setBusyId(null);
    }
  }
  function wishButton(book: Book) {
    const wished = wishes.has(book.id);
    return (
      <button
        className={`button ${wished ? 'secondary' : 'primary'} wish-action`}
        disabled={busyId != null || wishlistLoading || !!wishlistError}
        aria-label={`${wished ? 'Quitar' : 'Guardar'} deseo: ${book.title}`}
        onClick={() => void toggleWish(book)}
      >
        <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
        {busyId === book.id
          ? 'Un momento…'
          : wished
            ? 'Quitar de deseos'
            : 'Guardar deseo'}
      </button>
    );
  }
  return (
    <div className="catalog-view">
      <form
        className="collection-tools"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter(query.trim());
          setPage(1);
        }}
      >
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">
            Buscar en{' '}
            {mode === 'catalog' ? 'el catálogo' : 'la lista de deseos'}
          </span>
          <input
            type="search"
            value={query}
            maxLength={200}
            placeholder="Busca un título, autor o ISBN…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button className="button secondary" type="submit">
          Buscar
        </button>
      </form>
      {mode === 'catalog' && (
        <p className="small-note">
          {catalog
            ? `${catalog.total} libros en el catálogo`
            : 'Fichas compartidas de la plataforma.'}
        </p>
      )}
      {mode === 'catalog' && wishlistError && (
        <div className="shelf-error">
          <p>No podemos cargar tu lista de deseos.</p>
          <button className="text-button" onClick={onRetryWishlist}>
            Recargar lista de deseos
          </button>
        </div>
      )}
      <Feedback error={actionError} />
      {notice && (
        <p className="feedback success" role="status">
          {notice}
        </p>
      )}
      {loadError ? (
        <div className="empty-state" role="alert">
          <BookOpen size={30} />
          <h3>
            No podemos abrir{' '}
            {mode === 'catalog' ? 'el catálogo' : 'tu lista de deseos'}.
          </h3>
          <p>{loadError}</p>
          <button
            className="button secondary"
            onClick={
              mode === 'catalog'
                ? () => setRetry((value) => value + 1)
                : onRetryWishlist
            }
          >
            <RefreshCw size={16} /> Volver a intentar
          </button>
        </div>
      ) : pending ? (
        <p role="status" className="catalog-loading">
          Cargando {mode === 'catalog' ? 'el catálogo' : 'tus deseos'}…
        </p>
      ) : books.length ? (
        <div className="book-grid">
          {books.map((book) => (
            <article className="book-card" key={book.id}>
              <div className="book-cover-wrap">
                <button
                  className="book-cover-button"
                  aria-label={`Ver ${book.title}`}
                  onClick={() => {
                    setSelected(book);
                    setActionError('');
                  }}
                >
                  <Cover book={book} />
                </button>
              </div>
              <h3>
                <button
                  className="book-title-button"
                  onClick={() => {
                    setSelected(book);
                    setActionError('');
                  }}
                >
                  {book.title}
                </button>
              </h3>
              <p>
                {book.authors.map((author) => author.name).join(', ') ||
                  'Autor sin indicar'}
              </p>
              {wishButton(book)}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Heart size={30} />
          <h3>
            {filter
              ? 'No encontramos esa historia.'
              : mode === 'wishlist'
                ? 'Tu lista de deseos empieza aquí.'
                : 'El catálogo está esperando nuevas historias.'}
          </h3>
          <p>
            {filter
              ? 'Prueba con otro título, autor o ISBN.'
              : 'Explora las historias de la plataforma y guarda las que te gustaría leer.'}
          </p>
          {filter ? (
            <button
              className="button secondary"
              onClick={() => {
                setQuery('');
                setFilter('');
                setPage(1);
              }}
            >
              Limpiar búsqueda
            </button>
          ) : (
            mode === 'wishlist' && (
              <button className="button secondary" onClick={onExplore}>
                Explorar catálogo
              </button>
            )
          )}
        </div>
      )}
      {mode === 'catalog' &&
        !pending &&
        !loadError &&
        (catalog?.total ?? 0) > 24 && (
          <nav className="catalog-pagination" aria-label="Páginas del catálogo">
            <button
              className="button secondary"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <span>
              Página {page} de {Math.ceil((catalog?.total ?? 0) / 24)}
            </span>
            <button
              className="button secondary"
              disabled={page * 24 >= (catalog?.total ?? 0)}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </nav>
        )}
      {selected && (
        <Dialog
          title="Una historia por descubrir."
          onClose={() => {
            setSelected(null);
            setActionError('');
          }}
          busy={busyId != null}
          wide
        >
          <div className="book-details">
            <Cover book={selected} large />
            <div className="book-details-content">
              <h3>{selected.title}</h3>
              <p className="muted">
                {selected.authors.map((author) => author.name).join(' · ') ||
                  'Autor sin indicar'}
              </p>
              <dl className="metadata">
                {[
                  ['Editorial', selected.publisher],
                  ['Publicación', selected.publication_date?.slice(0, 10)],
                  ['Páginas', selected.pages],
                  ['Idioma', selected.language],
                  ['ISBN', selected.isbn],
                ]
                  .filter(([, value]) => value != null && value !== '')
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
          <div className="catalog-detail-actions">
            {wishButton(selected)}
            <Feedback error={actionError} />
            {notice && (
              <p role="status" className="feedback success">
                {notice}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
