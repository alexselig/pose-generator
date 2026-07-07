# Pose Generator

Illustrated Character Pose Generator for Godot Games. Generate consistent, static pose sets for 2D game characters and export Godot-ready assets.

## Quick Start

```bash
cd pose-generator
npm install
```

Set your Gemini API key in `.env.local`:
```
GEMINI_API_KEY=your-key-here
```

Run the dev server:
```bash
npm run dev
```

Open http://localhost:3000

## Features

- **Character Gallery** — Save characters with descriptions, art style, colors, proportions
- **Reference Images** — Upload reference art for consistency
- **Game Presets** — Platformer, RPG, Fighting, Top-Down pose packs
- **AI Pose Generation** — Gemini-powered consistent pose generation
- **Review & Approve** — Lock approved poses, reject/flag issues, regenerate
- **Animation** — Generate looping sprite animations from a pose, hide/restore frames, approve, and export
- **Godot Export** — Transparent PNGs, pose sheets, sprite sheets, `SpriteFrames` resources, JSON manifests, zip packages

## Gemini API Setup

1. Get an API key from https://aistudio.google.com/apikey
2. Add to `.env.local` as `GEMINI_API_KEY=...`
3. The app uses `gemini-2.5-flash-image` for image generation
