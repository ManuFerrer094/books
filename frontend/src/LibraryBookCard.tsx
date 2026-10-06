import { Handshake, Star } from 'lucide-react';
import { Cover } from './components';
import { shelves, type LibraryBook } from './types';

export default function LibraryBookCard({
  entry,
  onSelect,
  onRate,
}: {
  entry: LibraryBook;
  onSelect: (id: number) => void;
  onRate: (id: number) => void;
}) {
  return (
    <article className="book-card">
      <div className="book-cover-wrap">
        <button
          className="book-cover-button"
          onClick={() => onSelect(entry.book_id)}
          aria-label={`Ver ${entry.book.title}`}
        >
          <Cover book={entry.book} />
        </button>
        <span className={`book-status status-${entry.status}`}>
          {shelves.find((item) => item.id === entry.status)?.label}
        </span>
        <button
          className={`rating-chip ${entry.rating == null ? 'unrated' : ''}`}
          aria-label={
            entry.rating == null
              ? `Valorar ${entry.book.title}`
              : `Cambiar valoración de ${entry.book.title}: ${entry.rating} de 5 estrellas`
          }
          onClick={() => onRate(entry.book_id)}
        >
          <Star
            size={12}
            fill={
              entry.rating != null && entry.rating > 0 ? 'currentColor' : 'none'
            }
          />
          {entry.rating == null ? 'Valorar' : `${entry.rating}/5`}
        </button>
      </div>
      <h3>
        <button
          className="book-title-button"
          onClick={() => onSelect(entry.book_id)}
        >
          {entry.book.title}
        </button>
      </h3>
      <p>
        {entry.book.authors?.map((author) => author.name).join(', ') ||
          'Autor sin indicar'}
      </p>
      {entry.is_lent && (
        <span className="loan-badge">
          <Handshake size={13} />
          {entry.lent_to ? `Prestado a ${entry.lent_to}` : 'Prestado'}
        </span>
      )}
    </article>
  );
}
