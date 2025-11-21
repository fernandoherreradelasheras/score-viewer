import { useEffect } from 'react';

/**
 * Hook to execute a callback during browser idle time
 * Uses requestIdleCallback to avoid blocking the main thread
 */
export default function useIdleCallback(callback: () => void, deps: any[]) {
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
    }, deps);
}
