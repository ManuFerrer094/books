import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { api, ApiError, errorMessage } from './api';
import { Dialog, Feedback } from './components';
import PasswordForm from './PasswordForm';

export default function AccountSettings({
  ownerId,
  email,
  onClose,
  onDeleted,
}: {
  ownerId: string;
  email?: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function download() {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/me/account/export', {}, ownerId);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'entre-paginas.json';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Tu copia de datos está lista para descargar.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (busy || confirmation !== 'ELIMINAR' || !password) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(
        '/me/account',
        { method: 'DELETE', body: JSON.stringify({ password, confirmation }) },
        ownerId,
      );
      onDeleted();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? 'Comprueba tu contraseña actual. Si la sesión ha caducado, vuelve a entrar.'
          : cause instanceof ApiError && cause.status === 429
            ? errorMessage(cause)
            : 'No hemos podido completar la eliminación. Puede haberse eliminado alguna foto; vuelve a intentarlo para terminar.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Mi cuenta" onClose={onClose} busy={busy}>
      <p className="muted account-email">{email}</p>
      <section
        className="account-section"
        aria-labelledby="account-password-title"
      >
        <h3 id="account-password-title">Cambiar contraseña</h3>
        <fieldset className="account-fieldset" disabled={busy}>
          <PasswordForm
            ownerId={ownerId}
            onBusy={setBusy}
            onSaved={() => {
              setError('');
              setMessage('');
            }}
          />
        </fieldset>
      </section>
      <section
        className="account-section"
        aria-labelledby="account-export-title"
      >
        <h3 id="account-export-title">Una copia de tus datos</h3>
        <p className="muted">
          Descarga tus libros, anotaciones, estrellas, préstamos, deseos y orden
          de estantería en un archivo JSON. Las fotografías no se incluyen en el
          archivo.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void download()}
        >
          <Download size={16} /> Exportar mis datos
        </button>
      </section>
      <section
        className="account-section account-danger"
        aria-labelledby="account-delete-title"
      >
        <h3 id="account-delete-title">Eliminar mi cuenta</h3>
        <p className="muted">
          Se eliminarán tu cuenta, biblioteca, anotaciones, valoraciones,
          préstamos, deseos y fotos personales. Esta acción es permanente. Las
          fichas del catálogo compartido seguirán disponibles.
        </p>
        {deleting ? (
          <form
            aria-label="Eliminar mi cuenta"
            onSubmit={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            <label className="field">
              Contraseña actual para eliminar la cuenta
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="field">
              Escribe ELIMINAR para confirmar
              <input
                autoComplete="off"
                required
                disabled={busy}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setDeleting(false);
                  setPassword('');
                  setConfirmation('');
                  setError('');
                }}
              >
                Conservar mi cuenta
              </button>
              <button
                className="button danger"
                disabled={busy || confirmation !== 'ELIMINAR' || !password}
              >
                {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </form>
        ) : (
          <button
            className="button danger"
            disabled={busy}
            onClick={() => {
              setDeleting(true);
              setError('');
              setMessage('');
            }}
          >
            <Trash2 size={16} /> Eliminar mi cuenta
          </button>
        )}
      </section>
      <Feedback error={error} />
      {message && (
        <p role="status" className="feedback success">
          {message}
        </p>
      )}
    </Dialog>
  );
}
