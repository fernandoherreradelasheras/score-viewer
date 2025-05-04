import { useEffect, useRef } from 'react';
import { VerovioToolkit } from 'verovio/esm';
import createVerovioModule from 'verovio/wasm';


const initPromise = createVerovioModule().then((VerovioModule: any)  => {
    const tk = new VerovioToolkit(VerovioModule)
    console.log("Verovio version:", tk.getVersion())
    return tk
})

function useVerovio() {

    const toolkit = useRef<VerovioToolkit|null>(null)

    useEffect(() => {

        async function initVerovio() {
            console.log("waiting promise Verovio")
            const tk = await initPromise
            toolkit.current = tk
        }

        initVerovio()
    }, [])

    return toolkit.current
}

export default useVerovio
