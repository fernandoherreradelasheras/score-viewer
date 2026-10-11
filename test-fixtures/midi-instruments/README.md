# Fixture: MIDI instruments

Checks the instrument each staff gets in the synthesized MIDI audio (see "MIDI audio" in
the README). Each staff plays alone for two measures, in order, so each instrument can
be told apart by ear; the last two measures are a tutti.

| Measures | Staff | What it checks | Expected sound |
|---|---|---|---|
| 1–2 | 1 "Parte 1", with lyrics | lyrics make a voice, whatever the label | voice (KBH) |
| 3–4 | 2 "Tenor", no lyrics, down to A2 | a voice named by the label; below C3, FluidR3's voice | voice |
| 5–6 | 3 "Arpa" | an instrument named by the label | harp |
| 7–8 | 4 "Violín" | a label with accents | violin |
| 9–10 | 5 "Flauta" with `<instrDef midi.instrnum="68">` | the `instrDef` over the label | oboe, not flute |
| 11–12 | 6 "Bajo continuo" | "continuo" before "bajo", a voice | piano |
| 13–14 | 7–8, brace labelled "Órgano", no labels of their own | the label of the `<staffGrp>` | organ |
| 15–16 | 9, no label, no lyrics | the default | piano |
| 17–18 | all | staves 4 and 6 are declared again before the tutti, without label: they keep their instrument | — |
