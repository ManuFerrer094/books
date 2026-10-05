import { useState, type FormEvent } from 'react';
import { ArrowRight, Leaf, BookOpen } from 'lucide-react';
import { supabase } from './supabase';
import { Brand, Feedback } from './components';

function authError(message: string) {
  if (/invalid login/i.test(message))
    return 'El correo o la contraseña no son correctos.';
  if (/email not confirmed/i.test(message))
    return 'Revisa tu correo y confirma tu cuenta antes de entrar.';
  if (/already registered|already been registered/i.test(message))
    return 'Ya hay una cuenta con ese correo. Prueba a iniciar sesión.';
  if (/rate limit|too many/i.test(message))
    return 'Espera un momento antes de volver a intentarlo.';
  if (/password/i.test(message))
    return 'La contraseña debe tener al menos 8 caracteres y cumplir las reglas de seguridad.';
  return 'No hemos podido conectar. Inténtalo de nuevo en un momento.';
}

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            })
          : await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: window.location.origin },
            });
      if (result.error) setError(authError(result.error.message));
      else if (mode === 'register' && !result.data.session) {
        setMessage(
          'Revisa tu correo: te hemos enviado un enlace para confirmar tu cuenta. Después podrás entrar.',
        );
        setPassword('');
      }
    } catch {
      setError(
        'No podemos conectar ahora. Comprueba tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <span className="eyebrow">
            <Leaf size={15} /> TU RINCÓN DE LECTURA
          </span>
          <h1>
            Un pequeño hogar
            <br />
            para tus historias.
          </h1>
          <p>
            Los que te esperan. Los que te acompañan.
            <br />
            Los que se quedan contigo.
          </p>
          <div className="book-illustration" aria-hidden="true">
            <div className="illustration-book book-one">
              <span>
                un capítulo
                <br />
                más
              </span>
            </div>
            <div className="illustration-book book-two">
              <BookOpen size={42} strokeWidth={1} />
              <span>
                entre
                <br />
                páginas
              </span>
            </div>
            <div className="illustration-book book-three">
              <span>sin prisa</span>
            </div>
            <div className="illustration-shelf" />
          </div>
        </div>
        <span className="auth-footnote">
          Cada libro, a su ritmo. Cada historia, en su lugar.
        </span>
      </section>
      <section className="auth-form-section">
        <div className="auth-form-wrap">
          <span className="eyebrow">PASA, ESTÁS EN CASA</span>
          <h2>
            {mode === 'login'
              ? 'Vuelve a tu biblioteca.'
              : 'Tu biblioteca empieza aquí.'}
          </h2>
          <p className="muted">
            {mode === 'login'
              ? 'Tus próximas lecturas te están esperando.'
              : 'Guarda tus libros y encuentra tu próxima lectura.'}
          </p>
          <div className="segmented" aria-label="Acceso">
            <button
              type="button"
              aria-pressed={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError('');
                setMessage('');
              }}
              disabled={busy}
            >
              Entrar
            </button>
            <button
              type="button"
              aria-pressed={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError('');
                setMessage('');
              }}
              disabled={busy}
            >
              Crear cuenta
            </button>
          </div>
          {supabase ? (
            <form onSubmit={submit}>
              <label className="field">
                Tu correo
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="hola@ejemplo.com"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="field">
                Contraseña
                <input
                  type="password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder={
                    mode === 'register'
                      ? 'Al menos 8 caracteres'
                      : 'Tu contraseña'
                  }
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              <Feedback error={error} />
              {message && (
                <p className="feedback success" role="status">
                  {message}
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy
                  ? 'Un momento…'
                  : mode === 'login'
                    ? 'Entrar en mi biblioteca'
                    : 'Crear mi biblioteca'}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <p className="feedback error" role="alert">
              La biblioteca aún no está conectada. Vuelve cuando esté lista.
            </p>
          )}
          <p className="auth-privacy">
            <Leaf size={14} /> Un espacio tranquilo, solo para tus libros.
          </p>
        </div>
      </section>
    </main>
  );
}
