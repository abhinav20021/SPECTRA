# Visual Task Factory

Visual Task Factory generates synthetic visual questions, validates their answers against encoded PNGs, and evaluates multimodal models on a frozen dataset. The Node.js framework runs locally or in CI. The browser studio provides an interactive presentation of the same task families.

## Wiring panel inspection

The flagship demo tests a practical decision: would a vision model clear a defective assembly? Every top-view wiring panel contains the same five inspection stations. Each question targets one station. The other four give the model realistic visual distractors within the diagram.

| Station | Reasoning skill | Visible change | Independent PNG check |
| --- | --- | --- | --- |
| J1 seating window | Geometric containment | Shift a plug across the window boundary | Compare the bounds of the cyan window and gold plug |
| J2 pin bank | Counting | Remove or restore a single fitted pin | Count distinct gold regions among six sockets |
| J3 paired contacts | Symmetry and pattern | Move one contact on one side while preserving the totals | Reflect detected contact centers across the marked axis |
| K1 keyed sockets | Sequence and transformation | Rotate one key in a four-socket sequence | Measure all four key directions and check every adjacent turn |
| NET continuity | Topological and graph reasoning | Cut or reconnect a short trace | Flood-fill gold pixels from S and test whether T belongs to the same component |

The pair can introduce or repair a fault. Which state appears first is determined by the seed. A style control changes the panel finish and gold tone while preserving the underlying assembly. Automated tests verify that the single edit changes pixels only inside the selected station. The pixel reader uses the fixture's calibrated inspection windows and receives no scene state, source graph, model output or answer label.

The frozen pilot contains 10 base cases (five skills at two difficulty settings), each rendered as three related images. Its 30 images include 13 defective and 17 conforming station instances. Report the sample sizes alongside any percentages. Increase the repeat count and vary the suite seed to test generalization. Performance on these synthetic diagrams is distinct from performance on factory photographs.

### Reproduce the inspection run

Use Node.js 22 or later. From the source directory:

```sh
npm ci
npm run inspection
```

The local baseline uses fixed image probes and runs without model downloads. An additional image-blind control always clears the station. It earns 17/30 correct on this suite and 0/10 correct original/edit pairs, and it misses all 13 defective cases. To score another model on the exact released inputs, extract `dist/downloads/inspection/dataset.zip` into a new directory and point `vtf evaluate` at it. The starter reports, every raw model reply, the stimuli, and the per-image keys are in the source archive. Open `dist/index.html` even offline to replay recorded trials. Use **Find a false clear** to locate a recorded single-edit pair where the model explicitly accepted a defective station. It checks the original and edited image in each group and prioritizes pairs where the model cleared both. After revealing the verdict, **Mark edit location** outlines the bounding box of the pixels that actually changed. Use **Link to this pair** to reopen the exact case. Choose **Generate a panel** for a new seeded panel evaluated by the fixed-probe baseline. Zoom crops are for display only. Each evaluated model received the complete panel.

The closed-choice runs use local llama.cpp build b12726, greedy decoding, seed 17, one image per request, and a grammar accepting exactly Yes/No or one of the seven legal pin counts. Only the question and PNG accompany the request. The free-response trial uses the OpenAI-compatible adapter, text followed by image, greedy generation and a 32-token server cap. It separately measures the ability to return a usable response. Prompt order and decoding both differ across these protocols. Compare model performance within the same protocol.

The recorded model weights come from [SmolVLM-256M](https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF/tree/b9e4379657e1450d04d02eec8e345667265b0a00), [SmolVLM-500M](https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/tree/72e986006ef53e37cdd3f6d4241c90b0f01df376), and [Qwen3-VL-2B-Instruct](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/tree/52d6c8ffea26cc873ac5ad116f8631268d7eb503). The SmolVLM language weights use Q8_0. Qwen uses Q4_K_M. All three use their matching Q8_0 vision projector.

For example, serve the downloaded Qwen weights and matching vision projector in one terminal, then evaluate the frozen dataset from another:

```sh
llama-server -m Qwen3VL-2B-Instruct-Q4_K_M.gguf \
  --mmproj mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf \
  --alias Qwen3VL-2B-Instruct-Q4_K_M --host 127.0.0.1 --port 8080 \
  --temp 0 --seed 17 -np 1 -c 4096

node framework/cli.cjs evaluate --dataset artifacts/inspection/dataset \
  --adapter ./adapters/panel-choice.cjs --model Qwen3VL-2B-Instruct-Q4_K_M \
  --out artifacts/qwen-panel --timeout-ms 160000
```

The packaged adapter defaults to port 8080. Set `PANEL_LLAMA_URL` for another local endpoint. Hosted multimodal models can use the existing `--adapter openai` path with their own credentials. The report shows per-image accuracy, paired edit and style scores, false clears among defective stations, false alarms among conforming stations, and unusable responses. A wrong count can correctly flag a defect while earning zero for the exact numeric question. Strict scoring treats explanations outside the requested answer format as unusable.

The automated workflow checks the existing general benchmark and the frozen inspection suite. The panel check fails when the reference baseline develops additional false clears or abstentions, or when any per-skill accuracy or pair score falls.

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

Open `dist/studio.html` to launch the general studio or `dist/visual-task-factory.html` for its single-file offline edition. **Run three-skill demo** presents nine images. **Inspect checks** reveals the evidence behind an answer. **Framework** links to the source, dataset and a completed example report.

`dist/engine.js` and `dist/skills.js` implement shared generation, verification and local baselines. `framework/` contains the Node runner, adapters, dataset IO and scoring. `npm test` exercises generated stimuli, checkpoint resumption, corrupted data, protocol payloads, provider errors, imports and regressions. Run `python scripts/package.py` after edits to rebuild the offline studio and downloadable source bundle. Inter's license is in `dist/fonts/LICENSE.txt`.
