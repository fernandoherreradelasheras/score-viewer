import { VerovioToolkit } from 'verovio/esm';
import createVerovioModule from 'verovio/wasm';
import { VerovioWorkerRequest, VerovioWorkerResponse, VerovioWorkerInitMessage } from '../types/verovio-worker';

let verovioToolkit: VerovioToolkit | null = null;

/**
 * Initialize Verovio in the worker context
 */
async function initializeVerovio() {
    try {
        console.log('[Verovio Worker] Initializing Verovio module...');
        const VerovioModule = await createVerovioModule();
        verovioToolkit = new VerovioToolkit(VerovioModule);
        const version = verovioToolkit.getVersion();
        console.log('[Verovio Worker] Verovio initialized, version:', version);

        const initMessage: VerovioWorkerInitMessage = {
            type: 'init',
            status: 'ready',
            version
        };
        self.postMessage(initMessage);
    } catch (error) {
        console.error('[Verovio Worker] Failed to initialize Verovio:', error);
        const initMessage: VerovioWorkerInitMessage = {
            type: 'init',
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
        };
        self.postMessage(initMessage);
    }
}

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = async (event: MessageEvent<VerovioWorkerRequest>) => {
    const { id, method, args } = event.data;

    if (!verovioToolkit) {
        const response: VerovioWorkerResponse = {
            id,
            error: 'Verovio not initialized'
        };
        self.postMessage(response);
        return;
    }

    try {
        // Call the requested method on the Verovio toolkit
        const result = (verovioToolkit as any)[method](...args);

        const response: VerovioWorkerResponse = {
            id,
            result
        };
        self.postMessage(response);
    } catch (error) {
        console.error(`[Verovio Worker] Error executing ${method}:`, error);
        const response: VerovioWorkerResponse = {
            id,
            error: error instanceof Error ? error.message : String(error)
        };
        self.postMessage(response);
    }
};

// Start initialization when worker is created
initializeVerovio();
