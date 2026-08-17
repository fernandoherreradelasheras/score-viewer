# Changelog

Incompatible changes on the 1.1.x line.

1.1.x is a development line: configuration keys, MEI conventions and the public API
may change without compatibility shims. Every such change is recorded here, newest
first. Ordinary fixes and additions are not — see the git log for those.

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
