# Changelog

Incompatible changes on the 1.1.x line.

1.1.x is a development line: configuration keys, MEI conventions and the public API
may change without compatibility shims. Every such change is recorded here, newest
first. Ordinary fixes and additions are not — see the git log for those.

## Unreleased

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
