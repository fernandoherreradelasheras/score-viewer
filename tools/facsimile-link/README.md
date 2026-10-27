# facsimile-link

Links every note and rest of the scores of a configuration to its position on the
facsimile images. The links are stored in the MEI itself (`<facsimile>` + `@facs`),
which is where the viewer reads them to highlight the facsimile during playback and to
show a note on the facsimile.

## Running it

From the root of the repository:

```bash
npm install                                    # once: the tool renders with the repository's verovio
SCORES_CONFIGURATION=path/to/config.json npm run facsimile-link   # → http://localhost:5178
```

`SCORES_CONFIGURATION` names the viewer's configuration file: its `scores`, their
`meiFile`, `facsimileItems` and `encodingProperties` are the tool's. The configuration
is read again on every request, so a new score or a new `part` apply without
restarting. Saving needs `xmllint` (libxml2), as `npm run validate:mei` does.

The MEI files are looked for in `basePath + path`, and the images in
`facsimileImagesPath`, resolved against the folder of the configuration when they are
relative. When they are not (a URL, or a path from the site root), the folder of the
configuration is used, and these variables say where the files are:

| Variable | |
|---|---|
| `SCORES_DIR` | Folder of the scores, where each `path` is. |
| `IMAGES_DIR` | Folder of the images, where each `facsimileItems[].file` is. |
| `PORT` | Port of the server, 5178 by default. |
| `MEI_SAVE_FILTER` | A command each saved MEI goes through before it is validated, given the file as its last argument, e.g. one that puts the attributes in the order of the project. It runs in the folder of the configuration; if it fails, nothing is written. |
| `STATE_DIR` | Where drafts and backups are kept (see below). |

When it starts, the server says how many MEI files and images it cannot find.

For the development scores of this repository:

```bash
SCORES_CONFIGURATION=assets/test.json SCORES_DIR=test-fixtures IMAGES_DIR=test-fixtures/facsimile npm run facsimile-link
```

### Without a configuration

A single MEI file whose images are all of the full score needs no configuration: give
the MEI file and its images, in order.

```bash
npm run facsimile-link -- path/to/score.mei path/to/page-1.jpg path/to/page-2.jpg
```

Each image is named by its path from the folder all of them are in, which is what
`graphic/@target` gets (`page-1.jpg`), and is labelled with its file name without the
extension. To show the images in the viewer, give them in `facsimileItems` with that
path, or with a longer one ending in it: the viewer finds the surface either way.
`PORT`, `MEI_SAVE_FILTER` and `STATE_DIR` apply as with a configuration.

## Screen

- **Top, the facsimile**: the image you work on. Zoom with the mouse wheel and click to
  place the current event.
- **Bottom, the score** (verovio, on a single system; the mdivs of a score one after
  another), drawn as in the source so it can be compared with the image: with the
  original clefs (the `<rdg>` of `<app type="app_clefs">`) and with the score's
  `encodedTransposition` undone (`-P4` is rendered `P4` up). The pitches in the status
  line are given the same way. The current event is in pink, linked events in blue and
  events that cannot be linked in grey. How the strip follows the current event is
  chosen in the selector next to *fit* (or with `m`), and remembered:
  - *read ahead* (default): the event sits at a quarter of the width, so the music to
    come is visible;
  - *centred*: the event is always in the middle;
  - *page turns*: the strip only moves when the event reaches the edge, then jumps so
    the event is near the left;
  - *under the facsimile*: the event sits right under its point on the image (or under
    the last placed point).
- **Header**: score selector (with the number of events already linked, and ✎ when
  there is a draft), current image and status line (part, event, measure, editorial
  markup, link, progress of the part and of the score).

## Keys

