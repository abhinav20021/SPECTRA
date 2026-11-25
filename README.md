# Visual Task Factory

Open `dist/index.html` in a modern browser or serve the directory as a static site. The downloadable `dist/visual-task-factory.html` edition runs offline, including the font and local evaluator.

## Present the demo

Click **Run three-skill demo**. Nine independently scored images cover three visual skills. Use **Next skill** to walk the audience through the original image, the edited image, the model's replies, and the verified answers. **Inspect checks** reveals the measured pixel regions. The scorecard includes accuracy and pair scores for each skill.

| Skill | Questions | Restyled image | Answer-changing edit |
| --- | --- | --- | --- |
| Chart reading | Highest or lowest regional sales | New colors and bar order | Swap the two competing values |
| Object counting | Count blue circles, orange triangles or all squares | Rearrange the objects and vary their shades and sizes | Add one matching object |
| Spatial reasoning | Identify the shape to the left, right, above or below the gold star | Vary colors, sizes and positions while preserving the neighbor relation | Exchange two neighbors |

Choose a skill card to explore that skill alone. Change the question, difficulty or batch size, make a prediction, compare variants, or replay a seed. Fine detail makes shapes smaller and increases counting-scene density. Close call separates chart contenders by one unit.

## Evaluation and evidence

A deterministic source scene supplies each answer. A separate full-resolution pixel reader measures bar heights and recognizes printed region labels. For shape scenes it detects connected colored components, identifies their shapes from silhouette geometry, and reads their colors and centroids. Each task enforces agreement and checks that the three variants have the expected relationship.

The offline baseline is specialized for the generated tasks. It uses 1,800 seeded nearest-neighbor training examples for chart ranking and low-resolution silhouette-template matching for scenes. It receives the rendered image and question. To evaluate an external vision-language model, choose the OpenAI evaluator and enter a compatible Chat Completions model ID and API key. Each request sends one PNG and question directly to OpenAI. API billing may apply. Keys stay in tab memory.

Accuracy is computed per image. Style robustness requires correct answers on the original and restyled images. Change sensitivity requires correct answers on the original and answer-changing edit. Completed runs and exact PNGs are saved in IndexedDB. Export a run to JSON to keep the images, source records, pixel evidence, model replies and scores. History supports the original chart-only reports.

## Code and verification

- `dist/engine.js` contains the chart pipeline, deterministic utilities and score functions.
- `dist/skills.js` defines the skill registry, scene generators, verifiers, baseline adapters and mixed tour.
- `dist/app.js` handles the interface, evaluation, replay and export.
- `tests/skills.test.cjs` verifies all nine question types, the paired-image invariants and deliberate pixel changes. Run `npm install` and `npm test` for these development checks. The app itself has no installation step.
- Run `python scripts/package.py` after changes to rebuild the offline edition and downloadable source bundle.
- The bundled Inter font uses the SIL Open Font License in `dist/fonts/LICENSE.txt`.
