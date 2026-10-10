"""Draft an audio sync file for score-viewer by aligning a recording with its MEI score.

    .venv/bin/python align.py score.mei recording.mp3 [-o recording.sync.json]

The score is read with verovio, with the options score-viewer uses for its timemap, so the
anchors point at the same measures and quarters the viewer sees. Which repeats the
recording takes, and which sections it leaves out, is found by trying every form the
repeat signs and double barlines allow.
"""

import argparse
import base64
import io
import itertools
import json
import re
import sys
import warnings
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import pandas as pd
import pretty_midi
import verovio

with warnings.catch_warnings():
    warnings.simplefilter("ignore", SyntaxWarning)
    from synctoolbox.dtw.mrmsdtw import sync_via_mrmsdtw
    from synctoolbox.dtw.utils import (compute_optimal_chroma_shift, make_path_strictly_monotonic,
                                       shift_chroma_vectors)
    from synctoolbox.feature.chroma import pitch_to_chroma, quantize_chroma, quantized_chroma_to_CENS
    from synctoolbox.feature.csv_tools import df_to_pitch_features, df_to_pitch_onset_features
    from synctoolbox.feature.dlnco import pitch_onset_features_to_DLNCO
    from synctoolbox.feature.pitch import audio_to_pitch_features
    from synctoolbox.feature.pitch_onset import audio_to_pitch_onset_features
    from synctoolbox.feature.utils import estimate_tuning

SAMPLE_RATE = 22050
FEATURE_RATE = 50
STEP_WEIGHTS = np.array([1.5, 1.5, 2.0])
THRESHOLD_REC = 10 ** 6
# Frames per second of the coarse alignment that compares the forms a recording may follow.
FORM_RATE = 5
# Below the loudest moment, in dB, what is taken for silence.
SILENCE_DB = 60
# A first or last second of sound this much quieter than the recording's usual level is the
# noise around the music (the surface of a record), which ends where sound rises
# ABOVE_NOISE_DB over it.
NOISE_MARGIN_DB = 10
ABOVE_NOISE_DB = 6
# A measure this many times slower, by the quarter, than the median of the LINGER_NEIGHBOURS
# measures on each side, gets anchors within it as well.
LINGER_RATIO = 1.6
LINGER_NEIGHBOURS = 4
DRIFT_SECONDS = 0.15
DRIFT_WINDOW = 6
DRIFT_MEASURES = 4
# Barlines a recording may jump at: past what follows them, or back to repeat.
SECTION_BARLINES = {"dbl", "dbldashed", "dbldotted", "dblheavy", "heavy", "end", "rptstart", "rptend", "rptboth"}

MEI_NS = "http://www.music-encoding.org/ns/mei"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"

VEROVIO_OPTIONS = {
    "expand": "",
    "expandNever": True,
    "expandAlways": False,
    "mdivAll": True,
}


@dataclass
class Measure:
    ordinal: int
    n: str
    qstamp: float
    seconds: float
    left: str
    right: str


@dataclass
class Score:
    measures: list[Measure]
    notes: pd.DataFrame
    quarters: float
    seconds: float
    # The note value the meter counts, in quarters: an eighth in 6/8.
    unit: float
    mei: ET.Element
    toolkit: verovio.toolkit
    # When each note starts and ends, in seconds of the score.
    note_times: dict[str, tuple[float, float]]


def read_score(mei_path: Path) -> Score:
    verovio.enableLog(verovio.LOG_OFF)
    toolkit = verovio.toolkit()
    toolkit.setOptions(VEROVIO_OPTIONS)
    mei = mei_path.read_text(encoding="utf-8")
    meter_unit = re.search(r'meter\.unit="(\d+)"|<meterSig\b[^>]*\bunit="(\d+)"', mei)
    if not toolkit.loadData(mei):
        sys.exit(f"verovio could not load {mei_path}")

    timemap = toolkit.renderToTimemap({"includeMeasures": True, "includeRests": True})
    measures = []
    for event in timemap:
        if "measureOn" in event:
            attrs = toolkit.getElementAttr(event["measureOn"])
            measures.append(Measure(len(measures), attrs.get("n", str(len(measures) + 1)), event["qstamp"],
                                    event["tstamp"] / 1000, attrs.get("left", ""), attrs.get("right", "")))

    # verovio writes its tempo events on the tracks of the staves, which pretty_midi warns
    # about; the note times it reads match the timemap all the same.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        midi = pretty_midi.PrettyMIDI(io.BytesIO(base64.b64decode(toolkit.renderToMIDI())))
    notes = pd.DataFrame(
        [{"start": n.start, "duration": n.end - n.start, "pitch": n.pitch, "velocity": n.velocity,
          "instrument": "piano"} for inst in midi.instruments for n in inst.notes])
    note_times, started = {}, {}
    for event in timemap:
        for note in event.get("on", []):
            started[note] = event["tstamp"] / 1000
        for note in event.get("off", []):
            if note in started:
                note_times[note] = (started.pop(note), event["tstamp"] / 1000)
    return Score(measures, notes.sort_values("start").reset_index(drop=True),
                 timemap[-1]["qstamp"], timemap[-1]["tstamp"] / 1000,
                 4 / int(next(filter(None, meter_unit.groups()))) if meter_unit else 1.0,
                 ET.fromstring(mei), toolkit, note_times)


