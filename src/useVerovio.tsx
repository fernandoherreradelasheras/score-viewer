import { useEffect } from 'react';
import { VerovioToolkit } from 'verovio/esm';
import createVerovioModule from 'verovio/wasm';


let tk: VerovioToolkit|null = null

const initPromise = createVerovioModule().then((VerovioModule: any)  => {
    const tk = new VerovioToolkit(VerovioModule)
    console.log("Verovio version:", tk.getVersion())
    return tk
})

function useVerovio() {
    useEffect(() => {
        async function initVerovio() {
            console.log("waiting promise Verovio")
            tk = await initPromise
        }
        if (tk == null) {
            initVerovio()
        }
    }, [])

    return tk
}

export default useVerovio
