# Scene Builder — Spec

## 1. Goal

Turn PoseForge from a single‑character **asset factory** into a **scene / key‑art
tool**. Let a user pick two or more existing characters, describe a context
(setting, mood, action, composition), and generate a single cohesive illustrated
**static scene** with those characters posed and interacting — on‑model and in a
shared art style.

Use cases: cutscene stills, dialogue shots, Steam capsule / promo art, cover art,
"party" line‑ups, storyboards.

## 2. User flow (v1)

1. Go to **/scenes**.
2. Multi‑select 2–4 characters from the library.
3. Write a **context** (e.g. "the two heroes stand back‑to‑back in a burning
   throne room at dusk, ready to fight").
4. Pick an **aspect ratio** (16:9, 1:1, 3:2, 9:16) and optionally a style note.
5. **Generate** → the scene appears in a review view.
6. **Regenerate** with an edited prompt, or **Approve**. Approved scenes live in
   a gallery and can be **downloaded** (PNG; later a zip with a manifest).

Review UX reuses the existing lightbox pattern (image + editable prompt +
regenerate + approve), so it feels identical to pose/animation review.

## 3. Non‑goals (v1)

- No in‑app compositing / drag‑to‑position (that's the v2 "composite" mode).
- No animated scenes.
- No backgrounds library / asset packs.
- No more than ~4 characters (identity degrades fast beyond that).

## 4. Data model

```ts
export interface Scene {
  id: string;
  name: string;                 // user label or derived from context
  characterIds: string[];       // participating characters
  characterNames: string[];     // denormalized for display + prompt
  context: string;              // the scene description the user wrote
  prompt?: string;              // last effective prompt (for regenerate/edit)
  aspectRatio: string;          // '16:9' | '1:1' | '3:2' | '9:16'
  styleNote?: string;           // optional shared-style override
  status: 'pending' | 'generating' | 'generated' | 'failed';
  approved?: boolean;
  imagePath?: string;           // data/scenes/images/<id>.png
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
}
```

Storage mirrors animations: slim JSON in `data/scenes/<id>.json` (no inlined
base64), image bytes in `data/scenes/images/<id>.png`, served by URL with an
`?v=<updatedAt>` cache‑buster.

## 5. Generation approaches

The core difficulty is **multi‑character identity consistency**: image models
blend, merge, or drop subjects when asked for several at once. Three modes,
shipped in order:

### Mode A — Single‑shot (v1, this prototype)
One `gemini-2.5-flash-image` call. Each character's canonical **reference image**
is provided as an input part and named in the prompt; the model composes them
into one scene. Best interaction + lighting cohesion; weakest identity control.

### Mode B — Composite / blocking (v2)
Reuse the existing **pose pipeline** to render each character on a transparent
canvas (identity is already guaranteed and on‑model), then `sharp`‑composite the
cut‑outs onto a generated or uploaded background at user‑chosen position / scale /
z‑order. Deterministic identity; stiffer, no true interaction or shared lighting.
Reuses the sprite‑compositing code already in `animations.ts` / `export.ts`.

### Mode C — Hybrid (v3, recommended end state)
Use Mode B as **layout/blocking**, then run a single **unify pass** (img2img over
the composite) to harmonize lighting, shadows, and contact while positions stay
anchored by the composite. Best of both; the differentiator.

## 6. Prompt design (identity lock for N characters)

Key ideas, extending the single‑character prompt (`buildCharacterPrompt`) and the
palette‑lock learnings already used for reference generation:

- Provide **one reference image per character**, each preceded by a labeled text
  part: `Reference image for CHARACTER 1 "<name>":`.
- In the main prompt, enumerate the cast explicitly and bind each to its
  reference + stored traits:
  `CHARACTER 1 — <name>: <description/outfit/colors/accessories> (match reference 1 exactly).`
- **Identity lock**: "Reproduce each named character to match their own reference
  image — same face, hair, skin tone, outfit, colors, accessories, proportions.
  Do NOT merge, swap, or blend characters or their outfits."
- **Style lock**: one shared illustrated art style + coherent palette + lighting
  across all characters and the background (avoid per‑character style drift).
- **Composition**: honor the user context for staging, then defaults — full
  bodies visible, believable relative scale, characters interacting per the
  scene, single unified background, target aspect ratio.
- **Count discipline**: "Exactly N characters, no extras, no duplicates, no
  crowd."

## 7. API surface

```
POST   /api/scenes                 create a scene (characterIds, context, name, aspectRatio, styleNote) -> pending
GET    /api/scenes                 list scenes (slim)
GET    /api/scenes/[id]            scene detail
POST   /api/scenes/[id]/generate   run generation (optional { prompt }) -> generated | failed
GET    /api/scenes/[id]/image      serve the PNG (cache-busted by ?v=updatedAt)
PATCH  /api/scenes/[id]            set { approved } (v1.1)
DELETE /api/scenes/[id]            remove scene + image (v1.1)
```

`runtime = 'nodejs'`, `maxDuration = 120` on the generate route (sharp + a full
model round‑trip), matching the animation route.

## 8. UI

- **/scenes** — builder + gallery in one page for v1:
  - Character multi‑select (cards/checkboxes from `GET /api/characters`).
  - Context textarea, aspect‑ratio segmented control, optional style note.
  - Generate button (disabled < 2 selected).
  - Result panel with the scene image + editable prompt + Regenerate + Approve.
  - Gallery of prior scenes (thumbnail, cast, download).
- **Sidebar**: add a "Scenes" nav link under "Gallery".
- Styling: Maison tokens (`--canvas`, `--accent`, `--font-display/body/mono`,
  `--border`, `--surface`, `--radius-btn/input`), consistent with existing pages.

## 9. Consistency risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Characters blended/merged | Per‑character reference parts + explicit "do not blend" + fewer characters |
| A character dropped | Explicit "exactly N characters" + enumerate all in prompt |
| Style drift between characters | Single shared style+palette+lighting lock |
| Wrong relative scale | Ask for believable scale; v2 composite gives exact control |
| Identity still imperfect | Escalate to Mode B/C (composite / hybrid) |

The prototype exists precisely to measure how bad the identity problem is at 2
characters before investing in B/C.

## 10. Milestones

1. **v1 (prototype):** Mode A single‑shot, `/scenes` builder + gallery, download PNG.
2. **v1.1:** approve + delete + PATCH, aspect‑ratio‑correct canvas, scene manifest + zip export.
3. **v2:** Mode B composite (reuse pose cut‑outs + background gen + sharp layout).
4. **v3:** Mode C hybrid unify pass.

## 11. Open questions

- Background: always generated, or allow "transparent characters only" output for
  external compositing?
- Which reference per character — the canonical reference, or a user‑chosen
  approved pose (e.g. an action pose that better fits the scene)?
- Do scenes belong to a character/group, or live in their own top‑level gallery?
  (v1: top‑level.)
