import { useEffect, useRef, useState } from 'react';
import { VerovioWorkerProxy, VerovioWorkerRequest, VerovioWorkerResponse, VerovioWorkerInitMessage } from './types/verovio-worker';

// Shared worker instance across all components
let sharedWorker: Worker | null = null;
let workerReady = false;
let workerVersion: string | null = null;

// Queue for pending requests
const pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
}>();

// Queue for requests made before worker is ready
let initializationPromise: Promise<void> | null = null;

// Request ID counter
let requestIdCounter = 0;

/**
 * Initialize the Verovio worker (called once)
 */
function initializeWorker(): Worker {
    if (sharedWorker) {
        return sharedWorker;
    }

    console.log('[useVerovio] Creating Verovio worker...');
    sharedWorker = new Worker(
        new URL('./workers/verovio.worker.ts', import.meta.url),
        { type: 'module' }
    );

    // Create initialization promise
    initializationPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Worker initialization timeout'));
        }, 30000); // 30 second timeout

        sharedWorker!.onmessage = (event: MessageEvent) => {
            const message = event.data;

            // Handle initialization message
            if (message.type === 'init') {
                clearTimeout(timeout);
                const initMsg = message as VerovioWorkerInitMessage;
                if (initMsg.status === 'ready') {
                    workerReady = true;
                    workerVersion = initMsg.version || null;
                    console.log('[useVerovio] Worker ready, Verovio version:', workerVersion);
                    resolve();
                } else {
                    console.error('[useVerovio] Worker initialization failed:', initMsg.error);
                    reject(new Error(initMsg.error || 'Worker initialization failed'));
                }
                // Set up handler for subsequent messages
                sharedWorker!.onmessage = handleWorkerMessage;
                return;
            }
        };

        sharedWorker!.onerror = (error) => {
            clearTimeout(timeout);
            console.error('[useVerovio] Worker error during init:', error);
            reject(error);
        };
    });

    return sharedWorker;
}

/**
 * Handle worker messages after initialization
 */
function handleWorkerMessage(event: MessageEvent) {
    const response = event.data as VerovioWorkerResponse;
    const pending = pendingRequests.get(response.id);

    if (pending) {
        pendingRequests.delete(response.id);

        if (response.error) {
            pending.reject(new Error(response.error));
        } else {
            pending.resolve(response.result);
        }
    }
}

/**
 * Call a method on the Verovio worker
 */
async function callWorkerMethod(method: string, ...args: any[]): Promise<any> {
    if (!sharedWorker) {
        throw new Error('Worker not initialized');
    }

    // Wait for worker to be ready
    if (!workerReady && initializationPromise) {
        await initializationPromise;
    }

    if (!workerReady) {
        throw new Error('Worker not ready');
    }

    return new Promise((resolve, reject) => {
        if (!sharedWorker) {
            reject(new Error('Worker not initialized'));
            return;
        }

        const id = `req_${++requestIdCounter}`;
        pendingRequests.set(id, { resolve, reject });

        const request: VerovioWorkerRequest = {
            id,
            method,
            args
        };

        sharedWorker.postMessage(request);
    });
}

/**
 * Create a proxy object that wraps all Verovio methods
 */
function createWorkerProxy(): VerovioWorkerProxy {
    return {
        get isReady() {
            return workerReady;
        },
        setOptions: (options) => callWorkerMethod('setOptions', options),
        loadData: (data) => callWorkerMethod('loadData', data),
        getPageCount: () => callWorkerMethod('getPageCount'),
        renderToSVG: (page) => callWorkerMethod('renderToSVG', page),
        renderToTimemap: (options) => callWorkerMethod('renderToTimemap', options),
        getMEI: (options) => callWorkerMethod('getMEI', options),
        getPageWithElement: (elementId) => callWorkerMethod('getPageWithElement', elementId),
        getElementsAtTime: (time) => callWorkerMethod('getElementsAtTime', time),
        getVersion: () => callWorkerMethod('getVersion')
    };
}

/**
 * Hook to access the Verovio worker
 */
function useVerovio(): VerovioWorkerProxy | null {
    const [proxy, setProxy] = useState<VerovioWorkerProxy | null>(null);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize worker on first mount
        if (!workerRef.current) {
            workerRef.current = initializeWorker();
            setProxy(createWorkerProxy());
        }

        // Cleanup on unmount
        return () => {
            // Note: We keep the worker alive for the lifetime of the app
            // since it's shared across components
        };
    }, []);

    return proxy;
}

export default useVerovio;
