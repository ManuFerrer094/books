import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cloneDesign,
  designOrder,
  migrateDesign,
  reconcileDesign,
  refreshBookSizes,
  validateDesign,
  stableJson,
  type BookshelfDesign,
} from '../../src/library/bookshelf-design';
import { api, ApiError, errorMessage } from './api';
import type { BookshelfLayout, LibraryBook } from './types';

export function useBookshelfStudio(ownerId: string, books: LibraryBook[]) {
  const [design, setDesign] = useState<BookshelfDesign | null>(null);
  const [remote, setRemote] = useState<BookshelfLayout | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loadRetry, setLoadRetry] = useState(0);
  const state = useRef({
    design: null as BookshelfDesign | null,
    saved: '',
    revision: 0,
    dirty: false,
    saving: false,
    blocked: false,
  });
  const library = useRef(books);
  library.current = books;
  const undo = useRef<BookshelfDesign[]>([]),
    redo = useRef<BookshelfDesign[]>([]);
  const lastAction = useRef({ name: '', time: 0 });
  const alive = useRef(false);
  const knownMembership = useRef('');
  const syncingMembership = useRef(false);
  const membership = books
    .map((book) => book.book_id)
    .sort((a, b) => a - b)
    .join(',');
  const key = `entre-paginas-studio-draft:${ownerId}`;
  const keepDraft = useCallback(
    (next: BookshelfDesign) => {
      try {
        sessionStorage.setItem(
          key,
          stableJson({ design: next, revision: state.current.revision }),
        );
      } catch {
        /* Editing still works when storage is disabled. */
      }
    },
    [key],
  );
  const applyLocal = useCallback(
    (next: BookshelfDesign) => {
      state.current.design = next;
      state.current.dirty = stableJson(next) !== state.current.saved;
      setDesign(next);
      if (!state.current.blocked) setError('');
      setStatus(state.current.dirty ? 'Cambios pendientes…' : 'Todo guardado');
      if (state.current.dirty) keepDraft(next);
    },
    [keepDraft],
  );
  const commit = useCallback(
    (next: BookshelfDesign, action = '') => {
      const previous = state.current.design;
      if (!previous || stableJson(previous) === stableJson(next)) return;
      if (
        !action ||
        lastAction.current.name !== action ||
        Date.now() - lastAction.current.time > 1000
      ) {
        undo.current = [...undo.current.slice(-59), cloneDesign(previous)];
      }
      lastAction.current = { name: action, time: Date.now() };
      redo.current = [];
      setHistoryVersion((v) => v + 1);
      applyLocal(next);
    },
    [applyLocal],
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    state.current = {
      design: null,
      saved: '',
      revision: 0,
      dirty: false,
      saving: false,
      blocked: false,
    };
    undo.current = [];
    redo.current = [];
    setDesign(null);
    setRemote(null);
    setLoading(true);
    setError('');
    void api<BookshelfLayout>(
      '/me/bookshelf',
      { signal: controller.signal },
      ownerId,
    )
      .then((layout) => {
        if (controller.signal.aborted) return;
        const byId = new Map(
          library.current.map((book) => [book.book_id, book]),
        );
        const ids = library.current.map((book) => book.book_id);
        const saved = layout.design
          ? reconcileDesign(layout.design, ids)
          : migrateDesign(
              layout.book_ids
                .map((id) => byId.get(id))
                .filter((b): b is LibraryBook => !!b),
            );
        let local = saved;
        let pending: { design: BookshelfDesign; revision: number } | null =
          null;
        try {
          pending = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        } catch {}
        if (pending?.design?.version === 1) {
          try {
            const candidate = reconcileDesign(pending.design, ids);
            validateDesign(candidate, ids);
            local = candidate;
          } catch {
            pending = null;
            try {
              sessionStorage.removeItem(key);
            } catch {}
          }
        }
        state.current.design = local;
        state.current.saved = stableJson(saved);
        state.current.revision = layout.revision;
        knownMembership.current = [...ids].sort((a, b) => a - b).join(',');
        state.current.dirty = stableJson(local) !== state.current.saved;
        if (state.current.dirty && pending?.revision !== layout.revision) {
          state.current.blocked = true;
          setRemote({ ...layout, design: saved });
        }
        setDesign(local);
        setStatus(
          state.current.dirty ? 'Borrador recuperado' : 'Todo guardado',
        );
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [ownerId, key, loadRetry]);
  useEffect(() => {
    if (
      !design ||
      membership === knownMembership.current ||
      state.current.saving
    )
      return;
    knownMembership.current = membership;
    const controller = new AbortController();
    syncingMembership.current = true;
    void api<BookshelfLayout>(
      '/me/bookshelf',
      { signal: controller.signal },
      ownerId,
    )
      .then((layout) => {
        if (controller.signal.aborted || !state.current.design) return;
        const ids = library.current.map((book) => book.book_id);
        const saved = layout.design
          ? reconcileDesign(layout.design, ids)
          : migrateDesign(library.current);
        const expected = reconcileDesign(JSON.parse(state.current.saved), ids);
        knownMembership.current = [...ids].sort((a, b) => a - b).join(',');
        if (layout.revision < state.current.revision || state.current.blocked)
          return;
        // A known add/remove changes the revision without changing the room.
        // Only adopt it automatically when all other saved placements still match.
        if (stableJson(saved) === stableJson(expected)) {
          state.current.revision = layout.revision;
          state.current.saved = stableJson(saved);
          state.current.dirty =
            stableJson(state.current.design) !== state.current.saved;
          if (state.current.dirty) keepDraft(state.current.design);
          else {
            try {
              sessionStorage.removeItem(key);
            } catch {}
          }
          setStatus(
            state.current.dirty ? 'Cambios pendientes…' : 'Todo guardado',
          );
        } else {
          state.current.blocked = true;
          setRemote({ ...layout, design: saved });
          setError(
            'La estantería ha cambiado en otra sesión. Tu borrador está a salvo.',
          );
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          state.current.blocked = true;
          setError(errorMessage(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          syncingMembership.current = false;
          setRetry((value) => value + 1);
        }
      });
    return () => {
      controller.abort();
      syncingMembership.current = false;
    };
  }, [membership, !!design, retry, ownerId, key, keepDraft]);
  useEffect(() => {
    if (!state.current.design) return;
    const next = refreshBookSizes(state.current.design, library.current);
    if (stableJson(next) !== stableJson(state.current.design)) commit(next);
  }, [membership, books, !!design, commit]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (state.current.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  useEffect(() => {
    if (!design || !state.current.dirty || state.current.blocked) return;
    const timer = window.setTimeout(async () => {
      if (
        state.current.saving ||
        syncingMembership.current ||
        state.current.blocked ||
        !state.current.design
      )
        return;
      const snapshot = cloneDesign(state.current.design),
        serialized = stableJson(snapshot);
      state.current.saving = true;
      setStatus('Guardando tu estantería…');
      try {
        const saved = await api<BookshelfLayout>(
          '/me/bookshelf',
          {
            method: 'PUT',
            body: stableJson({
              book_ids: designOrder(
                snapshot,
                library.current.map((book) => book.book_id),
              ),
              revision: state.current.revision,
              design: snapshot,
            }),
          },
          ownerId,
        );
        if (!alive.current) return;
        state.current.revision = saved.revision;
        state.current.saved = serialized;
        state.current.dirty = stableJson(state.current.design) !== serialized;
        setError('');
        setStatus(
          state.current.dirty ? 'Cambios pendientes…' : 'Todo guardado',
        );
        if (!state.current.dirty) {
          try {
            sessionStorage.removeItem(key);
          } catch {}
        } else keepDraft(state.current.design!);
      } catch (cause) {
        if (!alive.current) return;
        state.current.blocked = true;
        // Verify timeouts too: the write may already have committed.
        try {
          const latest = await api<BookshelfLayout>(
            '/me/bookshelf',
            {},
            ownerId,
          );
          if (!alive.current) return;
          if (stableJson(latest.design) === serialized) {
            state.current.revision = latest.revision;
            state.current.saved = serialized;
            state.current.blocked = false;
            state.current.dirty =
              stableJson(state.current.design) !== serialized;
            setStatus(
              state.current.dirty ? 'Cambios pendientes…' : 'Todo guardado',
            );
            if (!state.current.dirty) {
              try {
                sessionStorage.removeItem(key);
              } catch {}
            }
          } else if (
            (cause instanceof ApiError && cause.status === 409) ||
            latest.revision !== state.current.revision
          ) {
            setRemote(latest);
            setError(
              'La estantería ha cambiado en otra sesión. Tu borrador está a salvo.',
            );
          } else {
            setError(errorMessage(cause));
            setStatus('Borrador sin guardar');
          }
        } catch {
          if (alive.current) {
            setError(errorMessage(cause));
            setStatus('Borrador sin guardar');
          }
        }
      } finally {
        if (alive.current) {
          state.current.saving = false;
          setRetry((v) => v + 1);
        }
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [design, ownerId, retry, key, keepDraft]);
  const travel = (direction: 'undo' | 'redo') => {
    const from = direction === 'undo' ? undo : redo,
      to = direction === 'undo' ? redo : undo;
    const next = from.current.pop();
    if (!next || !state.current.design) return;
    to.current.push(cloneDesign(state.current.design));
    lastAction.current.name = '';
    setHistoryVersion((v) => v + 1);
    applyLocal(
      reconcileDesign(
        next,
        library.current.map((book) => book.book_id),
      ),
    );
  };
  return {
    design,
    loading,
    status,
    error,
    remote,
    commit,
    canUndo: historyVersion >= 0 && undo.current.length > 0,
    canRedo: redo.current.length > 0,
    undo: () => travel('undo'),
    redo: () => travel('redo'),
    retry: () => {
      if (!state.current.design) {
        setLoadRetry((v) => v + 1);
        return;
      }
      state.current.blocked = false;
      setError('');
      setRetry((v) => v + 1);
    },
    resolve: (keepLocal: boolean) => {
      if (!remote) return;
      state.current.revision = remote.revision;
      state.current.saved = stableJson(remote.design);
      state.current.blocked = false;
      if (!keepLocal && remote.design) {
        undo.current = [];
        redo.current = [];
        setHistoryVersion((v) => v + 1);
        applyLocal(
          reconcileDesign(
            remote.design,
            library.current.map((book) => book.book_id),
          ),
        );
        try {
          sessionStorage.removeItem(key);
        } catch {}
      } else {
        state.current.dirty = true;
        keepDraft(state.current.design!);
      }
      setRemote(null);
      setError('');
      setRetry((v) => v + 1);
    },
  };
}
