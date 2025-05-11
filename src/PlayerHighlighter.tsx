import { useEffect, useMemo, useRef } from "react";
import useStore from "./store";
import { svgFilter } from "./SvgUtils";
import { TimeMapEvent, PlayingState } from "./types";


const staffHighlightColors = ["#8e0000", "#227710", "#5500aa", "#e9227a", "#fa8072", "#11ddff", "#8e0000", "#227710"]


const noteHighlightStyle = `
        .notehead.note-highlight { filter: var(--high); fill: var(--hgcolor); }
        g.stem path.note-highlight { color: var(--hgcolor); stroke-width: 36; }
        .verse[data-n="1"].note-highlight { font-weight: var(--verseFontWeight); fill: var(--hgcolor); }
      `



const svgHighlightFilters =
<svg xmlns="http://www.w3.org/2000/svg" style={{height:"0px", width:"0px"}}>
    <defs>
        {svgFilter("1", staffHighlightColors[0], 100)}
        {svgFilter("2", staffHighlightColors[1], 100)}
        {svgFilter("3", staffHighlightColors[2], 100)}
        {svgFilter("4", staffHighlightColors[3], 100)}
        {svgFilter("5", staffHighlightColors[4], 100)}
        {svgFilter("6", staffHighlightColors[5], 100)}
        {svgFilter("7", staffHighlightColors[6], 100)}
        {svgFilter("8", staffHighlightColors[7], 100)}
        {svgFilter("hover", "#fe3b20", 0)}
    </defs>

     <animate id="radius-1-animation" xlinkHref="#radius-1" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
     <animate id="radius-2-animation" xlinkHref="#radius-2" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
     <animate id="radius-3-animation" xlinkHref="#radius-3" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
     <animate id="radius-4-animation" xlinkHref="#radius-4" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
     <animate id="radius-5-animation" xlinkHref="#radius-5" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
     <animate id="radius-6-animation" xlinkHref="#radius-6" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
     <animate id="radius-7-animation" xlinkHref="#radius-7" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
     <animate id="radius-8-animation" xlinkHref="#radius-8" attributeName="radius" from="10" to="600" dur="6s" begin="0s" fill="freeze" repeatCount="indefinite" restart="always"/>
</svg>


const getSvgStyleRules = (ignoreStaffs: Set<string>) =>
    [1, 2, 3, 4, 5, 6, 7, 8]
    .filter(i => !ignoreStaffs.has(`${i}`))
    .map(i=> `.staff[data-n="${i}"] { \
        --high: url(#highlighting-${i}); \
        --verseFontWeight: bold; \
        --hgcolor: ${staffHighlightColors[i-1]} }`).join('\n')


