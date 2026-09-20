import { createContext } from 'react'
import { VerovioWorkerProxy } from './types/verovio-worker'


export const Context = createContext<{
    verovio: VerovioWorkerProxy | null,
}>({ verovio: null });
