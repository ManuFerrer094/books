import { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Leaf,
  LogOut,
  ArrowUpRight,
  Coffee,
  Library,
  Bookmark,
  Check,
  RefreshCw,
  Handshake,
} from 'lucide-react';
import { Brand, Cover } from './components';
import { shelves, type LibraryBook } from './types';
import { visibleBooks } from './library';
import Bookshelf from './Bookshelf';

interface Props {
  ownerId: string;
  books: LibraryBook[];
  loading: boolean;
  error: string;
  email?: string;
  onAdd: () => void;
  onSelect: (id: number) => void;
  onRetry: () => void;
  onLogout: () => void;
  signingOut: boolean;
}
const shelfIcons = {
  all: Library,
  pending: Bookmark,
  reading: BookOpen,
  read: Check,
  lent: Handshake,
};
export default function LibraryView({
  ownerId,
  books,
  loading,
  error,
  email,
  onAdd,
  onSelect,
  onRetry,
  onLogout,
  signingOut,
}: Props) {
  const [shelf, setShelf] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'covers' | 'shelf'>('covers');
  const visible = visibleBooks(books, shelf, query, sort);
  const current = shelves.find((item) => item.id === shelf)!;
  const reading = books.filter((entry) => entry.status === 'reading');
  return (
    <div className="app-shell">
      <header className="header">
        <Brand />
        <div className="user-menu">
          <span className="user-email" title={email}>
            {email}
          </span>
          <button
            className="icon-button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={onLogout}
            disabled={signingOut}
          >
            <LogOut size={19} strokeWidth={1.5} />
          </button>
        </div>
      </header>
      <main className="library-main">
        <section className="welcome">
          <div>
            <span className="eyebrow">
              <Leaf size={14} /> UN CAPÍTULO PARA TI
            </span>
            <h1>
              Tu pequeño refugio
              <br className="mobile-break" /> de historias.
            </h1>
            <p className="muted">
              Haz sitio a tus libros. Y a todo lo que te hacen sentir.
            </p>
          </div>
          <button className="button primary" onClick={onAdd} disabled={loading}>
            <Plus size={18} /> Añadir un libro
          </button>
        </section>
        <section className="library-layout">
          <aside className="shelves">
            <p className="eyebrow shelf-heading">MIS ESTANTES</p>
            <nav aria-label="Estantes de tu biblioteca">
              {shelves.map((item) => {
                const Icon = shelfIcons[item.id];
                const count =
                  item.id === 'all'
                    ? books.length
                    : books.filter((entry) =>
                        item.id === 'lent'
                          ? entry.is_lent
                          : entry.status === item.id,
                      ).length;
                return (
                  <button
                    key={item.id}
                    className={`shelf-button ${shelf === item.id ? 'active' : ''}`}
                    aria-current={shelf === item.id ? 'page' : undefined}
                    onClick={() => setShelf(item.id)}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                    <span>{item.label}</span>
                    <span className="shelf-count">{count}</span>
                  </button>
                );
              })}
            </nav>
            <div className="reading-note">
              <Coffee size={22} strokeWidth={1.2} />
              <p>
                {reading.length
                  ? 'Un ratito para seguir leyendo.'
                  : 'Un libro. Un té. Un ratito para ti.'}
              </p>
              <small>
                {reading.length
                  ? `${reading.length} ${reading.length === 1 ? 'historia te acompaña' : 'historias te acompañan'} ahora.`
                  : 'No hay prisa por llenar los estantes.'}
              </small>
              {reading[0] && (
                <button
                  className="text-button"
                  onClick={() => onSelect(reading[0].book_id)}
                >
                  Seguir con mi lectura <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          </aside>
          <section className="collection" aria-labelledby="collection-title">
            <div className="collection-heading">
              <div>
                <h2 id="collection-title">{current.label}</h2>
                <p>{current.description}</p>
              </div>
              <span className="collection-count">
                {visible.length} {visible.length === 1 ? 'libro' : 'libros'}
              </span>
            </div>
            <div
              className="library-view-switch segmented"
              aria-label="Vista de la biblioteca"
            >
              <button
                aria-pressed={view === 'covers'}
                onClick={() => setView('covers')}
              >
                Portadas
              </button>
              <button
                aria-pressed={view === 'shelf'}
                onClick={() => setView('shelf')}
              >
                Estantería
              </button>
            </div>
            <div className="collection-tools">
              <label className="search-field">
                <Search size={17} strokeWidth={1.5} />
                <span className="sr-only">Buscar por título, autor o ISBN</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Busca una historia, un autor…"
                />
              </label>
              {view === 'covers' && (
                <label className="sort-field">
                  <span className="sr-only">Ordenar libros</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recent">Más recientes</option>
                    <option value="title">Por título</option>
                    <option value="author">Por autor</option>
                  </select>
                </label>
              )}
            </div>
            {error ? (
              <div className="empty-state" role="alert">
                <BookOpen size={30} strokeWidth={1} />
                <h3>No podemos abrir tu biblioteca.</h3>
                <p>{error}</p>
                <button className="button secondary" onClick={onRetry}>
                  <RefreshCw size={16} /> Volver a intentar
                </button>
              </div>
            ) : loading ? (
              <div
                className="book-grid"
                role="status"
                aria-label="Cargando tu biblioteca"
              >
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-card">
                    <div />
                    <span />
                    <small />
                  </div>
                ))}
              </div>
            ) : view === 'shelf' ? (
              <Bookshelf
                ownerId={ownerId}
                books={visible}
                allBooks={books}
                canOrganize={shelf === 'all' && !query.trim()}
                onSelect={onSelect}
                onAdd={onAdd}
                onReload={onRetry}
              />
            ) : visible.length ? (
              <div className="book-grid">
                {visible.map((entry) => (
                  <button
                    className="book-card"
                    key={entry.book_id}
                    onClick={() => onSelect(entry.book_id)}
                    aria-label={`Ver ${entry.book.title}`}
                  >
                    <div className="book-cover-wrap">
                      <Cover book={entry.book} />
                      <span className={`book-status status-${entry.status}`}>
                        {
                          shelves.find((item) => item.id === entry.status)
                            ?.label
                        }
                      </span>
                    </div>
                    <h3>{entry.book.title}</h3>
                    <p>
                      {entry.book.authors
                        ?.map((author) => author.name)
                        .join(', ') || 'Autor sin indicar'}
                    </p>
                    {entry.is_lent && (
                      <span className="loan-badge">
                        <Handshake size={13} />
                        {entry.lent_to
                          ? `Prestado a ${entry.lent_to}`
                          : 'Prestado'}
                      </span>
                    )}
                    {entry.rating != null && (
                      <span
                        className="card-rating"
                        aria-label={`Valoración personal: ${entry.rating} de 5 estrellas`}
                      >
                        <span aria-hidden="true">
                          {'★'.repeat(entry.rating)}
                          {'☆'.repeat(5 - entry.rating)}
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <BookOpen size={34} strokeWidth={1.1} />
                  <Leaf size={17} />
                </div>
                <span className="eyebrow">HAY SITIO PARA UNA HISTORIA</span>
                <h3>
                  {query
                    ? 'Esta historia aún no asoma por aquí.'
                    : books.length
                      ? 'Este estante está esperando.'
                      : 'Tu biblioteca empieza con un libro.'}
                </h3>
                <p>
                  {query
                    ? 'Prueba con otro título, autor o ISBN.'
                    : books.length
                      ? 'Abre un libro y cambia su estante cuando quieras.'
                      : 'Escanea su código de barras, escribe el ISBN o añádelo a mano. Nosotros le guardamos un sitio.'}
                </p>
                {query ? (
                  <button
                    className="button secondary"
                    onClick={() => setQuery('')}
                  >
                    Limpiar búsqueda
                  </button>
                ) : (
                  <button className="button secondary" onClick={onAdd}>
                    <Plus size={17} />
                    {books.length
                      ? 'Añadir un libro'
                      : 'Añadir mi primer libro'}
                  </button>
                )}
              </div>
            )}
          </section>
        </section>
      </main>
      <footer className="footer">
        <Leaf size={13} />
        <span>Una página cada vez.</span>
        <span className="footer-brand">Entre páginas</span>
      </footer>
    </div>
  );
}
