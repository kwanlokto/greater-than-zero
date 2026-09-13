import { useRef, useState } from 'react';

// Wraps a press handler so further presses are ignored until its work is done,
// so a double tap can't run it twice. `busy` is for showing that state.
export function useGuardedPress(onPress: () => void | Promise<void>) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  async function press() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await onPress();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return { press, busy };
}
