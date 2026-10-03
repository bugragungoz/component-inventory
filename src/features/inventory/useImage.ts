/** Loads an image the owner attached (stored under the data folder) as a blob URL. */
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api/commands';

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

export function useImage(path: string | null | undefined): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  useEffect(() => {
    if (!path) {
      setState({ url: null, failed: false });
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    api.readImage(path).then(
      (bytes) => {
        if (cancelled) return;
        const ext = path.split('.').pop()?.toLowerCase() ?? '';
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[ext] ?? 'application/octet-stream' }));
        setState({ url, failed: false });
      },
      () => { if (!cancelled) setState({ url: null, failed: true }); },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return state;
}
