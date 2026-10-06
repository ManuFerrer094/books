import { useEffect, useState, type CSSProperties } from 'react';
import { spineStyle, textColor } from './bookshelf-layout';
import type { LibraryBook } from './types';
import { useBookPhoto } from './useBookPhoto';

export default function Spine({
  entry,
  imageUrl,
}: {
  entry: LibraryBook;
  imageUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const path = entry.spine?.image_path;
  const signed = useBookPhoto(
    'book-spines',
    imageUrl === undefined ? path : null,
  );
  useEffect(() => setFailed(false), [path, signed, imageUrl]);
  const style = spineStyle(entry);
  const photo = imageUrl !== undefined ? imageUrl : signed;
  return (
    <span
      className={`book-spine spine-pattern-${Math.abs(entry.book_id) % 4}`}
      style={
        {
          '--spine-color': style.color,
          '--spine-ink': textColor(style.color),
          width: style.width,
          height: style.height,
        } as CSSProperties
      }
    >
      {photo && !failed ? (
        <img
          src={photo}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <span className="spine-cap" aria-hidden="true" />
          <span className="spine-lettering">
            <strong>{entry.book.title}</strong>
            <small>
              {entry.book.authors?.map((author) => author.name).join(' · ') ||
                'Autor sin indicar'}
            </small>
          </span>
          <span className="spine-publisher" aria-hidden="true">
            {entry.book.publisher?.slice(0, 2).toLocaleUpperCase('es') || 'EP'}
          </span>
        </>
      )}
    </span>
  );
}
