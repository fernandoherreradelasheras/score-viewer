
import { useEffect, useMemo, useRef } from "react";
import useStore from "./store";
import { TimeMapEvent, PlayingState } from "./types";
import { PLAYER_STAFF_COLORS, playerStaffColor } from "./types/colors";
import { buildNoteTimings } from "./utils/timemap";
import { buildTieLinks } from "./utils/ties";
import { createNoteVisualization } from "./visualizations";


const noteHighlightStyle = `
        .notehead.note-highlight { fill: var(--hgcolor); }
        /* The class lands on g.stem (a direct child of the note), not on its path,
           which picks up the color through verovio's stroke: currentColor. */
        g.stem.note-highlight path { color: var(--hgcolor); stroke-width: 36; }
        .verse[data-n="1"].note-highlight { font-weight: var(--verseFontWeight); fill: var(--hgcolor); }
      `


const getSvgStyleRules = () =>
    PLAYER_STAFF_COLORS
        .map((color, i) => `.staff[data-n="${i + 1}"] { \
        --verseFontWeight: bold; \
        --hgcolor: ${color} }`).join('\n')

function PlayerHighlighter({ timemap }: { timemap: TimeMapEvent[] }) {

    const isLoading = useStore.use.isLoading()

    const playingState = useStore.use.playingState()
    const playingPosition = useStore.use.playingPosition()
    const seekPosition = useStore.use.seekPosition()
    const noteVisualization = useStore.use.noteVisualization()

    const renderedSvgData = useStore.use.renderedSvgData()
    const score = useStore.use.score()

    const eventsQueue = useRef<TimeMapEvent[]>([])
    const lastTimeStamp = useRef(-1)

    const noteTimings = useMemo(() => buildNoteTimings(timemap), [timemap])
    const ties = useMemo(() => buildTieLinks(score?.properties?.tiedNotes ?? []), [score])
    const visualization = useMemo(() => createNoteVisualization(noteVisualization, ties), [noteVisualization, ties])

    useEffect(() => () => visualization.reset(), [visualization])

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
            visualization.reset()
            if (playingPosition == 0) {
                resetHiglights()
            }
        }
    }, [playingState])

    const highlightNote = (id: string) => {
        document.querySelectorAll(`#${CSS.escape(id)} > *`).forEach(noteElement => {
            noteElement.classList.add('note-highlight')
        })
    }

    const unhighlightNote = (id: string) => {
        document.querySelectorAll(`#${CSS.escape(id)} > .note-highlight`).forEach(noteElement => {
            noteElement.classList.remove('note-highlight')
        })
    }

    // Attacked at `position`, not at the onset: after a seek into the middle of a
    // note its animation must end with the note, not a whole duration later.
    const attackNote = (id: string, staff: number, position: number) => {
        const timing = noteTimings.get(id)
        visualization.attack({
            noteId: id,
            element: document.getElementById(id) as SVGGElement | null,
            staff,
            color: playerStaffColor(staff),
            durationMs: timing?.durationMs ?? 0,
            durationQuarters: timing?.durationQuarters ?? 0,
            elapsedMs: Math.max(0, position - (timing?.onsetMs ?? position)),
        })
    }

    // Replay the whole timemap up to `position`: notes that started earlier and are
    // still sounding must stay lit, not only the ones of the last event.
    const soundingNotesAtPosition = (position: number) => {
        const sounding = new Map<string, number>()
        for (const event of timemap) {
            if (event.tstamp > position) {
                break
            }
            event.off?.forEach(id => sounding.delete(id))
            event.on?.forEach((id, i) => sounding.set(id, event.stavesOn?.[i] ?? 1))
        }
        return sounding
    }

    const higlightNotesAtPosition = (position: number) => {
        soundingNotesAtPosition(position).forEach((_, id) => highlightNote(id))
    }

    // A new SVG comes without the highlights and animations of the notes already
    // sounding, so they are put back with their animations advanced to the present.
    useEffect(() => {
        if (playingState == PlayingState.PAUSED) {
            higlightNotesAtPosition(playingPosition)
        }
        if (playingState == PlayingState.PLAYING) {
            soundingNotesAtPosition(playingPosition).forEach((staff, id) => {
                highlightNote(id)
                attackNote(id, staff, playingPosition)
            })
        }
    }, [renderedSvgData])

    const resetHiglights = () => {
        eventsQueue.current = [...timemap]
        lastTimeStamp.current = -1
        visualization.reset()
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

        const off = new Set(events.flatMap(e => e.off ?? []))
        // Keep each note paired with its staff: stavesOn is positional against on.
        const on = new Map<string, number>()
        events.forEach(e => e.on?.forEach((id, i) => {
            if (!off.has(id)) {
                on.set(id, e.stavesOn?.[i] ?? 1)
            }
        }))

        off.forEach(id => {
            unhighlightNote(id)
            visualization.release(id)
        })

        on.forEach((staff, id) => {
            highlightNote(id)
            if (playingState == PlayingState.PLAYING) {
                attackNote(id, staff, currentPlayingPosition)
            }
        })

    }, [playingPosition])

    useEffect(() => {
        if (seekPosition == -1) {
            return
        }
        resetHiglights()
        if (seekPosition > 0 && playingState == PlayingState.PAUSED) {
            higlightNotesAtPosition(seekPosition)
        }

    }, [seekPosition])

    return (
        <div className="player-highlighter" style={{ width: "0px", height: "0px" }}>

            <style>
                {`
                    ${getSvgStyleRules()}
                    ${noteHighlightStyle}
                    ${visualization.styles ?? ''}
                `}
            </style>
        </div>
    )

}

export default PlayerHighlighter
