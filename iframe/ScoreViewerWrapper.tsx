import { useEffect, useState } from "react";
import ScoreViewer from "../src/ScoreViewer";
import { ScoreViewerConfig } from "../src/types/config";

function ScoreViewerWrapper() {

    const query = new URLSearchParams(window.location.search)
    const configUrl = query.get("config") || ""
    const parent = configUrl.slice(0, configUrl.lastIndexOf('/'))

    const wrapUrl = (url:string) =>
        url.startsWith("http") || url.startsWith("/") ? url : `${parent}/${url}`

    const [config, setConfig] = useState<ScoreViewerConfig | null | undefined>()

    useEffect(() => {
        async function loadConfig() {
            try {
                const response = await fetch(configUrl)
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const data = await response.json() as ScoreViewerConfig
                data.settings.basePath = wrapUrl(data.settings.basePath)
                data.settings.facsimileImagesPath = wrapUrl(data.settings.facsimileImagesPath)
                setConfig(data)
            } catch (error) {
                console.error("Error loading config:", error)
            }
        }
        loadConfig()
    }, [])

    return config ? <ScoreViewer width="100%" height="95vh" config={config} /> : null
}

export default ScoreViewerWrapper;