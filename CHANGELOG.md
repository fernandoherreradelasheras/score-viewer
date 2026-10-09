# Changelog

Incompatible changes on the 1.1.x line.

1.1.x is a development line: configuration keys, MEI conventions and the public API
may change without compatibility shims. Every such change is recorded here, newest
first. Ordinary fixes and additions are not — see the git log for those.

## 1.1.16

### MEI conventions

- An editorial accidental (`<accid func="edit">`) is written on every note it affects,
  even when the same note repeats within the measure:

  ```xml
  <note pname="b" oct="4"><accid accid="f" func="edit" enclose="paren"/></note>
  <note pname="b" oct="4"><accid accid="f" func="edit" enclose="paren"/></note>
  ```

  With "normalize ficta" on, they are turned into ordinary accidentals the way those are
  encoded: the first one of each pitch and octave in a measure is shown, and the ones
  repeating it become `@accid.ges`, so they still sound but are not drawn again. A
  different accidental on the same note is shown and replaces it for the rest of the
  measure, and an editorial accidental repeating an ordinary one already shown is
  `@accid.ges` too. Each staff keeps its own accidentals. The readings of an `<app>`,
  `<choice>` or `<subst>` are alternatives, so none of them carries its accidentals into
  another, and what follows them continues from the first one.

  Until now every editorial accidental was shown after normalizing, so a measure
  repeating a ficta drew the same accidental on each note.

### Interaction

- A note of the score is shown on the facsimile with Ctrl+click (Cmd+click on macOS)
  instead of a plain click, which is left to the editorial dialog. The link now works
  the other way too: Ctrl/Cmd+click on a note of the facsimile turns to its page in the
  score and frames it there. The "Show note on the facsimile on click" setting, renamed
  "Link score and facsimile with Ctrl+click", turns on both directions.
- The frame that points out a note, on the score or on the facsimile, fades out after
  two seconds instead of staying until the next click.

### API

- `scoreSvg` and `setScoreSvg` are removed from the store returned by `useStore`. Nothing
  was setting them.

## 1.1.15

### Configuration

- `settings.initialTab` is added: the tab the viewer opens on while the reader has not
  chosen one yet, `"intro"`, `"text"` or `"music"`. Once the reader picks a tab, that
  choice is stored and takes precedence over this setting. When the current score does
  not have the configured tab, the music is shown.

  It is optional, and leaving it out keeps the previous behaviour: the viewer opens on
  the music. Any other value is reported as a configuration error.

- `facsimileItems[].part` is added: the `xml:id` of the `<perfRes>` whose part the image
  shows. An image without it is taken for the full score. While the player runs, the
  facsimile follows a part onto its next image, and when the images cover more than one
  part the facsimile can show all of them side by side, each with its own pages. It is
  optional; any value other than a string is reported as a configuration error.

### MEI conventions

- Notes and rests whose `@facs` points at a `<zone>` of the `<facsimile>` are marked on
  the image beside the score in split view, while they sound and, with the new "Show
  note on the facsimile on click" setting, when they are clicked. A config image is
  matched to its `<surface>` by the `<graphic>@target` (either may be a trailing part of
  the other path), or else by the surface `@label` against the image `name`.

- A part is linked to its staves through `<staffDef @decls="#perfRes-id">`.

## 1.1.13

### Browser support

- The score, the player, the text sections and the settings run on Chrome 88, Edge 88,
  Firefox 78 and Safari 14 (iOS 14) or newer. `build.target` is pinned to those browsers
  so that a Vite upgrade cannot raise the floor on its own, and antd 6 wraps its runtime
  styles in `:where()`, which needs the same versions.

- Text and introduction sections used to need Chrome 93, Firefox 92 or Safari 15.4, since
  react-markdown calls `Object.hasOwn` without checking for it. It is now defined where
  the browser lacks it, and they work down to the floor above.

- Editorial highlighting needs `:has()`, which raises its own floor to Chrome 105,
  Safari 15.4 (iOS 15.4) and Firefox 121. Below those versions nothing errors and the
  score, the player and the text still work, but an intervention drawn within the lyrics
  is not ringed on the score and its tooltip does not reach it, and hovering a reading
  does not widen its ring. Everything else (the ring of a whole variant group, the mark
  left by a reading opened from the score information, and the poem laid out around its
  longest verse) works all the way down to the floor above.


### Packaging

- antd is upgraded to 6 and stays bundled, as does `@ant-design/icons` 6. Applications
  styling score-viewer through antd's own class names have to follow its renames: the
  containers holding the score are now `.ant-tabs-body-holder`, `.ant-tabs-body-top` and
  `.ant-tabs-content-active`.

- `Object.hasOwn` is defined on the page when the browser does not have it, which is a
  global the component did not touch before.

- The bundled type declarations now carry the `verovio` module augmentation, which adds
  the optional `svgContentBoundingBoxes`, `svgAria`, `expandNever` and `expandAlways`
  options to `VerovioOptions`.

## 1.1.9

### MEI conventions

