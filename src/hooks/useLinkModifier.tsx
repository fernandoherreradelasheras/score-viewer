import { useEffect, useState } from 'react';

// Ctrl on its own is a right click on macOS, hence Cmd there.
export const isLinkClick = (event: { ctrlKey: boolean, metaKey: boolean }) => event.ctrlKey || event.metaKey;

// Whether a click now would follow a link between the score and the facsimile, for the
// links to be shown only then: a plain click pans the facsimile and opens editorials.
export function useLinkModifier() {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const update = (event: KeyboardEvent) => setHeld(isLinkClick(event));
    // The key may be released in another window, and the keyup never come.
    const release = () => setHeld(false);
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('blur', release);
    };
  }, []);

  return held;
}