| Key | Action |
|---|---|
| `←` / `→` | previous / next event of the part |
| `↑` / `↓` | previous / next part, on the event that sounds at the same time |
| `n` | next unlinked event |
| click | place the current event (and advance) |
| `t` | the current event is the same figure as the previous one (again: its own figure) |
| `r` | unlink the current event |
| `z` / `x` | previous / next image of the current part |
| `Z` / `X` | previous / next image among all the score's images |
| wheel | zoom towards the cursor |
| space, ctrl or middle button + drag | pan the image |
| `0` | fit the image to the window |
| `m` | next strip mode |
| `a` | toggle auto-advance |
| `l` | autolink mode (below) |
| `,` / `.` (or `<` / `>`) | move the links of the current event and of the ones after it one event back / forward (below) |
| `u` | undo the last autolink or move of links |
| `s` or ctrl+s | save to the MEI |

Clicking on an event that is already linked moves its point (and the point of every
event sharing that figure).

## Autolink

On an image of a part (one with `part`; not on images of the full score), the notes and
rests can be located first and linked afterwards, all at once. *autolink* (or `l`) shows only the
image:

1. **Locate the notes and rests.** *detect whole page* (`d`) proposes a point (orange) on
   each note head it finds, replacing the points of the image. *detect in region* (`r`)
   asks for a rectangle (drag it; `Esc` cancels) and adds the heads found in it, keeping
   the points already there. Rests are not detected: add theirs by hand. Points already
   linked, in this score or in another one that shares the image, are not proposed
   again. Then correct them:

   | | |
   |---|---|
   | click | add a point (and drag it) |
   | drag | move a point |
   | click on a point | one more event on it (2, 3…): a sign for several measure rests |
   | shift+click | one event less on a point, or remove it |
   | shift+drag | remove the points in a rectangle, e.g. those of another score on the same page |
   | `z`/`x`, `Z`/`X` | image of the part, or of any part |
   | wheel, space, ctrl or middle button + drag, `0` | zoom, pan, fit |
   | `Esc` | back to the score, keeping the points |

2. **Link them.** *link* (`l`) reads the points staff by staff, top to bottom and left to
   right, and gives each one to the next unlinked note or rest of the part (measure
   rests included), in order. A tied note's continuation shares the point of the note it
   continues, so it needs none, and the events of a point with a number share it, as
   with `t`. The view goes back to the score, on the first event
   linked, to review it. Points left over (more points than events) stay on the image;
   `u` undoes the links the autolink made and gives its points back.

3. **Mend it.** If a point was too many or missing, the events after it are linked one
   point off. Go to the first wrong event and move the links of it and of the ones after
   it (as far as they are linked on the same image):
   - `,` (or `<`), back: each event takes the point of the next one. For a point too
     many on the current event; the last event is left unlinked.
   - `.` (or `>`), forward: each event takes the point of the previous one. For a
     missing point: the current event is left unlinked, to place it with a click. The
     last point goes to the event after them if it is unlinked; otherwise it is kept
     aside, and the next `,` on the image gives it to the event it would leave unlinked
     (a missing point and a point too many further on: `.` on the first wrong event,
     then `,` on the next one).

   Tied notes and the events of a point with a number go along with their point. `u`
   undoes the last move, then the autolink.

The detection works on the partbooks of the repertoire (hollow, hatched and black heads,
handwritten staves of any size, ink seen through the page) but is not perfect: it misses
some heads, takes some clefs, accidentals, custos and lyrics close to the staff for
heads, and a page may hold the end of another score. Every point must be right before
linking, rests included: one point too many or too few shifts all the events after it. The points located
and not linked are kept in the draft until the score is saved.

## What gets linked

Images and staves are tied to a part by the `xml:id` of its `<perfRes>`, as the viewer
ties them:

- each image of `facsimileItems` names its part in `part`;
- each `<staffDef>` of the score points at its part with `@decls`.

```json
{ "name": "Tenor página 77", "file": "T/image-077.jpg", "part": "perfRes-alto" }
```