def mei_measures(score: Score) -> list[ET.Element]:
    found = score.mei.findall(f".//{{{MEI_NS}}}measure")
    if len(found) != len(score.measures):
        sys.exit(f"the MEI has {len(found)} measures and its timemap {len(score.measures)}")
    return found


def parse_holds(score: Score, text: str) -> list[tuple[int, int]]:
    """Measures by @n, each with a staff or else its staves with lyrics, as (position, staff)."""
    by_n = {m.n: m.ordinal for m in score.measures}
    elements = mei_measures(score)
    holds = []
    for item in text.split(","):
        n, _, staff = item.strip().partition(":")
        if n not in by_n:
            sys.exit(f"--hold: no measure with @n {n}")
        staves = [staff] if staff else [s.get("n") for s in elements[by_n[n]].findall(f"{{{MEI_NS}}}staff")
                                         if s.find(f".//{{{MEI_NS}}}syl") is not None]
        if not staves:
            sys.exit(f"--hold: measure {n} has no staff with lyrics; give one, as {n}:1")
        holds += [(by_n[n], int(staff)) for staff in staves]
    return holds


def apply_holds(score: Score, holds: list[tuple[int, int]]):
    """Lets the notes of each held staff sound on through the rests of its measure, until the
    next note or the end of the measure, as the recording does."""
    elements = mei_measures(score)
    for ordinal, staff_n in holds:
        staff = next((s for s in elements[ordinal].findall(f"{{{MEI_NS}}}staff") if s.get("n") == str(staff_n)), None)
        if staff is None:
            sys.exit(f"--hold: measure {score.measures[ordinal].n} has no staff {staff_n}")
        notes = [n.get(XML_ID) for n in staff.iter(f"{{{MEI_NS}}}note") if n.get(XML_ID) in score.note_times]
        onsets = sorted({score.note_times[n][0] for n in notes})
        _, measure_end_seconds = measure_end(score, score.measures[ordinal])
        for note in notes:
            start, end = score.note_times[note]
            until = next((onset for onset in onsets if onset > start + 1e-6), measure_end_seconds)
            if until > end + 1e-6:
                pitch = score.toolkit.getMIDIValuesForElement(note)["pitch"]
                played = (abs(score.notes.start - start) < 0.002) & (score.notes.pitch == pitch)
                score.notes.loc[played, "duration"] = until - start


def fermata_measures(score: Score) -> list[str]:
    return [m.n for m, element in zip(score.measures, mei_measures(score))
            if element.find(f".//{{{MEI_NS}}}fermata") is not None or element.find(".//*[@fermata]") is not None]


def audio_features(audio: np.ndarray, tuning_offset: int):
    f_pitch = audio_to_pitch_features(f_audio=audio, Fs=SAMPLE_RATE, tuning_offset=tuning_offset,
                                      feature_rate=FEATURE_RATE)
    f_chroma = quantize_chroma(pitch_to_chroma(f_pitch=f_pitch))
    f_onsets = audio_to_pitch_onset_features(f_audio=audio, Fs=SAMPLE_RATE, tuning_offset=tuning_offset)
    f_dlnco = pitch_onset_features_to_DLNCO(f_peaks=f_onsets, feature_rate=FEATURE_RATE,
                                            feature_sequence_length=f_chroma.shape[1])
    return f_chroma, f_dlnco


def score_features(notes: pd.DataFrame):
    f_pitch = df_to_pitch_features(notes, feature_rate=FEATURE_RATE)
    f_chroma = quantize_chroma(pitch_to_chroma(f_pitch=f_pitch))
    f_onsets = df_to_pitch_onset_features(notes)
    f_dlnco = pitch_onset_features_to_DLNCO(f_peaks=f_onsets, feature_rate=FEATURE_RATE,
                                            feature_sequence_length=f_chroma.shape[1])
    return f_chroma, f_dlnco


