import { useEffect } from "react";
import { listen, type EventCallback } from "@tauri-apps/api/event";

/**
 * Subscribe to a Tauri event with automatic cleanup.
 * Re-subscribes when `deps` change.
 */
export function useTauriEvent<T>(event: string, handler: EventCallback<T>, deps: unknown[] = []) {
  useEffect(() => {
    const unlisten = listen<T>(event, handler);
    return () => { unlisten.then((f) => f()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
