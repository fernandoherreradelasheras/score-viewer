export interface MidiSynthRequest {
    id: number;
    soundfont: string;
    // A Standard MIDI File, base64 encoded.
    midi: string;
    sampleRate: number;
}

export interface MidiSynthResponse {
    id: number;
    channels?: Float32Array[];
    error?: string;
}