- The readings of an `<app>` are selected by the variant group they classify under.
  A group is a `<category>` declared in `<classDecls>`, and each reading points at it
  with `@class`:

  ```xml
  <encodingDesc>
     <classDecls>
        <taxonomy xml:id="variant-groups">
           <category xml:id="vgrp-tiple1-c9-14">
              <label>Tiple 1º, cc. 9-14</label>
              <desc>El Cancionero Poético-Musical Hispánico de Lisboa da al tiple 1º
              una melodía distinta desde el compás 9 hasta el 14.</desc>
           </category>
        </taxonomy>
     </classDecls>
  </encodingDesc>

  <app xml:id="av-c9">
     <lem class="#vgrp-tiple1-c9-14" source="#P-Ln_MM4802-1"> ... </lem>
     <rdg class="#vgrp-tiple1-c9-14" source="#P-La_47-VI-11"> ... </rdg>
  </app>
  ```

  Every `<app>` whose readings point at the same category is one editorial decision:
  choosing a reading in any of them switches all of them at once. That is what a
  variant spanning several measures, or the same variant across voices, needs — until
  now each `<app>` was selected on its own and only the one the reader clicked changed.

  When an `<app>` offers several readings of the same group, `@n` is what pairs each
  one with its counterpart in the other `<app>` elements of the group, and without it
  only the first reading of the group can be reached:

  ```xml
  <rdg n="1" class="#vgrp-tiple1-c9-14" source="#P-La_47-VI-11"> ... </rdg>
  <rdg n="2" class="#vgrp-tiple1-c9-14" source="#P-La_47-VI-12"> ... </rdg>
  ```

  The `<label>` of the category names the decision in the tooltip and in the dialog
  title, and its `<desc>` is shown the way an `<annot>` would be, so a group no longer
  needs an annotation attached to it just to explain itself.

  `@label` on a reading takes no part in selection or grouping. It is a display string,
  and verovio renders it as an SVG `<title>` that the browser shows as a tooltip, so a
  grouping token written there leaked into the interface.

  On a score with no taxonomy nothing breaks: readings are then selected one by one by
  `@xml:id`, which is the previous behaviour, so grouped `<app>` elements switch
  separately. A `@class` pointing at a category that is not declared is ignored — and
  MEI's own Schematron rules reject it, so the encoding is checked by `npm run
  validate:mei:schematron`.

### API

- `ScoreProperties.categories` is added: the terms declared in `<classDecls>`, keyed by
  `xml:id`, each with its `label` and `desc`.
- `Option.categoryId` is added: the variant group a reading belongs to, or `null` when
  it stands on its own.

## 1.1.6

### MEI conventions

- The global apparatus is selected by `@type`, never by `@label`. Both the readings
  and the `<app>` containing them must carry the type:

  ```xml
  <app type="app_clefs">
     <lem type="app_clefs" corresp="#sd.initial"/>
     <rdg type="app_clefs"> ... </rdg>
  </app>

  <app type="dissonant_analysis">
     <lem/>
     <rdg type="dissonant_analysis"> ... </rdg>
  </app>
  ```

  `@label` is a display string, and verovio renders it as an SVG `<title>` that the
  browser shows as a tooltip, so the token leaked into the interface.

  On a score still encoding `label="app_clefs"`, the original clefs option no longer
  finds the apparatus, and an `<app>` without `@type` is listed as an editorial
  choice instead of being handled as a display option.

- The heading of a poem block is taken from the `@label` of the `<lg>` itself, not
  from a `<label>` child element:

  ```xml
  <lg type="coplas" label="Coplas glosadas" corresp="#coplas">
  ```

  Blocks without `@label` keep falling back to their capitalized `@type`, so only
  the ones that were overriding the heading with a `<label>` child are affected.

### API

- `ScoreProperties.hasEditorial` is renamed to `hasEditorialInterventions`, and now
  reports only what score-viewer presents as an editorial intervention: the global
  apparatus and everything inside it no longer counts, since original clefs and
  harmonic analysis are display options.
- `ScoreProperties.hasHarmonicAnalysis` is added, next to the existing
  `hasOriginalClefs`.

## 1.1.5

- `ScoreProperties.reconstructionBy` is exposed again, after being dropped in 1.1.4.

## 1.1.4

### Configuration

- `audioBaseFile` and the overlay tracks are replaced by `audioFiles[]`, a list of
  alternative tracks selectable from the UI. Overlay audio support is removed.

### API

- `ScoreProperties.reconstructionBy` is dropped. Restored in 1.1.5.

## 1.1.2

### MEI conventions

- Text annotations are read as children of the `<l>` they annotate, which is what the
  MEI 5.1 schema validates:

  ```xml
  <l>que tiran volantes pías,
     <annot type="text-note">pía: El caballo o yegua, cuya piel es manchada de varios
     colores, como a remiendos. (Diccionario de autoridades, 1737)</annot>
  </l>
  ```

  The previous encoding did not validate against the schema and is no longer read.

## 1.1.0

### Configuration

- The `text` and `textCommentsFile` properties of a score are ignored: the poetic text
  and its notes are read from the MEI `<back>` block. A warning is logged while they
  are still present in a configuration.