def cens(f_chroma: np.ndarray, rate: int) -> np.ndarray:
    return quantized_chroma_to_CENS(f_chroma, FEATURE_RATE * 4 // rate + 1, FEATURE_RATE // rate, FEATURE_RATE)[0]


@dataclass
class Alignment:
    audio_seconds: np.ndarray
    score_seconds: np.ndarray

    def audio_time(self, score_seconds: float) -> float:
        return float(np.interp(score_seconds, self.score_seconds, self.audio_seconds))


def align(audio: np.ndarray, notes: pd.DataFrame, tuning_offset: int) -> tuple[Alignment, Alignment, int]:
    """The recording aligned with the notes twice: by their chroma and onsets, and by their
    chroma alone. Both are needed to tell where the first goes astray."""
    audio_chroma, audio_dlnco = audio_features(audio, tuning_offset)
    score_chroma, score_dlnco = score_features(notes)
    shift = compute_optimal_chroma_shift(cens(audio_chroma, 1), cens(score_chroma, 1))
    score_chroma = shift_chroma_vectors(score_chroma, shift)
    score_dlnco = shift_chroma_vectors(score_dlnco, shift)
    alignments = []
    for onsets in [(audio_dlnco, score_dlnco), (None, None)]:
        path = sync_via_mrmsdtw(f_chroma1=audio_chroma, f_onset1=onsets[0], f_chroma2=score_chroma,
                                f_onset2=onsets[1], input_feature_rate=FEATURE_RATE,
                                step_weights=STEP_WEIGHTS, threshold_rec=THRESHOLD_REC, verbose=False)
        path = make_path_strictly_monotonic(path)
        alignments.append(Alignment(path[0] / FEATURE_RATE, path[1] / FEATURE_RATE))
    return alignments[0], alignments[1], shift


def music_bounds(audio: np.ndarray) -> tuple[int, int]:
    """The samples where the music starts and ends. The alignment ties the ends of the
    score to the ends of the audio, so the silence or the surface noise of a record
    around the music would stretch the first and last measures into it."""
    hop = 512
    level = librosa.amplitude_to_db(librosa.feature.rms(y=audio, hop_length=hop)[0], ref=np.max)
    audible = np.flatnonzero(level > -SILENCE_DB)
    first, last = int(audible[0]), int(audible[-1])
    second = SAMPLE_RATE // hop
    usual = float(np.median(level[first:last + 1]))

    def music_edge(edge: np.ndarray, from_end: bool) -> int:
        noise = float(np.median(edge[-second:] if from_end else edge[:second]))
        if noise > usual - NOISE_MARGIN_DB:
            return last if from_end else first
        above = np.flatnonzero(edge > noise + ABOVE_NOISE_DB)
        if len(above) == 0:
            return last if from_end else first
        return first + int(above[-1] if from_end else above[0])

    start, end = music_edge(level[first:last + 1], False), music_edge(level[first:last + 1], True)
    return start * hop, min(len(audio), (end + 1) * hop)


def drifting(differences: list[float]) -> list[bool]:
    """Where the alignment by onsets has drifted from the one by chroma: in a stretch where
    at least DRIFT_MEASURES of DRIFT_WINDOW measures in a row are off the same way by more
    than DRIFT_SECONDS. The onsets may lock onto a lattice shifted from the music, as they
    did through a few measures of a 1928 recording, and the chroma then holds better.
    Differences scattered either way are the jitter of one alignment or the other, and
    there the one by onsets is usually right."""
    marked = [False] * len(differences)
    for start in range(len(differences)):
        window = range(start, min(start + DRIFT_WINDOW, len(differences)))
        for sign in (1, -1):
            off = [i for i in window if sign * differences[i] > DRIFT_SECONDS]
            if len(off) >= DRIFT_MEASURES:
                for i in range(off[0], off[-1] + 1):
                    marked[i] = marked[i] or sign * differences[i] > 0
    return marked


def measure_end(score: Score, measure: Measure) -> tuple[float, float]:
    """Quarters and seconds where the measure ends in the score."""
    if measure.ordinal + 1 < len(score.measures):
        following = score.measures[measure.ordinal + 1]
        return following.qstamp, following.seconds
    return score.quarters, score.seconds


def notes_between(score: Score, start: float, end: float, moved_to: float = 0.0) -> pd.DataFrame:
    notes = score.notes[(score.notes.start >= start - 1e-6) & (score.notes.start < end - 1e-6)].copy()
    notes["duration"] = np.minimum(notes.duration, end - notes.start)
    notes["start"] = notes.start - start + moved_to
    return notes


def ends_repeat(score: Score, measure: Measure) -> bool:
    following = score.measures[measure.ordinal + 1] if measure.ordinal + 1 < len(score.measures) else None
    return measure.right in ("rptend", "rptboth") or (following is not None and following.left == "rptboth")


def starts_repeat(score: Score, measure: Measure) -> bool:
    previous = score.measures[measure.ordinal - 1] if measure.ordinal > 0 else None
    return measure.left in ("rptstart", "rptboth") or (previous is not None and previous.right == "rptboth")


# A stretch of the score the recording plays straight through, by measure positions.
Pass = tuple[int, int]


def sections(score: Score) -> list[Pass]:
    starts = {0}
    for measure in score.measures:
        if measure.left in SECTION_BARLINES or starts_repeat(score, measure):
            starts.add(measure.ordinal)
        if measure.right in SECTION_BARLINES or ends_repeat(score, measure):
            starts.add(measure.ordinal + 1)
    starts = sorted(start for start in starts if start < len(score.measures))
    return list(zip(starts, [start - 1 for start in starts[1:]] + [len(score.measures) - 1]))


def repeats(score: Score) -> list[Pass]:
    found = []
    start = 0
    for measure in score.measures:
        if starts_repeat(score, measure):
            start = measure.ordinal
        if ends_repeat(score, measure):
            found.append((start, measure.ordinal))
            start = measure.ordinal + 1
    return found


def joined(stretches: list[Pass]) -> list[Pass]:
    passes: list[Pass] = []
    for first, last in stretches:
        if passes and passes[-1][1] + 1 == first:
            passes[-1] = (passes[-1][0], last)
        else:
            passes.append((first, last))
    return passes


def candidate_forms(score: Score) -> list[list[Pass]]:
    """The score with each repeat taken or not, and each section played or left out."""
    blocks, found = sections(score), repeats(score)
    most_left_out = len(blocks) if len(blocks) <= 8 else 2
    forms = {}
    for left_out in range(most_left_out):
        for omitted in itertools.combinations(range(len(blocks)), left_out):
            kept = [block for i, block in enumerate(blocks) if i not in omitted]
            for taken in itertools.product([False, True], repeat=len(found)):
                played = []
                for block in kept:
                    played.append(block)
                    for (start, end), take in zip(found, taken):
                        if take and block[1] == end:
                            played += [b for b in kept if start <= b[0] and b[1] <= end]
                form = joined(played)
                forms[tuple(form)] = form
    return list(forms.values())


def parse_form(score: Score, text: str) -> list[Pass]:
    by_n = {}
    for measure in score.measures:
        by_n.setdefault(measure.n, measure.ordinal)
    form = []
    for stretch in text.split(","):
        first, _, last = stretch.strip().partition("-")
        if first not in by_n or (last or first) not in by_n:
            sys.exit(f"--form: no measure with @n {first if first not in by_n else last}")
        form.append((by_n[first], by_n[last or first]))
    return joined(form)


def describe(score: Score, form: list[Pass]) -> str:
    return ", ".join(f"{score.measures[first].n}-{score.measures[last].n}" for first, last in form)


def form_notes(score: Score, form: list[Pass]) -> tuple[pd.DataFrame, list[tuple[float, float]]]:
    """The notes of the score played as the form says, and where each pass of it lies.
    verovio is not asked to expand the score, which it refuses to do with editorial
    markup: the stretches of its MIDI are laid one after the other."""
    stretches, spans, moved_to = [], [], 0.0
    for first, last in form:
        start, (_, end) = score.measures[first].seconds, measure_end(score, score.measures[last])
        stretches.append(notes_between(score, start, end, moved_to))
        spans.append((moved_to, moved_to + end - start))
        moved_to = spans[-1][1]
    return pd.concat(stretches).sort_values("start").reset_index(drop=True), spans


def rank_forms(score: Score, forms: list[list[Pass]], audio_chroma: np.ndarray) -> list[tuple[float, list[Pass]]]:
    """Each form with the cost of a coarse alignment of the whole recording with it,
    divided by the length of the path, cheapest first."""
    audio_cens = cens(audio_chroma, FORM_RATE)
    longest = max(forms, key=lambda form: sum(last - first for first, last in form))
    shift = compute_optimal_chroma_shift(cens(audio_chroma, 1), cens(score_chroma(form_notes(score, longest)[0]), 1))
    ranked = []
    for form in forms:
        form_cens = shift_chroma_vectors(cens(score_chroma(form_notes(score, form)[0]), FORM_RATE), shift)
        cost = librosa.sequence.dtw(X=form_cens, Y=audio_cens, metric="cosine", backtrack=False,
                                    step_sizes_sigma=np.array([[1, 1], [1, 0], [0, 1]]),
                                    weights_mul=np.array([2.0, 1.5, 1.5]))
        ranked.append((float(cost[-1, -1]) / (form_cens.shape[1] + audio_cens.shape[1]), form))
    return sorted(ranked, key=lambda entry: entry[0])


def score_chroma(notes: pd.DataFrame) -> np.ndarray:
    return quantize_chroma(pitch_to_chroma(f_pitch=df_to_pitch_features(notes, feature_rate=FEATURE_RATE)))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mei", type=Path)
    parser.add_argument("audio", type=Path)
    parser.add_argument("-o", "--output", type=Path,
                        help="the sync file to write; next to the audio, as <audio>.sync.json, by default")
    form_given = parser.add_mutually_exclusive_group()
    form_given.add_argument("--form", metavar="RANGES",
                            help="the form the recording follows, as ranges of measure @n: \"1-38,7-38,72-105\"")
    form_given.add_argument("--full", action="store_true", help="the recording plays the score straight through")
    parser.add_argument("--hold", metavar="MEASURES",
                        help="measures, by @n, where the recording holds the notes of a staff through its rests, "
                             "as \"39\" for its staves with lyrics, or \"39:2\" for staff 2")
    parser.add_argument("--refine", metavar="MEASURES",
                        help="measures, by @n, to anchor within as well, as \"37,40\": where the recording "
                             "lingers inside a measure and the ones found on their own are not enough")
    args = parser.parse_args()

    score = read_score(args.mei)
    refine = set(args.refine.split(",")) if args.refine else set()
    holds = parse_holds(score, args.hold) if args.hold else []
    apply_holds(score, holds)
    if refine - {m.n for m in score.measures}:
        sys.exit(f"--refine: no measure with @n {', '.join(sorted(refine - {m.n for m in score.measures}))}")
    audio, _ = librosa.load(args.audio, sr=SAMPLE_RATE, mono=True)
    sound_start, sound_end = music_bounds(audio)
    # Cut in whole seconds, the coarsest step of the alignment: any other cut shifts every
    # frame it analyses, and the places where it hesitates may come out otherwise. What
    # is left before the music is kept out of the first measure afterwards.
    music_start = (sound_start % SAMPLE_RATE) / SAMPLE_RATE
    sound_start -= sound_start % SAMPLE_RATE
    audio = audio[sound_start:sound_end]
    lead = sound_start / SAMPLE_RATE
    tuning_offset = estimate_tuning(audio, SAMPLE_RATE)

    if args.full:
        form = [(0, len(score.measures) - 1)]
    elif args.form:
        form = parse_form(score, args.form)
    else:
        forms = candidate_forms(score)
        if len(forms) == 1:
            form = forms[0]
        else:
            audio_chroma = quantize_chroma(pitch_to_chroma(audio_to_pitch_features(
                f_audio=audio, Fs=SAMPLE_RATE, tuning_offset=tuning_offset, feature_rate=FEATURE_RATE)))
            ranked = rank_forms(score, forms, audio_chroma)
            form = ranked[0][1]
            print(f"Tried {len(forms)} forms. The closest:", file=sys.stderr)
            for cost, candidate in ranked[:3]:
                print(f"  {cost:.4f}  {describe(score, candidate)}", file=sys.stderr)
            if ranked[1][0] - ranked[0][0] < 0.01 * ranked[0][0]:
                print("The first two are close: check by ear, and give the right one with --form.", file=sys.stderr)
    print(f"Form: {describe(score, form)}", file=sys.stderr)

    notes, spans = form_notes(score, form)
    by_onsets, by_chroma, shift = align(audio, notes, tuning_offset)

    anchors, corrected, lingering = [], [], []
    for p, ((first, last), (span_start, span_end)) in enumerate(zip(form, spans)):
        measures = score.measures[first:last + 1]
        moved = span_start - measures[0].seconds
        starts = [m.seconds + moved for m in measures]
        times = [by_onsets.audio_time(start) for start in starts]
        drifts = drifting([by_chroma.audio_time(start) - time for start, time in zip(starts, times)])
        if p == 0:
            # The noise left before the music confuses the alignment of the first measures:
            # up to the first one it puts well after the music starts, they keep an even pace.
            settled = next((i for i, time in enumerate(times) if time >= music_start + 1.0), 0)
            for i in range(settled):
                times[i] = music_start + (starts[i] - starts[0]) / (starts[settled] - starts[0]) * (times[settled] - music_start)
            retimed = set(range(settled))
        else:
            retimed = set()
        for i, drift in enumerate(drifts):
            if drift:
                times[i] = by_chroma.audio_time(starts[i])
                corrected.append(measures[i].n)
            if i > 0:
                times[i] = max(times[i], times[i - 1])
        # The alignment ends with the recording, whose last note rings on past its end in
        # the score: the end of the last pass is put where the pace of its last measure takes it.
        end_time = by_onsets.audio_time(span_end)
        if p == len(form) - 1 and len(starts) > 1:
            pace = (times[-1] - times[-2]) / (starts[-1] - starts[-2])
            end_time = min(times[-1] + (span_end - starts[-1]) * pace, len(audio) / SAMPLE_RATE)
        end_time = max(end_time, times[-1])
        end_quarters, _ = measure_end(score, measures[-1])

        # Between two anchors the viewer keeps an even pace, which misses a recording that
        # lingers within a measure: such a measure, much slower than those around it, is
        # anchored on every unit of its meter too, where the alignment by onsets puts them.
        quarters = [m2.qstamp - m1.qstamp for m1, m2 in zip(measures, measures[1:])] + [end_quarters - measures[-1].qstamp]
        ends, score_ends = times[1:] + [end_time], starts[1:] + [span_end]
        paces = [(end - time) / q if q > 0 else 0.0 for time, end, q in zip(times, ends, quarters)]
        pass_start = len(anchors)
        for i, measure in enumerate(measures):
            anchors.append({"time": round(times[i], 3), "measure": measure.ordinal, "n": measure.n})
            around = paces[max(0, i - LINGER_NEIGHBOURS):i] + paces[i + 1:i + 1 + LINGER_NEIGHBOURS]
            lingers = bool(around) and paces[i] > LINGER_RATIO * float(np.median(around))
            if i in retimed or not (lingers or measure.n in refine):
                continue
            lingering.append(measure.n)
            offset, previous = score.unit, times[i]
            while offset < quarters[i] - 1e-6:
                within = starts[i] + offset / quarters[i] * (score_ends[i] - starts[i])
                previous = min(max(by_onsets.audio_time(within), previous), ends[i])
                anchors.append({"time": round(previous, 3), "measure": measure.ordinal, "offset": offset, "n": measure.n})
                offset += score.unit
        if p > 0:
            # The viewer tells a jump by the end of one pass and the start of the next
            # sharing their time.
            anchors[pass_start - 1]["time"] = anchors[pass_start]["time"]
        anchors.append({"time": round(end_time, 3), "measure": measures[-1].ordinal,
                        "offset": end_quarters - measures[-1].qstamp, "n": measures[-1].n})
    for anchor in anchors:
        anchor["time"] = round(anchor["time"] + lead, 3)

    sync = {
        "version": 1,
        "score": {"measures": len(score.measures), "quarters": score.quarters},
        "anchors": anchors,
        **({"holds": [{"measure": measure, "staff": staff} for measure, staff in holds]} if holds else {}),
        "generator": {"tool": "score-viewer/tools/audio-sync/align.py", "audio": args.audio.name,
                      "form": describe(score, form), "tuningOffsetCents": int(tuning_offset),
                      "chromaShift": int(shift)},
    }
    output = args.output or args.audio.with_name(args.audio.stem + ".sync.json")
    output.write_text(json.dumps(sync, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(anchors)} anchors to {output}.", file=sys.stderr)
    if corrected:
        print(f"Measures {', '.join(corrected)}: the alignment by onsets drifted there, and the one by chroma "
              "was taken instead. Check them by ear.", file=sys.stderr)
    if lingering:
        print(f"Measures {', '.join(lingering)}: anchored within as well, where the recording lingers. "
              "Check them by ear.", file=sys.stderr)
    fermatas = fermata_measures(score)
    if fermatas:
        print(f"Fermatas in measures {', '.join(fermatas)}: where the recording holds a note through the rests "
              "after one, give the measure with --hold.", file=sys.stderr)


if __name__ == "__main__":
    main()
