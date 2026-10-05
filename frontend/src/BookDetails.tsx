import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api, errorMessage } from './api';
import { Cover, Dialog, Feedback, StatusSelect } from './components';
import type { LibraryBook, ReadingStatus } from './types';
import SpineEditor from './SpineEditor';

export default function BookDetails({
  ownerId,
  entry,
  onClose,
  onUpdated,
  onRemoved,
}: {
  ownerId: string;
  entry: LibraryBook;
  onClose: () => void;
  onUpdated: (entry: LibraryBook) => void;
  onRemoved: (id: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [editingSpine, setEditingSpine] = useState(false);
  const book = entry.book;
  async function changeStatus(status: ReadingStatus) {
    setBusy(true);
    setError('');
    try {
      onUpdated(
        await api<LibraryBook>(`/me/books/${entry.book_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(`/me/books/${entry.book_id}`, { method: 'DELETE' });
      onRemoved(entry.book_id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const metadata = [
    ['Editorial', book.publisher],
    ['Publicación', book.publication_date?.slice(0, 10)],
    ['Páginas', book.pages],
    ['Idioma', book.language],
    ['ISBN', book.isbn],
  ].filter(([, value]) => value != null && value !== '');
  return (
    <Dialog
      title="Un lugar para esta historia."
      onClose={onClose}
      busy={busy}
      wide
    >
      <div className="book-details">
        <Cover book={book} large />
        <div className="book-details-content">
          <h3>{book.title}</h3>
          <p className="muted">
            {book.authors?.map((author) => author.name).join(' · ') ||
              'Autor sin indicar'}
          </p>
          <StatusSelect
            value={entry.status}
            onChange={(value) => void changeStatus(value)}
            disabled={busy}
          />
          {metadata.length > 0 && (
            <dl className="metadata">
              {metadata.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="small-note">
            En tu biblioteca desde el{' '}
            {new Intl.DateTimeFormat('es', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date(entry.added_at))}
            .
          </p>
        </div>
      </div>
      {editingSpine ? (
        <SpineEditor
          key={entry.book_id}
          ownerId={ownerId}
          entry={entry}
          onUpdated={onUpdated}
          onClose={() => setEditingSpine(false)}
          onBusy={setBusy}
        />
      ) : (
        <button
          className="button secondary personalize-spine"
          disabled={busy}
          onClick={() => setEditingSpine(true)}
        >
          Personalizar lomo
        </button>
      )}
      <Feedback error={error} />
      <div className="details-footer">
        {confirm ? (
          <div className="remove-confirm">
            <p>¿Quitamos este libro de tu biblioteca?</p>
            <div className="button-row">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Conservarlo
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? 'Quitando…' : 'Sí, quitar'}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="text-button remove"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={15} /> Quitar de mi biblioteca
          </button>
        )}
      </div>
    </Dialog>
  );
}
