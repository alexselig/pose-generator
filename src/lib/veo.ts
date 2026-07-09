import { Scene } from './types';

// Veo (image-to-video) is reached over plain REST on the Gemini API. The old
// @google/generative-ai SDK has no video support, so we call predictLongRunning
// directly with the AI Studio key. Flow: start -> poll operation -> download mp4.
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// "lite" is the cheapest tier (~$0.40 for an 8s clip) so an accidental click is
// low-cost; set VEO_MODEL=veo-3.1-fast-generate-preview (balanced, ~$1.20) or
// veo-3.1-generate-preview (top quality, ~$3.20) for higher fidelity.
const VEO_MODEL = process.env.VEO_MODEL || 'veo-3.1-lite-generate-preview';

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return key;
}

// Veo only renders landscape (16:9) or portrait (9:16); map the scene's aspect
// ratio to the nearest supported orientation.
export function veoAspectRatio(sceneAspect: string): '16:9' | '9:16' {
  return sceneAspect === '9:16' || sceneAspect === '3:4' ? '9:16' : '16:9';
}

// Build a motion prompt that animates the still scene without redesigning its
// characters, composition, or art style. A custom prompt overrides the default.
export function buildSceneMotionPrompt(scene: Scene, custom?: string): string {
  if (custom && custom.trim()) return custom.trim();
  const ctx = scene.context?.trim();
  return [
    'Bring this illustrated scene to life with subtle, cinematic motion.',
    'Keep every character, the composition, the colors, and the art style EXACTLY as in the starting image — do not redesign anyone and do not add or remove characters.',
    'Add gentle, natural movement: small character gestures and breathing, drifting particles, flickering light, and swaying cloth, hair, foliage or water, with a slow atmospheric camera drift.',
    ctx ? `Scene: ${ctx}.` : '',
    'Slow, looping-friendly, no cuts, no on-screen text.',
  ].filter(Boolean).join(' ');
}

// Start an image-to-video render. The image is the first frame; the prompt
// describes the motion. Returns the long-running operation name.
export async function startSceneVideo(
  imageBase64: string,
  prompt: string,
  aspectRatio: '16:9' | '9:16',
): Promise<string> {
  const res = await fetch(`${BASE_URL}/models/${VEO_MODEL}:predictLongRunning`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{
        prompt,
        image: { bytesBase64Encoded: imageBase64, mimeType: 'image/png' },
      }],
      parameters: { aspectRatio },
    }),
  });
  if (!res.ok) {
    throw new Error(`Veo start failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.name) throw new Error('Veo did not return an operation name');
  return data.name as string;
}

export interface VeoPollResult {
  done: boolean;
  videoUri?: string;
  error?: string;
}

// Poll a long-running operation by name.
export async function pollSceneVideo(operationName: string): Promise<VeoPollResult> {
  const res = await fetch(`${BASE_URL}/${operationName}`, {
    headers: { 'x-goog-api-key': apiKey() },
  });
  if (!res.ok) {
    throw new Error(`Veo poll failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.done) return { done: false };
  if (data.error) {
    return { done: true, error: data.error.message || 'Veo generation failed' };
  }
  const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) return { done: true, error: 'Veo finished but returned no video' };
  return { done: true, videoUri: uri };
}

// Download the finished mp4 bytes (the URI needs the same API key header).
export async function downloadVeoVideo(videoUri: string): Promise<Buffer> {
  const res = await fetch(videoUri, {
    headers: { 'x-goog-api-key': apiKey() },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Veo download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
