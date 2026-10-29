// Instant refresh: the server sends "refresh" over SSE the moment an order changes.
// Polling stays as a slow safety net in case the stream drops (bad signal, sleeping server).
import { useEffect, useRef, useState } from 'react';

export function useLive(channels, onChange) {
  const [live, setLive] = useState(false);
  const callback = useRef(onChange);
  callback.current = onChange;
  const key = channels.filter(Boolean).join(',');

  useEffect(() => {
    if (!key || typeof EventSource === 'undefined') return undefined;
    let timer = null;
    const source = new EventSource(`/api/events?ch=${encodeURIComponent(key)}`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false); // EventSource reconnects by itself
    source.onmessage = () => {
      // Several changes in a row → one reload
      clearTimeout(timer);
      timer = setTimeout(() => callback.current?.(), 250);
    };
    // Leaving or reloading the page: free the connection at once (browsers allow only a few per site)
    const close = () => source.close();
    window.addEventListener('pagehide', close);
    return () => { clearTimeout(timer); source.close(); window.removeEventListener('pagehide', close); setLive(false); };
  }, [key]);

  return live;
}
