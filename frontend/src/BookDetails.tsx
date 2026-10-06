import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api, errorMessage } from './api';
import { Cover, Dialog, Feedback, StatusSelect } from './components';
import type { LibraryBook, ReadingStatus } from './types';
import BookMetadataEditor from './BookMetadataEditor';
import BookPersonalDetails from './BookPersonalDetails';

export default function BookDetails({
  ownerId,
  entry,
  onClose,
  onUpdated,
  onRemoved,
  focusRating = false,
}: {
  ownerId: string;
  entry: LibraryBook;
  onClose: () => void;
  onUpdated: (entry: LibraryBook) => void;
  onRemoved: (id: number) => void;
  focusRating?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [editingMetadata, setEditingMetadata] = useState(false);
  const book = entry.book;
  async function changeStatus(status: ReadingStatus) {
    setBusy(true);
    setError('');
    try {
      onUpdated(
        await api<LibraryBook>(
          `/me/books/${entry.book_id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          },
          ownerId,
        ),
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
      await api(`/me/books/${entry.book_id}`, { method: 'DELETE' }, ownerId);
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
      title={
        editingMetadata ? 'Editar mi libro' : 'Un lugar para esta historia.'
      }
      onClose={onClose}
      busy={busy}
      wide
    >
      {!editingMetadata && (
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
              disabled={busy || editingMetadata}
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
      )}
      <div hidden={editingMetadata}>
        <BookPersonalDetails
          key={entry.book_id}
          ownerId={ownerId}
          entry={entry}
          disabled={busy}
          onUpdated={onUpdated}
          onBusy={setBusy}
          focusRating={focusRating}
        />
      </div>
      {editingMetadata ? (
        <BookMetadataEditor
          key={entry.book_id}
          ownerId={ownerId}
          entry={entry}
          onUpdated={onUpdated}
          onClose={() => setEditingMetadata(false)}
          onBusy={setBusy}
        />
      ) : (
        <button
          className="button secondary personalize-spine"
          disabled={busy}
          onClick={() => {
            setError('');
            setConfirm(false);
            setEditingMetadata(true);
          }}
        >
          <Pencil size={15} /> Editar mi libro
        </button>
      )}
      <Feedback error={error} />
      {!editingMetadata && (
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
      )}
    </Dialog>
  );
}
