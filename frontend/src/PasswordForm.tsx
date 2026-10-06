import { useState, type FormEvent } from 'react';
import { Feedback } from './components';
import { accountAuthError, changePassword } from './account-auth';

export default function PasswordForm({
  ownerId,
  recovery = false,
  onSaved,
  onBusy,
}: {
  ownerId: string;
  recovery?: boolean;
  onSaved: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setSaved(false);
    if (password !== repeat) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setBusy(true);
    onBusy?.(true);
    try {
      await changePassword(ownerId, password, recovery ? undefined : current);
      setCurrent('');
      setPassword('');
      setRepeat('');
      setSaved(true);
      onSaved();
    } catch (cause) {
      setError(accountAuthError(cause));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <form
      aria-label="Cambiar contraseña"
      onSubmit={(event) => void save(event)}
    >
      {!recovery && (
        <label className="field">
          Contraseña actual
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            disabled={busy}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>
      )}
      <label className="field">
        Nueva contraseña
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          disabled={busy}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="field">
        Repetir nueva contraseña
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          disabled={busy}
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
      </label>
      <Feedback error={error} />
      {saved && (
        <p className="feedback success" role="status">
          Tu contraseña se ha actualizado.
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}
