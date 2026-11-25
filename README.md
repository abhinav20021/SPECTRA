# Visual Task Factory

Visual Task Factory generates synthetic visual questions, validates their answers against encoded PNGs, and evaluates multimodal models on a frozen dataset. The Node.js framework runs locally or in CI. The browser studio provides an interactive presentation of the same task families.

## Run a first benchmark

Use Node.js 22 or newer. From the extracted project root:

```sh
npm ci
npm run benchmark
```

This command runs the bundled local baseline. It generates 54 images, validates each source and pixel answer, evaluates one image per request, and writes `artifacts/smoke/run/report.html` and `report.json`. Open the HTML file directly. The saved dataset is under `artifacts/smoke/dataset`. A repeated run uses `npm run benchmark -- --resume`. Choose a different output directory for a new run.

```sh
node framework/cli.cjs pipeline --suite suites/expanded.json --out artifacts/expanded
```

The expanded suite produces 540 images. A suite specifies a seed, families, difficulties and repeats per question/difficulty combination. Every combination generates an original, a restyled image whose answer stays fixed, and an edited image whose answer changes. One repetition covers 9 question types × 2 difficulty levels × 3 variants.

| Family | Questions | Answer-changing edit |
| --- | --- | --- |
| Chart reading | Highest or lowest regional sales | Swap the two competing values |
| Object counting | Count blue circles, orange triangles or all squares | Add one matching object |
| Spatial reasoning | Identify the shape left, right, above or below a gold star | Exchange two neighbors |

## Separate generation from inference

```sh
node framework/cli.cjs generate --suite suites/smoke.json --out artifacts/frozen
node framework/cli.cjs verify --dataset artifacts/frozen
node framework/cli.cjs evaluate --dataset artifacts/frozen --adapter local --out artifacts/local
```

Generation stages files in a temporary directory and publishes the dataset after verification. It preserves an existing output directory. The PNG and JSONL files use SHA-256 digests. A bundled font and pinned renderer support reproducible generation on the same platform. Use the exact frozen corpus across machines and models. The manifest fingerprint also includes the suite and generator revision.

| File | Contents |
| --- | --- |
| `dataset.json` | Suite definition, generator revision, counts, hashes, fingerprint and default quality gates |
| `public/tasks.jsonl` | Opaque sample ID, image path, question and PNG hash |
| `public/images/*.png` | Image stimuli for inference |
| `private/answers.jsonl` | Seed, group, question type, variant, reference answer, source scene and independent pixel measurements |

Only the public directory is needed to run inference elsewhere. Each built-in adapter receives the image and question. The verifier reopens the exported PNG, measures bars or connected colored objects, derives the answer, and checks source/pixel agreement and the three-variant relationships. The checks detect corruption and inconsistent data. A digest supplies integrity, and does not authenticate a dataset publisher.

## Evaluate a live model

Set `OPENAI_API_KEY` in your environment and choose a vision-capable Chat Completions model ID. An optional `OPENAI_BASE_URL` selects a compatible service, including a localhost inference server. Credentials go to the configured endpoint. The runner never writes the API key into its outputs.

```sh
node framework/cli.cjs evaluate --dataset artifacts/frozen --out artifacts/live \
  --adapter openai --model YOUR_MODEL_ID --concurrency 2 --timeout-ms 60000 --retries 2
```

Each request has one PNG and its question. Transient connection failures, timeouts, throttling and selected server errors receive bounded retries. Authentication and model-configuration errors stop new dispatches. Responses already received remain in atomic per-image checkpoints. Re-run with the same arguments plus `--resume` to retry outstanding errors. Valid model responses, including wrong or unparseable answers, are reused. Resume checks the dataset fingerprint, adapter identity, model ID and scoring revision. Use a new output directory or a new model identifier for changed weights served behind the same model alias.

The default concurrency is one. A single-writer lease protects each output directory. After an abrupt process termination the lease can take about 30 seconds to expire. A request interrupted after the provider accepted it but before the response checkpoint was saved may be issued again.

## Evaluate other runtimes

Python, hosted and offline systems can read the public tasks and export one JSON object per line. Copy the sample ID from the task manifest:

```json
{"id":"COPY_THE_SAMPLE_ID","response":"West"}
```

```sh
node framework/cli.cjs score --dataset artifacts/frozen --predictions predictions.jsonl \
  --model my-model-v1 --out artifacts/imported
```

Scoring joins by ID, rejects duplicates and unknown IDs, and marks missing responses as incomplete. A sample file is included at `dist/downloads/sample-predictions.jsonl`.

A trusted local JavaScript adapter can export the following interface. Select it with `--adapter ./my-adapter.cjs`. Its file hash participates in checkpoint identity. Honor the abort signal and version any external dependencies or model revisions in the adapter ID.

```js
exports.id = 'my-model-v1';
exports.predict = async ({png, question}, {signal, model}) => {
  // png is a Buffer. Return the model's raw text response.
  return myVisionClient.answer({image: png, prompt: question, signal, model});
};
```

## Scoring and CI

Reports include all raw responses, parsed answers, expected answers, per-image outcomes, attempt counts for executed requests, and breakdowns by skill, question type, difficulty and image variant. The HTML report embeds up to six failed images for inspection. Coverage counts responses received. Unavailable and unparseable responses earn no credit. A provider failure produces an incomplete run even if its accuracy clears the configured gates.

- **Accuracy** is correct images divided by all planned images.
- **Style robustness** requires both original and restyled responses to be correct.
- **Change sensitivity** requires both original and edited responses to be correct.

Set minimum fractions in the suite's `gates` object. Supported keys include `accuracy`, `style`, `change` and family-qualified versions such as `counting.accuracy`. The starter's 0.35 accuracy threshold is a smoke-test setting. Choose thresholds for your own models and sample sizes.

```sh
node framework/cli.cjs compare --baseline artifacts/local/report.json \
  --candidate artifacts/live/report.json --max-drop 0.05 --out artifacts/comparison.json
```

Comparison requires two complete reports for the same dataset and scoring protocol. It checks overall and per-family accuracy and both pair scores, and lists individual sample IDs that improved or regressed. A drop tolerance of 0.05 means five percentage points. Exit codes are **0** for pass, **1** for a quality-gate failure and **2** for invalid input, infrastructure errors or incomplete evaluation.

The included GitHub Actions workflow runs the test suite, evaluates the local adapter on the checked-in frozen corpus, compares it with the reference report and uploads results. It runs without a provider key. The small checked-in suite is intended to exercise the pipeline. Use additional seeds and repetitions to estimate broader model performance.

## Interactive studio and source

Open `dist/index.html` to launch the studio or `dist/visual-task-factory.html` for its single-file offline edition. **Run three-skill demo** presents nine images. **Inspect checks** reveals the evidence behind an answer. **Framework** links to the source, dataset and a completed example report.

`dist/engine.js` and `dist/skills.js` implement shared generation, verification and local baselines. `framework/` contains the Node runner, adapters, dataset IO and scoring. `npm test` exercises generated stimuli, checkpoint resumption, corrupted data, protocol payloads, provider errors, imports and regressions. Run `python scripts/package.py` after edits to rebuild the offline studio and downloadable source bundle. Inter's license is in `dist/fonts/LICENSE.txt`.
