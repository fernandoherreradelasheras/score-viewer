import { VerovioOptions } from 'verovio';

/**
 * Message types for communication between main thread and Verovio worker
 */

// Request message sent to worker
export interface VerovioWorkerRequest {
    id: string;
    method: string;
    args: any[];
}

// Response message from worker
export interface VerovioWorkerResponse {
    id: string;
    result?: any;
    error?: string;
}

// Initialization message from worker
export interface VerovioWorkerInitMessage {
    type: 'init';
    status: 'ready' | 'error';
    version?: string;
    error?: string;
}

/**
 * Worker proxy interface matching VerovioToolkit API
 * All methods return Promises since they communicate with the worker
 */
export interface VerovioWorkerProxy {
    isReady: boolean;
    setOptions: (options: VerovioOptions) => Promise<void>;
    loadData: (data: string) => Promise<boolean>;
    getPageCount: () => Promise<number>;
    renderToSVG: (page: number) => Promise<string>;
    renderToTimemap: (options?: any) => Promise<any>;
    getMEI: (options?: any) => Promise<string>;
    getPageWithElement: (elementId: string) => Promise<number>;
    getElementsAtTime: (time: number) => Promise<any>;
    getVersion: () => Promise<string>;
}