function PlayerHighlighter({ timemap } : { timemap:  TimeMapEvent[] } ) {

    const isLoading = useStore.use.isLoading()

    const playingState = useStore.use.playingState()
    const playingPosition = useStore.use.playingPosition()
    const seekPosition = useStore.use.seekPosition()
    const showReconstructions = useStore.use.showReconstructions()
    const audioTracks = useStore.use.audioTracks();


    const renderedSvgData = useStore.use.renderedSvgData()

    const eventsQueue = useRef<TimeMapEvent[]>([])
    const lastTimeStamp = useRef(-1)

    const animateElements = useRef(null as { [key: string]: SVGAnimateElement } | null)

    const buildAnimateElementsCache = () => {
        const elementMap = {} as { [key: string]: SVGAnimateElement }
        [1, 2, 3, 4, 5, 6, 7, 8].forEach(n => {
            const key = `#radius-${n}-animation`
            const value = document.querySelector(key) as SVGAnimateElement | null
            if (value) {
                elementMap[key] = value
            }
        })
        return elementMap
    }

    useEffect(() => {
        if (animateElements.current == null)  {
             const cache = buildAnimateElementsCache()
             if (cache != null) {
                animateElements.current = cache
             }
        }
    }, [])


    const stopGlowingNotes = () => {
        animateElements.current && Object.values(animateElements.current).forEach((a: SVGAnimateElement) => {
            a?.endElement()
        })
    }

    const startGlowingNotes = (keys: string[]) => {
        if (animateElements.current == null) {
            return
        }
        for (let key of keys) {
            animateElements.current[key]?.beginElement()
        }
    }

    useEffect(() => {
        if (timemap.length <= 0 && isLoading) {
            eventsQueue.current = []
            return
        }
        eventsQueue.current = [...timemap]
        lastTimeStamp.current = -1
    }, [timemap])

    useEffect(() => {
        if (timemap.length <= 0 && isLoading) {
            return
        }

        if (playingState != PlayingState.PLAYING) {
            stopGlowingNotes()
            if (playingPosition == 0) {
                resetHiglights()
            }
        }
    }, [playingState])

    const higlightNotesAtPosition = (position: number) => {
        timemap.slice().reverse().find(e=> e.on && e.tstamp <= position)?.on?.forEach(id => {
            console.log(`highlighter: highlighting note ${id}`)
            document?.querySelectorAll(`#${id} > *`)?.forEach(noteElement => {
                noteElement.classList.add('note-highlight')
            })
        })
    }

    useEffect(() => {
        if (playingState == PlayingState.PAUSED) {
            console.log(`highlighter: changed svg rendered while on pause. Re higihlighting notes`)
            higlightNotesAtPosition(playingPosition)
        }
    }, [renderedSvgData])

    const resetHiglights = () => {
        eventsQueue.current = [...timemap]
        lastTimeStamp.current = -1
        const remainingHighlights = document?.querySelectorAll(`.note-highlight`)
        remainingHighlights?.forEach(noteElement => {
            noteElement.classList.remove('note-highlight')
        })
    }

    const ignoreStaffs = useMemo(() => {
        const staffsWithoutAudio = new Set<string>()
        const labelsWithAudio = audioTracks.overlays.map(t => t.label)
        for (let [staff, label] of Object.entries(showReconstructions)) {
            if (!labelsWithAudio.includes(label)) {
                staffsWithoutAudio.add(staff)
            }
        }
        return staffsWithoutAudio
    }, [showReconstructions, audioTracks])

    const svgStyleRules = useMemo(() => {
        return getSvgStyleRules(ignoreStaffs)
    }, [ignoreStaffs])


    useEffect(() => {
        if (timemap.length <= 0 && isLoading) {
            return
        }

        if (playingState == PlayingState.STOPPED) {
            resetHiglights()
            return
        }

        const currentPlayingPosition = Math.round(playingPosition)
        const events = []
        var event = eventsQueue.current.shift()
        while (event != null && event.tstamp <= lastTimeStamp.current) {
            event = eventsQueue.current.shift()
        }

        while (event != null && event.tstamp <= currentPlayingPosition) {
            events.push(event)
            event = eventsQueue.current.shift()
        }
        if (event != null) {
            eventsQueue.current.unshift(event)
        }


        lastTimeStamp.current = currentPlayingPosition

        if (events.length <= 0) {
            return
        }

        const off = new Set(events.flatMap(e => e.off))
        const on = new Set(events.flatMap(e => e.on).filter(e => !off.has(e)))
        off.forEach(id => {
            const noteElements = [...document?.querySelectorAll(`#${id} .note-highlight`)] as SVGGElement[] | null
            noteElements?.forEach(noteElement => {
                noteElement.classList.remove('note-highlight')
            })
        })

        if (playingState == PlayingState.PLAYING) {
            const keys = new Set(events.flatMap(e => e.stavesOn).filter(e => e != null))
            startGlowingNotes([...keys])
        }
        on.forEach(id => {
            document?.querySelectorAll(`#${id} > *`)?.forEach(noteElement => {
                noteElement.classList.add('note-highlight')
            })
        })

    }, [playingPosition])

    useEffect(() => {
        stopGlowingNotes()
        resetHiglights()
        if (seekPosition > 0 && playingState == PlayingState.PAUSED) {
            console.log(`highlight notes un pause at seek position ${seekPosition}`)
            higlightNotesAtPosition(seekPosition)
        }

    }, [seekPosition])

    return (
        <div className="player-highlighter" style={{ width: "0px", height: "0px" }}>

            {svgHighlightFilters}

            <style>
                {`
                    ${svgStyleRules}
                    ${noteHighlightStyle}
                `}
            </style>
        </div>
    )

}

export default PlayerHighlighter