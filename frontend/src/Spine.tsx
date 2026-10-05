import { useEffect, useState, type CSSProperties } from 'react';
import { spineStyle, textColor } from './bookshelf-layout';
import type { LibraryBook } from './types';
import { supabase } from './supabase';

export default function Spine({
  entry,
  imageUrl,
}: {
  entry: LibraryBook;
  imageUrl?: string | null;
}) {
  const [signed, setSigned] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const path = entry.spine?.image_path;
  useEffect(() => {
    let active = true;
    setSigned(null);
    setFailed(false);
    async function refresh() {
      if (!path || !supabase || imageUrl !== undefined) return;
      try {
        const { data, error } = await supabase.storage
          .from('book-spines')
          .createSignedUrl(path, 3600);
        if (active) {
          setSigned(error ? null : (data?.signedUrl ?? null));
          setFailed(false);
        }
      } catch {
        if (active) setSigned(null);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 50 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [path, imageUrl]);
  useEffect(() => setFailed(false), [imageUrl]);
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
