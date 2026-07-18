
import { Fragment, useEffect, useRef } from "react";
import useStore from "./store";
import { svgFilter } from "./SvgUtils";
import { TimeMapEvent, PlayingState } from "./types";
import { PLAYER_STAFF_COLORS } from "./types/colors";




const noteHighlightStyle = `
        .notehead.note-highlight { filter: var(--high); fill: var(--hgcolor); }
        g.stem path.note-highlight { color: var(--hgcolor); stroke-width: 36; }
        .verse[data-n="1"].note-highlight { font-weight: var(--verseFontWeight); fill: var(--hgcolor); }
      `


const svgHighlightFilters =
    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "0px", width: "0px" }}>
        <defs>
            {PLAYER_STAFF_COLORS.map((color, i) =>
                <Fragment key={i}>{svgFilter(`${i + 1}`, color, 100)}</Fragment>
            )}
        </defs>

        {PLAYER_STAFF_COLORS.map((_, i) =>
            <animate
                key={i}
                id={`radius-${i + 1}-animation`}
                xlinkHref={`#radius-${i + 1}`}
                attributeName="radius"
                from="10" to="600" dur="6s" begin="0s"
                fill="freeze" repeatCount="indefinite" restart="always"
            />
        )}
    </svg>


const getSvgStyleRules = () =>
    PLAYER_STAFF_COLORS
        .map((color, i) => `.staff[data-n="${i + 1}"] { \
        --high: url(#highlighting-${i + 1}); \
        --verseFontWeight: bold; \
        --hgcolor: ${color} }`).join('\n')

function PlayerHighlighter({ timemap }: { timemap: TimeMapEvent[] }) {

    const isLoading = useStore.use.isLoading()

    const playingState = useStore.use.playingState()
    const playingPosition = useStore.use.playingPosition()
    const seekPosition = useStore.use.seekPosition()


    const renderedSvgData = useStore.use.renderedSvgData()

    const eventsQueue = useRef<TimeMapEvent[]>([])
    const lastTimeStamp = useRef(-1)

    const animateElements = useRef(null as { [key: string]: SVGAnimateElement } | null)

    const buildAnimateElementsCache = () => {
        const elementMap: { [key: string]: SVGAnimateElement } = {};
        PLAYER_STAFF_COLORS.forEach((_, i) => {
            const key = `#radius-${i + 1}-animation`;
            const value = document.querySelector<SVGAnimateElement>(key);
            if (value) {
                elementMap[key] = value;
            }
        });
        return elementMap;
    };

    useEffect(() => {
        if (animateElements.current == null) {
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
        timemap.slice().reverse().find(e => e.on && e.tstamp <= position)?.on?.forEach(id => {
            document?.querySelectorAll(`#${CSS.escape(id)} > *`)?.forEach(noteElement => {
                noteElement.classList.add('note-highlight')
            })
        })
    }

    useEffect(() => {
        if (playingState == PlayingState.PAUSED) {
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

        const off = new Set(events.flatMap(e => e.off));
        const on = new Set(events.flatMap(e => e.on).filter(e => !off.has(e)))
        off.forEach(id => {
            if (id) {
                const escapedId = CSS.escape(id)
                const noteElements = [...document?.querySelectorAll(`#${escapedId} .note-highlight`)] as SVGGElement[] | null
                noteElements?.forEach(noteElement => {
                    noteElement.classList.remove('note-highlight')
                })
            }
        })

        if (playingState == PlayingState.PLAYING) {
            const keys = new Set(events.flatMap(e => e.stavesOn).filter(e => e != null))
            startGlowingNotes([...keys])
        }
        on.forEach(id => {
            if (id) {
                const escapedId = CSS.escape(id)
                document?.querySelectorAll(`#${escapedId} > *`)?.forEach(noteElement => {
                    noteElement.classList.add('note-highlight')
                })
            }
        })

    }, [playingPosition])

    useEffect(() => {
        if (seekPosition == -1) {
            return
        }
        stopGlowingNotes()
        resetHiglights()
        if (seekPosition > 0 && playingState == PlayingState.PAUSED) {
            higlightNotesAtPosition(seekPosition)
        }

    }, [seekPosition])

    return (
        <div className="player-highlighter" style={{ width: "0px", height: "0px" }}>

            {svgHighlightFilters}

            <style>
                {`
                    ${getSvgStyleRules()}
                    ${noteHighlightStyle}
                `}
            </style>
        </div>
    )

}

export default PlayerHighlighter
