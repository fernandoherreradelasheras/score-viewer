# TODO

## Improvements

- **Steadier anchors where the alignment hesitates.** A small change in what is analysed
  (cutting the start of the audio a fraction of a second) can move a single measure start
  by 0.5–4 s at places where the DTW hesitates. Align several times with the frames
  shifted (cuts at 0, ¼, ½ and ¾ s) and take the median of each anchor. Four times
  slower: about 30 min for Winterreise instead of 7.
- **Use the fermatas of the score.** In Winterreise 2 the measures with fermatas (10, 28,
  29, 38, 39) were exactly the ones heard as off. They could trigger anchors within the
  measure on their own, besides the measures found to linger, and point at `--hold`.
- **Validate the drift rule.** Taking the alignment by chroma where at least 4 of 6
  measures in a row differ from the one by onsets by more than 0.15 s the same way comes
  from a single example (Winterreise 1, m. 40–45). It now fires widely on the corpus (see
  below).
- **First and second endings** (`<ending>`) in the forms tried; da capo and dal segno
  that are not written as repeat barlines.
- **Pauses between measures**: the alignment spreads them over the measure before
  instead of writing two anchors on the same point of the score.
- **The start of the music**: the cut before the music is made in whole seconds, and the
  measures up to the first one aligned at least 1 s after the music starts keep an even
  pace. Revisit for music that starts with rubato.

## To check by ear

Corpus run of Winterreise (Hans Duhan, 1928), 2026-10-10.

- Measures taken from the alignment by chroma: 6 (m. 12–15), 7 (16–21), 9 (20–29),
  10 (25–39), 11 (34–37, 76–85), 12 (7–13, 39–44), 20 (68–77), 22 (5–20), 23 (7–12),
  24 (51–55).
- Measures that moved by more than 0.5 s from the previous run, either way: 5 (m. 75),
  7 (10), 10 (20–21), 11 (76), 12 (44), 14 (18, 38), 15 (6), 22 (8–9), 23 (17), 24 (31).
- The first and last measures of every song: the silence and the record noise around the
  music are now left out.
- Winterreise 2, m. 39, synced with `--hold 39`.
