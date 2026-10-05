import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { Book, ReadingStatus } from './types';

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <BookOpen size={22} strokeWidth={1.5} />
      </span>
      <span>
        Entre páginas
        <span className="brand-caption">un hogar para tus libros</span>
      </span>
    </div>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = 'dialog-title';
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Cover({
  book,
  large = false,
}: {
  book: Book;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [book.cover_url]);
  return (
    <div
      className={`cover cover-${Math.abs(book.id) % 5} ${large ? 'cover-large' : ''}`}
    >
      {book.cover_url && !failed ? (
        <img
          src={book.cover_url}
          alt={`Portada de ${book.title}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback">
          <BookOpen size={22} strokeWidth={1} />
          <span>{book.title}</span>
          <small>
            {book.authors?.[0]?.name || 'Una historia por descubrir'}
          </small>
          <span className="cover-line" />
        </div>
      )}
    </div>
  );
}

export function StatusSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: ReadingStatus;
  onChange: (value: ReadingStatus) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Estante</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as ReadingStatus)}
        disabled={disabled}
      >
        <option value="pending">Por leer</option>
        <option value="reading">Leyendo</option>
        <option value="read">Leídos</option>
      </select>
    </div>
  );
}

export function Feedback({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="feedback error">
      {error}
    </p>
  ) : null;
}
