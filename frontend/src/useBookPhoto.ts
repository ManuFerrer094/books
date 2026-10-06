import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useBookPhoto(bucket: string, path?: string | null) {
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    setSigned(null);
    async function refresh() {
      if (!path || !supabase) return;
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);
        if (active)
          setSigned(error || !data ? null : { path, url: data.signedUrl });
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
  }, [bucket, path]);
  return signed && signed.path === path ? signed.url : null;
}
