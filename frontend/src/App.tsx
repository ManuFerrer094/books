import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { initializeAuth, supabase } from './supabase';
import { api, errorMessage } from './api';
import Auth from './Auth';
import LibraryView from './LibraryView';
import AddBook from './AddBook';
import BookDetails from './BookDetails';
import { Brand } from './components';
import type { LibraryBook } from './types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authError, setAuthError] = useState('');
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let sessionChanged = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      sessionChanged = true;
      setSession(next);
    });
    void initializeAuth()
      .then(async (message) => {
        const { data } = await supabase!.auth.getSession();
        if (!active) return;
        if (!sessionChanged) setSession(data.session);
        setAuthError(message);
        setAuthReady(true);
      })
      .catch(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const userId = session?.user.id;
  const activeUser = useRef(userId);
  activeUser.current = userId;
  useEffect(() => {
    setBooks([]);
    setOwner(userId || null);
    setAdding(false);
    setSelected(null);
    setToast('');
    setError('');
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<LibraryBook[]>('/me/books', { signal: controller.signal })
      .then((entries) => {
        if (!controller.signal.aborted) {
          setBooks(entries);
          setOwner(userId);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [userId, reload]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  async function logout() {
    setSigningOut(true);
    try {
      const result = await supabase!.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
    } catch {
      setToast('No hemos podido cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      setSigningOut(false);
    }
  }
  const personalBooks = owner === userId ? books : [];
  const entry = personalBooks.find((item) => item.book_id === selected);
  function upsert(next: LibraryBook) {
    if (activeUser.current !== userId) return;
    setBooks((previous) => [
      next,
      ...previous.filter((item) => item.book_id !== next.book_id),
    ]);
  }
  if (!authReady)
    return (
      <main className="opening" role="status">
        <Brand />
        <p>Abriendo tu rincón de lectura…</p>
      </main>
    );
  if (!session) return <Auth initialError={authError} />;
  return (
    <>
      <LibraryView
        key={session.user.id}
        ownerId={session.user.id}
        books={personalBooks}
        loading={loading}
        error={error}
        email={session.user.email}
        onAdd={() => setAdding(true)}
        onSelect={setSelected}
        onRetry={() => setReload((value) => value + 1)}
        onLogout={() => void logout()}
        signingOut={signingOut}
      />
      {adding && (
        <AddBook
          onClose={() => setAdding(false)}
          onAdded={(next) => {
            if (activeUser.current !== userId) return;
            const exists = personalBooks.some(
              (item) => item.book_id === next.book_id,
            );
            upsert(next);
            setAdding(false);
            setToast(
              exists
                ? 'Este libro ya tenía su lugar en tu biblioteca.'
                : 'Una nueva historia en tu biblioteca.',
            );
          }}
        />
      )}
      {entry && (
        <BookDetails
          ownerId={session.user.id}
          entry={entry}
          onClose={() => setSelected(null)}
          onUpdated={(next) => {
            if (activeUser.current !== userId) return;
            upsert(next);
            setToast('Cambios del libro guardados.');
          }}
          onRemoved={(id) => {
            if (activeUser.current !== userId) return;
            setBooks((previous) =>
              previous.filter((item) => item.book_id !== id),
            );
            setSelected(null);
            setToast('Libro retirado de tu biblioteca.');
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
