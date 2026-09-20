import { DependencyList, useEffect } from 'react';

/**
 * Hook to execute a callback during browser idle time
 * Uses requestIdleCallback to avoid blocking the main thread
 */
export default function useIdleCallback(callback: () => void, deps: DependencyList) {
    useEffect(() => {
        // Check if requestIdleCallback is supported
        if (typeof requestIdleCallback === 'undefined') {
            // Fallback to setTimeout for browsers that don't support it
            const timeoutId = setTimeout(callback, 2000);
            return () => clearTimeout(timeoutId);
        }

        // Wait for user to be idle before executing callback
        const idleCallbackId = requestIdleCallback(
            () => {
                callback();
            },
            { timeout: 2000 } // Max 2s wait
        );

        return () => cancelIdleCallback(idleCallbackId);
        // The deps are the caller's: `callback` is deliberately not one of them, so an
        // inline callback does not reschedule the idle work on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
