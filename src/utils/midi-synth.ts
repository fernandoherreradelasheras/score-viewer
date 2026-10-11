import midiSynthWorkerUrl from '../workers/midi-synth.worker?worker&url';
import soundbankUrl from '../../assets/soundbank/score-viewer.sf3?asset';
import { MidiSynthRequest, MidiSynthResponse } from '../types/midi-synth-worker';

// Renderings are kept once done up to this many bytes of samples: a long score takes
// hundreds of megabytes. The ones a player waits for or plays are kept whatever their size.
const MAX_CACHED_BYTES = 128 * 1024 * 1024;

let worker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, { resolve: (channels: Float32Array[]) => void; reject: (error: Error) => void }>();

type Rendering = { buffer: Promise<AudioBuffer>, bytes: number };

// Least recently asked for first.
const renderings = new Map<string, Rendering>();

// The rendering each player waits for or plays, by the object it asks with.
const wanted = new Map<object, string>();

let queue: Promise<unknown> = Promise.resolve();

const isWanted = (key: string) => [...wanted.values()].includes(key);

const evict = () => {
    let total = [...renderings.values()].reduce((sum, rendering) => sum + rendering.bytes, 0);
    for (const [key, rendering] of renderings) {
        if (total <= MAX_CACHED_BYTES) break;
        if (isWanted(key)) continue;
        renderings.delete(key);
        total -= rendering.bytes;
    }
};

const getWorker = () => {
    if (!worker) {
        // Built from the URL for the same reason as the verovio worker (see useVerovio).
        worker = new Worker(midiSynthWorkerUrl, { type: import.meta.env.DEV ? 'module' : 'classic' });
        worker.onmessage = (event: MessageEvent<MidiSynthResponse>) => {
            const { id, channels, error } = event.data;
            const request = pendingRequests.get(id);
            pendingRequests.delete(id);
            if (channels) {
                request?.resolve(channels);
            } else {
                request?.reject(new Error(error ?? 'MIDI synthesis failed'));
            }
        };
        // A worker whose script does not load, or that fails outside a request, answers
        // nothing: the requests waiting for it would never settle. The next one starts
        // a new worker.
        worker.onerror = (event: ErrorEvent) => {
            const error = new Error(`MIDI synthesis worker failed: ${event.message || 'it could not be started'}`);
            pendingRequests.forEach(request => request.reject(error));
            pendingRequests.clear();
            worker?.terminate();
            worker = null;
        };
    }
    return worker;
};

// Registered once sent: a worker that cannot be created, or a message that cannot be
// sent, leaves nothing waiting for an answer.
const renderInWorker = (request: Omit<MidiSynthRequest, 'id'>) =>
    new Promise<Float32Array[]>((resolve, reject) => {
        const id = nextRequestId++;
        getWorker().postMessage({ ...request, id });
        pendingRequests.set(id, { resolve, reject });
    });

const render = async (key: string, midi: string, sampleRate: number): Promise<AudioBuffer> => {
    const turn = queue.then(async () => {
        // A reading picked and then changed again would otherwise keep the listener
        // waiting for every rendering in between.
        if (!isWanted(key)) {
            throw new Error('MIDI synthesis no longer wanted');
        }
        // A relative URL in the worker would resolve against the worker script.
        return renderInWorker({ midi, soundfont: new URL(soundbankUrl, document.baseURI).href, sampleRate });
    });
    queue = turn.catch(() => undefined);
    const channels = await turn;
    const buffer = new AudioBuffer({ length: channels[0].length, numberOfChannels: channels.length, sampleRate });
    channels.forEach((channel, index) => buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, index));
    return buffer;
};

// The consumer is any object a player keeps: what it asks for replaces what it asked
// for before, and only renderings some player still wants are synthesized and kept.
export function synthesizeMidi(midi: string, sampleRate: number, consumer: object): Promise<AudioBuffer> {
    const key = `${sampleRate}\n${midi}`;
    wanted.set(consumer, key);
    let rendering = renderings.get(key);
    if (rendering) {
        renderings.delete(key);
    } else {
        const created: Rendering = { buffer: render(key, midi, sampleRate), bytes: 0 };
        created.buffer.then(buffer => {
            created.bytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
            evict();
        }, () => {
            if (renderings.get(key) === created) renderings.delete(key);
        });
        rendering = created;
    }
    renderings.set(key, rendering);
    evict();
    return rendering.buffer;
}

export function releaseMidiSyntheses(consumer: object) {
    wanted.delete(consumer);
    evict();
}
