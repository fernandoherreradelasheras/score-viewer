# audio-sync

Drafts the [audio sync](../../README.md#audio-sync) file of a recording by aligning it
with its MEI score. The draft is meant to be checked by ear, above all where the output
says so: the form, when two come out close, and the measures where the alignment had to
be corrected.

## Setup

With [uv](https://docs.astral.sh/uv/), from this folder:

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

## Use

```bash
.venv/bin/python align.py score.mei recording.mp3
```

writes `recording.sync.json` next to the recording (`-o` names another file). Then name
it in the score's config:

```json
"audioFiles": [{ "file": "recording.mp3", "sync": "recording.sync.json" }]
```

Use the same MEI the viewer loads: the anchors point at its measures by position, and
the viewer warns when the file was made for a score with other measures or quarters.

### Repeats and sections left out

A recording need not play the score as written: it may take a repeat or not, and leave
out a section, as recordings made to fit a side of a record often do. The score is split
at its repeat signs and double barlines, every form those allow is aligned roughly with
the recording, and the closest is used. The three closest are printed:

```
Tried 47 forms. The closest:
  0.2303  1-105
  0.2304  1-38, 7-38, 71-105
  0.2385  7-105
The first two are close: check by ear, and give the right one with --form.
```

Strophes set to the same music can only be told apart by their words, so two forms may
come out this close; check which one the recording follows by ear.

- `--form 1-38,7-38,71-105` gives the form, as ranges of measure `@n`.
- `--full` says the recording plays the score straight through.

The sync then follows the recording through the repeats and past what it leaves out,
with a jump between passes. First and second endings are not handled yet.

### Measures the recording lingers in

Between two anchors the viewer keeps an even pace, which misses a singer who lingers on a
note within a measure. A measure much slower than those around it (1.6 times, by the
quarter, the median of the four on each side) is anchored on every unit of its meter as
well, an eighth in 6/8, where the alignment puts them; the measures are listed. Where a
measure needs it and is not found, name it:

- `--refine 37,40` anchors those measures, by `@n`, within as well.

A performer may also not keep what the score writes, as a singer holding a note through
the rest after it, often at a fermata; the measures with fermatas are listed as a hint.
The score is not to be changed for a recording, so the sync says it instead:

- `--hold 39` aligns as if the notes of the staves with lyrics in measure 39 sounded on
  through its rests, and writes it into the sync, for the viewer to highlight them so.
  `--hold 39:2` names the staff.

## How it works

verovio renders the score to MIDI and to a timemap with the options the viewer uses, so
both agree on the measures and quarters. The notes and the recording are turned into
chroma and onset (DLNCO) features and aligned with the multiresolution DTW of
[synctoolbox](https://github.com/meinardmueller/synctoolbox). The recording's tuning is
estimated, and the transposition that fits it best is tried, so a recording a semitone
or a third away from the score aligns as well.

The recording is aligned twice, by chroma and onsets and by chroma alone. The first is
the more precise, but its onsets may lock onto a lattice shifted from the music: through
a few measures of the 1928 recording in `test-fixtures/audio-sync` it ran some tenths of a
second ahead. Where at least 4 of 6 measures in a row differ between the two by more
than 0.15 s the same way, the measures are taken from the second, and listed. Scattered
differences either way are left to the first.

Before aligning, the silence around the music is left out, and so is the surface noise of a
record, where the first or last second of sound is much quieter than the rest: the
alignment ties the ends of the score to the ends of the audio, and would otherwise stretch
the first and last measures over them.

There is an anchor at the start of every measure of each pass, and one where the pass
ends. Where the recording pauses between two measures, the draft spreads the pause over
the measure before it instead of making it a pause: two anchors on the same point of the
score have to be set by hand.

Checked against recordings in `test-fixtures/multipage/` whose anchors are known:
`recording.mp3`, off the score's timing, is aligned with a mean error of about 20 ms per
anchor, except right after its 1.5 s pause; `multipage.mp3`, which takes the repeat, is
found to and aligned with a mean error of about 10 ms.
