# Visual Task Factory

Open dist/index.html in a modern browser or serve dist as a static directory. The downloadable single-file edition works offline. No installation or API key is required for the local demo.

## Demo

1. Select a question, difficulty and run size. A run evaluates the original stimulus, a restyled version and a value-swapped version independently.
2. Inspect the verification strip to compare the source values and measured bar heights. Each chart passes a printed label check as well.
3. Run the local vision baseline, or enter an OpenAI API key and the ID of a vision-capable Chat Completions model. Live requests go directly from the tab to api.openai.com and may incur charges. The key is never written to browser storage or to a report.
4. Try Close call on a five-challenge batch. The two competing bars differ by one unit. Inspect per-image hits and missed pairs in the results.
5. Export a completed run to JSON, including all PNGs, verified answers, measured heights, prompts and raw responses. Completed runs are stored in this browser's IndexedDB, up to the most recent 25.

## Source

- dist/engine.js implements the deterministic generator, raster renderer, independently computed pixel answer, baseline and pair metrics.
- dist/app.js implements the UI, provider adapter, batch runner, report export and history.
- dist/index.html and dist/style.css contain the interface. Inter is bundled under its SIL Open Font License.

The offline baseline is a nearest-neighbor classifier over coarse image features. It uses 1,800 fixed seeded training examples and an image-based label recognizer. It is specialized for this chart layout. The full-resolution verifier scans the actual colored spans and reads printed labels separately from the source table. Live vision models receive only one PNG and its question per request.

Scores are exact-label accuracy across images, joint correctness on original/restyled pairs, and joint correctness on original/value-swapped pairs. Interrupted or failed provider calls do not generate a completed score.
