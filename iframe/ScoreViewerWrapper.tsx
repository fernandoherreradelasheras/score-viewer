import { useEffect, useState } from "react";
import ScoreViewer, { ScoreItem, ScoreViewerConfig } from "../src/ScoreViewer";
import React from "react";
import { FacsimileItem } from "../src/types";

function ScoreViewerWrapper() {

    const query = new URLSearchParams(window.location.search)
    const configUrl = query.get("config") || ""
    const parent = configUrl.slice(0, configUrl.lastIndexOf('/'))

    const wrapUrl = (url:string) =>
        url.startsWith("http") || url.startsWith("/") ? url : `${parent}/${url}`


    const [config, setConfig] = useState<ScoreViewerConfig | null | undefined>()

    useEffect(() => {
        async function loadConfig() {
            const response = await fetch(configUrl)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json() as ScoreViewerConfig
            data.scores = data.scores.map((score: ScoreItem) => ({
                ...score,
                meiUrl: wrapUrl(score.meiUrl),
                textUrl: score.textUrl ? wrapUrl(score.textUrl) : undefined,
                audioUrl: score.audioUrl ? wrapUrl(score.audioUrl) : undefined,
                facsimileItems: score.facsimileItems ? score.facsimileItems.map((item: FacsimileItem) => ({
                    name: item.name,
                    url: wrapUrl(item.url)
                })) : undefined
            }))
            setConfig(data)
        }
        loadConfig()
    }, [])

    return config ? <ScoreViewer width="100%" height="95vh" config={config} /> : null


}

export default ScoreViewerWrapper;