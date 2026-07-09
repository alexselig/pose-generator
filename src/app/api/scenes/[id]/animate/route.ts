import { NextResponse } from 'next/server';
import { getScene, saveScene, readSceneImage, saveSceneVideo } from '@/lib/scenes';
import {
  startSceneVideo,
  pollSceneVideo,
  downloadVeoVideo,
  buildSceneMotionPrompt,
  veoAspectRatio,
} from '@/lib/veo';

// Veo image-to-video is a long-running job (~1-3 min), so we never block on it:
// POST kicks off the render and stores the operation name; the client then polls
// GET until the mp4 has been downloaded to disk.
export const runtime = 'nodejs';
export const maxDuration = 120;

// Start animating the scene's still render into a short video clip.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const customPrompt =
      typeof body?.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : undefined;

    const scene = getScene(id);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }
    if (scene.status !== 'generated') {
      return NextResponse.json({ error: 'Generate the scene image before animating it.' }, { status: 400 });
    }
    const image = readSceneImage(scene.id);
    if (!image) {
      return NextResponse.json({ error: 'No scene image to animate yet.' }, { status: 400 });
    }

    const prompt = buildSceneMotionPrompt(scene, customPrompt);
    const operation = await startSceneVideo(
      image.toString('base64'),
      prompt,
      veoAspectRatio(scene.aspectRatio),
    );

    scene.videoStatus = 'generating';
    scene.videoOp = operation;
    scene.videoUpdatedAt = new Date().toISOString();
    saveScene(scene);

    return NextResponse.json(scene);
  } catch (error) {
    console.error('Error starting scene animation:', error);
    const scene = getScene(id);
    if (scene) {
      scene.videoStatus = 'failed';
      scene.videoOp = undefined;
      scene.videoUpdatedAt = new Date().toISOString();
      saveScene(scene);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to start animation: ${message}` }, { status: 500 });
  }
}

// Poll the in-flight render. When Veo finishes, download the mp4 to disk and
// flip the scene to 'generated'; otherwise return the scene unchanged.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const scene = getScene(id);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }
    if (scene.videoStatus !== 'generating' || !scene.videoOp) {
      return NextResponse.json(scene);
    }

    const result = await pollSceneVideo(scene.videoOp);
    if (!result.done) {
      return NextResponse.json(scene);
    }

    if (result.error || !result.videoUri) {
      scene.videoStatus = 'failed';
      scene.videoOp = undefined;
      scene.videoUpdatedAt = new Date().toISOString();
      saveScene(scene);
      return NextResponse.json({ ...scene, videoError: result.error || 'Veo returned no video' });
    }

    const video = await downloadVeoVideo(result.videoUri);
    const videoPath = saveSceneVideo(scene.id, video);
    scene.videoStatus = 'generated';
    scene.videoPath = videoPath;
    scene.videoOp = undefined;
    scene.videoUpdatedAt = new Date().toISOString();
    saveScene(scene);

    return NextResponse.json(scene);
  } catch (error) {
    console.error('Error polling scene animation:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to check animation: ${message}` }, { status: 500 });
  }
}
