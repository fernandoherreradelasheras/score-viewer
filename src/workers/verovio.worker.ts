import { VerovioToolkit } from 'verovio/esm';
import createVerovioModule from 'verovio/wasm';
import { VerovioWorkerRequest, VerovioWorkerResponse, VerovioWorkerInitMessage } from '../types/verovio-worker';
import { MUSIC_FONTS } from '../types/config';

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

// The names of the files in a zip archive, from its central directory.
function zipFileNames(bytes: Uint8Array): string[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < 0) return [];
    const names: string[] = [];
    const decoder = new TextDecoder();
    let entry = view.getUint32(end + 16, true);
    for (let i = view.getUint16(end + 10, true); i > 0 && view.getUint32(entry, true) === 0x02014b50; i--) {
        const nameLength = view.getUint16(entry + 28, true);
        names.push(decoder.decode(bytes.subarray(entry + 46, entry + 46 + nameLength)));
        entry += 46 + nameLength + view.getUint16(entry + 30, true) + view.getUint16(entry + 32, true);
    }
    return names;
}

// The name Verovio gives the font in an archive: that of the first `<font>.xml` at its
// root or in `<font>/`.
function fontNameInArchive(names: string[]): string | null {
    for (const name of names) {
        const match = name.match(/^(?:([^/]*)\/)?([^/]*)\.xml$/);
        if (match && (match[1] === undefined || match[1] === match[2])) return match[2];
    }
    return null;
}

/**
 * Add the music font in the Verovio font archive (zip) at `url`, and return its name.
 * Verovio throws on anything but a zip archive, and skips without telling an archive
 * whose font it cannot name or already has.
 */
async function addMusicFont(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(`${url} is not a zip archive`);
    const fontName = fontNameInArchive(zipFileNames(bytes));
    if (!fontName) throw new Error(`${url} holds no Verovio font`);
    if ((MUSIC_FONTS as readonly string[]).includes(fontName)) {
        throw new Error(`${url} holds ${fontName}, which Verovio already has`);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    verovioToolkit!.setOptions({ fontAddCustom: [btoa(binary)] });
    return fontName;
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

    if (method === 'addMusicFont') {
        try {
            const response: VerovioWorkerResponse = { id, result: await addMusicFont(args[0] as string) };
            self.postMessage(response);
        } catch (error) {
            console.error('[Verovio Worker] Error adding a music font:', error);
            const response: VerovioWorkerResponse = {
                id,
                error: error instanceof Error ? error.message : String(error)
            };
            self.postMessage(response);
        }
        return;
    }

    const toolkitMethod = (verovioToolkit as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>)[method];
    if (typeof toolkitMethod !== 'function') {
        const response: VerovioWorkerResponse = {
            id,
            error: `Unknown Verovio method: ${method}`
        };
        self.postMessage(response);
        return;
    }

    try {
        const result = toolkitMethod.apply(verovioToolkit, args);

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
