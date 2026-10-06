import { useId, useState, type FormEvent } from 'react';
import { Handshake, Star } from 'lucide-react';
import { api, errorMessage } from './api';
import { Feedback } from './components';
import type { LibraryBook } from './types';

export default function BookPersonalDetails({
  ownerId,
  entry,
  disabled,
  onUpdated,
  onBusy,
}: {
  ownerId: string;
  entry: LibraryBook;
  disabled: boolean;
  onUpdated: (entry: LibraryBook) => void;
  onBusy: (busy: boolean) => void;
}) {
  const id = useId();
  const [isLent, setIsLent] = useState(entry.is_lent ?? false);
  const [lentTo, setLentTo] = useState(entry.lent_to ?? '');
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [rating, setRating] = useState<number | null>(entry.rating ?? null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty =
    isLent !== (entry.is_lent ?? false) ||
    lentTo !== (entry.lent_to ?? '') ||
    notes !== (entry.notes ?? '') ||
    rating !== (entry.rating ?? null);

  function reset(next = entry) {
    setIsLent(next.is_lent ?? false);
    setLentTo(next.lent_to ?? '');
    setNotes(next.notes ?? '');
    setRating(next.rating ?? null);
    setError('');
    setSaved(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || disabled) return;
    const patch: Record<string, unknown> = {};
    // Only send edited fields so a notes/rating save keeps the reading status
    // and any unrelated changes made in another tab.
    if (
      isLent !== (entry.is_lent ?? false) ||
      lentTo !== (entry.lent_to ?? '')
    ) {
      patch.is_lent = isLent;
      patch.lent_to = isLent ? lentTo.trim() || null : null;
    }
    if (notes !== (entry.notes ?? '')) patch.notes = notes.trim() || null;
    if (rating !== (entry.rating ?? null)) patch.rating = rating;
    onBusy(true);
    setError('');
    setSaved(false);
    try {
      const next = await api<LibraryBook>(
        `/me/books/${entry.book_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patch),
        },
        ownerId,
      );
      reset(next);
      onUpdated(next);
      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      onBusy(false);
    }
  }
  return (
    <form
      className="personal-details"
      aria-label="Datos personales del libro"
      onSubmit={(event) => void save(event)}
      onChange={() => setSaved(false)}
    >
      <h4>Tu experiencia con este libro</h4>
      <p className="muted">
        El préstamo, las anotaciones y la valoración son privados.
      </p>
      <label className="loan-toggle" htmlFor={`${id}-lent`}>
        <input
          id={`${id}-lent`}
          type="checkbox"
          checked={isLent}
          disabled={disabled}
          onChange={(event) => {
            setIsLent(event.target.checked);
            if (!event.target.checked) setLentTo('');
          }}
        />
        <Handshake size={18} /> Libro prestado
      </label>
      {isLent && (
        <label className="field" htmlFor={`${id}-borrower`}>
          Prestado a
          <input
            id={`${id}-borrower`}
            value={lentTo}
            maxLength={200}
            placeholder="Nombre de la persona (opcional)"
            disabled={disabled}
            onChange={(event) => setLentTo(event.target.value)}
          />
        </label>
      )}
      <fieldset className="personal-rating" disabled={disabled}>
        <legend>Tu valoración</legend>
        <div className="rating-options">
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={`rating-option ${value > 0 && rating != null && value <= rating ? 'filled' : ''}`}
            >
              <input
                className="rating-input"
                type="radio"
                name={`${id}-rating`}
                value={value}
                checked={rating === value}
                aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                onChange={() => setRating(value)}
              />
              {value === 0 ? (
                <span>0</span>
              ) : (
                <Star
                  size={25}
                  fill={
                    rating != null && value <= rating ? 'currentColor' : 'none'
                  }
                  aria-hidden="true"
                />
              )}
            </label>
          ))}
        </div>
        <div className="rating-caption">
          <span aria-live="polite">
            {rating == null ? 'Sin valorar' : `${rating} de 5 estrellas`}
          </span>
          {rating != null && (
            <button
              type="button"
              className="text-button"
              disabled={disabled}
              onClick={() => {
                setRating(null);
                setSaved(false);
              }}
            >
              Quitar valoración
            </button>
          )}
        </div>
      </fieldset>
      <label className="field" htmlFor={`${id}-notes`}>
        Mis anotaciones
        <textarea
          id={`${id}-notes`}
          rows={5}
          maxLength={10000}
          value={notes}
          disabled={disabled}
          placeholder="Ideas, frases o recuerdos que quieras guardar…"
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <Feedback error={error} />
      {saved && (
        <p className="feedback success" role="status">
          Tus datos personales se han guardado.
        </p>
      )}
      <div className="button-row">
        <button className="button primary" disabled={disabled || !dirty}>
          Guardar datos personales
        </button>
        {dirty && (
          <button
            className="button secondary"
            type="button"
            disabled={disabled}
            onClick={() => reset()}
          >
            Descartar cambios
          </button>
        )}
      </div>
    </form>
  );
}
