import { useEffect, useState } from "react";
import ScoreViewer from "../src/ScoreViewer";
import { ScoreViewerConfig } from "../src/types/config";

// The embed's URL is fixed for the lifetime of the document, so the config location and
// the paths relative to it are resolved once, outside the component.
const query = new URLSearchParams(window.location.search)
const configUrl = query.get("config") || ""
const parent = configUrl.slice(0, configUrl.lastIndexOf('/'))

const wrapUrl = (url: string) =>
    url.startsWith("http") || url.startsWith("/") ? url : `${parent}/${url}`

function ScoreViewerWrapper() {

    const [config, setConfig] = useState<ScoreViewerConfig | null | undefined>()

    useEffect(() => {
        async function loadConfig() {
            try {
                const response = await fetch(configUrl)
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const data = await response.json() as ScoreViewerConfig
                // Missing paths are left as they are: the viewer's config validation reports them.
                const settings = data?.settings
                if (settings) {
                    if (typeof settings.basePath === "string") {
                        settings.basePath = wrapUrl(settings.basePath)
                    }
                    if (typeof settings.facsimileImagesPath === "string") {
                        settings.facsimileImagesPath = wrapUrl(settings.facsimileImagesPath)
                    }
                }
                setConfig(data)
            } catch (error) {
                console.error("Error loading config:", error)
            }
        }
        loadConfig()
    }, [])

    // #root is already the full height of the iframe, so the viewer takes all of it:
    // a vh fraction here would leave a dead band at the bottom of the embed.
    return config ? <ScoreViewer width="100%" height="100%" config={config} /> : null
}

export default ScoreViewerWrapper;