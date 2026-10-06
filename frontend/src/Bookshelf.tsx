import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Move,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api, ApiError, errorMessage } from './api';
import { bookshelfRows, moveBook, orderedBooks } from './bookshelf-layout';
import Spine from './Spine';
import type { BookshelfLayout, LibraryBook } from './types';

interface Props {
  ownerId: string;
  books: LibraryBook[];
  allBooks: LibraryBook[];
  canOrganize: boolean;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onReload: () => void;
  preserveVisibleOrder?: boolean;
}
interface Drag {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  before: number | null;
}
export default function Bookshelf({
  ownerId,
  books,
  allBooks,
  canOrganize,
  onSelect,
  onAdd,
  onReload,
  preserveVisibleOrder = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const alive = useRef(false);
  const dragRef = useRef<Drag | null>(null);
  const savingRef = useRef(false);
  const focusRef = useRef<{ id: number; control: string } | null>(null);
  const [width, setWidth] = useState(600);
  const [layout, setLayout] = useState<BookshelfLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [organizing, setOrganizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<number[] | null>(null);
  const [retry, setRetry] = useState<number[] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<BookshelfLayout>(
      '/me/bookshelf',
      { signal: controller.signal },
      ownerId,
    )
      .then((next) => {
        if (!controller.signal.aborted) {
          setLayout(next);
          setDraft(null);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload, ownerId]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(64, entry.contentRect.width - 32)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [loading]);
  useEffect(() => {
    if (!canOrganize) {
      setOrganizing(false);
      dragRef.current = null;
      setDrag(null);
    }
  }, [canOrganize]);
  useEffect(() => {
    if (!saving && focusRef.current) {
      const { id, control } = focusRef.current;
      const book = container.current?.querySelector(
        `[data-shelf-book="${id}"]`,
      );
      let button = book?.querySelector<HTMLButtonElement>(
        `[data-shelf-control="${control}"]`,
      );
      if (button?.disabled)
        button = book?.querySelector<HTMLButtonElement>(
          '[data-shelf-control="grip"]',
        );
      button?.focus({ preventScroll: true });
      focusRef.current = null;
    }
  }, [saving, layout]);
  const ordered = preserveVisibleOrder
    ? books
    : orderedBooks(books, draft ?? layout?.book_ids ?? []);
  const fullOrder = orderedBooks(allBooks, draft ?? layout?.book_ids ?? []).map(
    (book) => book.book_id,
  );
  const rows = bookshelfRows(ordered, width);
  const editable = canOrganize && organizing && !!layout && !loading && !saving;
  async function save(next: number[]) {
    if (
      !layout ||
      savingRef.current ||
      next.every((id, i) => id === fullOrder[i])
    )
      return;
    savingRef.current = true;
    setDraft(next);
    setSaving(true);
    setError('');
    setNotice('');
    setRetry(null);
    try {
      const saved = await api<BookshelfLayout>(
        '/me/bookshelf',
        {
          method: 'PUT',
          body: JSON.stringify({ book_ids: next, revision: layout.revision }),
        },
        ownerId,
      );
      if (alive.current) {
        setLayout(saved);
        setDraft(null);
        setNotice('Orden guardado.');
      }
    } catch (cause) {
      if (!alive.current) return;
      setDraft(null);
      if (cause instanceof ApiError && cause.status === 409) {
        setNotice(
          'Tu biblioteca ha cambiado en otra sesión. Hemos vuelto a cargar el orden.',
        );
        setReload((value) => value + 1);
        onReload();
      } else {
        setError(
          'No hemos podido guardar el orden. Se ha recuperado la última posición guardada.',
        );
        setRetry(next);
      }
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  }
  function adjacent(id: number, direction: -1 | 1) {
    const index = fullOrder.indexOf(id);
    if (index + direction < 0 || index + direction >= fullOrder.length) return;
    focusRef.current = {
      id,
      control:
        document.activeElement?.getAttribute('data-shelf-control') || 'grip',
    };
    void save(
      moveBook(
        fullOrder,
        id,
        direction === -1
          ? fullOrder[index - 1]
          : (fullOrder[index + 2] ?? null),
      ),
    );
  }
  function start(event: PointerEvent<HTMLButtonElement>, id: number) {
    if (!editable || (event.pointerType === 'mouse' && event.button !== 0))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      before: id,
    };
    dragRef.current = next;
    setDrag(next);
    setNotice('');
  }
  function moving(event: PointerEvent<HTMLButtonElement>) {
    const previous = dragRef.current;
    if (!previous) return;
    const active =
      previous.active ||
      Math.hypot(
        event.clientX - previous.startX,
        event.clientY - previous.startY,
      ) > 6;
    let before = previous.before;
    if (active) {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const book = hit?.closest<HTMLElement>('[data-shelf-book]');
      if (book) {
        const id = Number(book.dataset.shelfBook);
        if (id !== previous.id) {
          const box = book.getBoundingClientRect();
          const index = fullOrder.indexOf(id);
          before =
            event.clientX < box.left + box.width / 2
              ? id
              : (fullOrder[index + 1] ?? null);
        }
      } else {
        const row = hit?.closest<HTMLElement>('[data-shelf-row]');
        if (row) {
          const entries = rows[Number(row.dataset.shelfRow)];
          const last = entries[entries.length - 1];
          if (last)
            before = fullOrder[fullOrder.indexOf(last.book_id) + 1] ?? null;
        }
      }
      const edge = 60;
      if (event.clientY < edge) window.scrollBy(0, -14);
      else if (event.clientY > window.innerHeight - edge)
        window.scrollBy(0, 14);
    }
    const next = {
      ...previous,
      x: event.clientX,
      y: event.clientY,
      active,
      before,
    };
    dragRef.current = next;
    setDrag(next);
  }
  function finish(cancelled = false) {
    const previous = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!cancelled && previous?.active && editable)
      void save(moveBook(fullOrder, previous.id, previous.before));
  }
  if (loading)
    return (
      <div className="bookshelf-loading" role="status">
        Preparando tu estantería…
        <div className="shelf-loading-wood" />
      </div>
    );
  if (!layout)
    return (
      <div className="empty-state" role="alert">
        <p>{error}</p>
        <button
          className="button secondary"
          onClick={() => setReload((value) => value + 1)}
        >
          <RefreshCw size={16} /> Volver a intentar
        </button>
      </div>
    );
  const dragged = drag?.active
    ? allBooks.find((entry) => entry.book_id === drag.id)
    : null;
  return (
    <div className="bookshelf-view">
      <div className="bookshelf-toolbar">
        <p>
          {organizing
            ? 'Arrastra el asa de un libro o usa las flechas para colocarlo.'
            : 'Cada lomo, una historia. Cada historia, su lugar.'}
        </p>
        <button
          className={`button ${organizing ? 'primary' : 'secondary'}`}
          disabled={!canOrganize || saving}
          aria-pressed={organizing}
          onClick={() => setOrganizing((value) => !value)}
        >
          <Move size={15} />
          {organizing ? 'Terminar de ordenar' : 'Ordenar estantería'}
        </button>
      </div>
      {!canOrganize && (
        <p className="small-note">
          Para ordenar, selecciona «Todos mis libros» y limpia la búsqueda.
        </p>
      )}
      <div className="shelf-feedback" aria-live="polite">
        {saving
          ? 'Guardando el orden…'
          : notice && (
              <>
                <Check size={14} />
                {notice}
              </>
            )}
      </div>
      {error && (
        <div className="shelf-error" role="alert">
          <p>{error}</p>
          {retry && (
            <button
              className="text-button"
              disabled={saving || !canOrganize}
              onClick={() =>
                void save(
                  orderedBooks(allBooks, retry).map((book) => book.book_id),
                )
              }
            >
              <RefreshCw size={14} /> Reintentar guardado
            </button>
          )}
        </div>
      )}
      <div
        ref={container}
        className={`wooden-bookshelf ${organizing ? 'is-organizing' : ''}`}
        aria-label="Tu estantería"
      >
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="shelf-row"
            data-shelf-row={rowIndex}
            aria-label={`Balda ${rowIndex + 1}`}
          >
            <div className="shelf-books">
              {row.map((entry) => {
                const index = fullOrder.indexOf(entry.book_id);
                return (
                  <div
                    key={entry.book_id}
                    data-shelf-book={entry.book_id}
                    className={`shelf-book ${drag?.active && drag.id === entry.book_id ? 'is-dragging' : ''} ${drag?.active && drag.before === entry.book_id && drag.id !== entry.book_id ? 'drop-before' : ''}`}
                  >
                    <button
                      className="spine-button"
                      onClick={() => onSelect(entry.book_id)}
                      disabled={saving || !!drag?.active}
                      aria-label={`Ver ${entry.book.title}`}
                      title={`${entry.book.title} · ${entry.book.authors?.map((author) => author.name).join(', ') || 'Autor sin indicar'}`}
                    >
                      <Spine entry={entry} />
                    </button>
                    {organizing && (
                      <div className="spine-controls">
                        <button
                          className="spine-grip"
                          data-shelf-control="grip"
                          aria-label={`Mover ${entry.book.title}`}
                          disabled={!editable}
                          onPointerDown={(e) => start(e, entry.book_id)}
                          onPointerMove={moving}
                          onPointerUp={() => finish()}
                          onPointerCancel={() => finish(true)}
                          onLostPointerCapture={() => finish(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') finish(true);
                            if (
                              editable &&
                              (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
                            ) {
                              e.preventDefault();
                              adjacent(
                                entry.book_id,
                                e.key === 'ArrowLeft' ? -1 : 1,
                              );
                            }
                          }}
                        >
                          <GripVertical size={17} />
                        </button>
                        <div className="spine-arrows">
                          <button
                            data-shelf-control="before"
                            disabled={!editable || index === 0}
                            aria-label={`Mover ${entry.book.title} antes`}
                            onClick={() => adjacent(entry.book_id, -1)}
                          >
                            <ArrowLeft size={12} />
                          </button>
                          <button
                            data-shelf-control="after"
                            disabled={
                              !editable || index === fullOrder.length - 1
                            }
                            aria-label={`Mover ${entry.book.title} después`}
                            onClick={() => adjacent(entry.book_id, 1)}
                          >
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {drag?.active &&
                drag.before === null &&
                rowIndex === rows.length - 1 && (
                  <span className="shelf-drop-end" />
                )}
              {!ordered.length && (
                <div className="shelf-empty">
                  <span>
                    {allBooks.length
                      ? 'No hay libros que coincidan.'
                      : 'Aquí empieza tu estantería.'}
                  </span>
                  {!allBooks.length && (
                    <button className="button secondary" onClick={onAdd}>
                      <Plus size={15} /> Añadir un libro
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="shelf-plank" aria-hidden="true" />
            <span className="shelf-number" aria-hidden="true">
              {String(rowIndex + 1).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
      {dragged && (
        <div
          className="spine-drag-preview"
          aria-hidden="true"
          style={{ left: drag!.x + 15, top: drag!.y - 90 }}
        >
          <Spine entry={dragged} />
        </div>
      )}
    </div>
  );
}