```xml
<perfRes xml:id="perfRes-alto" source="#P-Lant_PT-TT-MUS-L122">Alto</perfRes>
…
<staffDef n="3" decls="#perfRes-alto" lines="5">
```

An image without `part` is of the full score: every part can be linked on it. Nothing
is guessed from labels, image names or the order of the staves: a `part` that is not a
perfRes, or a labelled staff without `@decls`, is reported and left out.
`npm run facsimile-link:check-parts` (`-- --all` for every image, `-- <score>…` for
some scores, by their `path` or the path of their MEI) lists what needs fixing.

The witness an image comes from matters only for the readings of an `<app>` (below).
It is the `@source` of its perfRes when the part has a single witness; when it has
several, the one whose siglum is in the image name, else the one that is a
`<source type="principal">`. An image of the full score is of the principal source, when
the MEI has only one. When the witness cannot be told and the MEI has readings with
`@source`, check-parts reports it.

```xml
<source xml:id="P-Ln_MM4802-1" type="principal">…</source>
<source xml:id="P-La_47-VI-11" type="complementary">…</source>
…
<perfRes xml:id="perfRes-tiple1" source="#P-Ln_MM4802-1 #P-La_47-VI-11">Tiple 1º</perfRes>
```

Notes and rests (`<rest>`, `<mRest>`) of the parts that have images can be linked,
except:

- material added by the editor (`<supplied>`);
- the correction or regularisation in a `<choice>` that keeps the source reading
  (`<sic>`, `<orig>`): that reading is linked instead;
- readings of an `<app>` whose witness (`@source`) has no images in the score, such as
  those of a complementary source. Readings whose witness does have images are only
  offered on those images.

Parts without images (a reconstructed part, for instance) are skipped when changing
part. A part on several staves, such as a piano, is gone through one staff at a time:
each of its staves is a part of its own (*Piano 1*, *Piano 2*).

A note tied to the next one is a single figure in the source, so when it is placed the
tie's continuation shares its point. Several measure rests that are a single sign in the
part are joined with `t`.

## What is written to the MEI

```xml
<music>
   <facsimile>
      <surface label="Tiple 1º página 8" lrx="1702" lry="2424">
         <graphic target="S1/image-008.jpg" width="1702px" height="2424px"/>
         <zone xml:id="zone-1" ulx="750" uly="1212" lrx="751" lry="1213"/>
      </surface>
   </facsimile>
   <body>
      …
      <note facs="#zone-1" dur="2" pname="c" oct="5"/>
      <note facs="#zone-1" dur="2" pname="c" oct="5"/>
```

- `graphic/@target` is `facsimileItems[].file` and `surface/@label` is its `name`: the
  viewer finds the surface of an image by either of them.
- Each zone is a point (1 px) in pixels of the original image, whose size is in
  `surface/@lrx`/`@lry`.
- Several events may point at the same zone.
- No `xml:id` is added: surfaces have none, zones are named `zone-<n>` (and keep their
  name from one save to the next), and an event without id is linked just with
  `@facs`. The tool finds such an event by its position among the notes and rests of
  the file.

The file is not rewritten as a whole: only the `<facsimile>` block and the `@facs`
attributes change. A `@facs` that was already there keeps its place among the
attributes; a new one goes after `xml:id`, or first. Before the MEI is replaced, a copy
goes through `MEI_SAVE_FILTER`, when given, and is checked with `xmllint` against the
MEI 5.1 schema of the repository (`schema/mei-all-5.1.rng`, or `MEI_RNG`). If the copy
does not validate, nothing is written, unless the original did not validate either.

## Drafts and backups

`.state/` (ignored by git) holds, in a folder for each configuration:

- `<score>.draft.json`: the unsaved work, every few seconds. Reopening the score offers
  to restore it.
- `<score>.prev.mei`: the version of the MEI before the last save.

If the MEI changes on disk while you work (after a `git pull`, for instance), saving is
refused and the work stays in the draft.

## Tests

```bash
npm run test:facsimile-link
```
