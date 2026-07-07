import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { detectImageMimeType } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const { prompt, name, designReferences } = await request.json();

    if (!prompt || !name) {
      return NextResponse.json({ error: 'Prompt and name are required' }, { status: 400 });
    }

    // Design reference images (base64, no data: prefix) whose ART STYLE the
    // generated character should match.
    const refs: string[] = Array.isArray(designReferences)
      ? designReferences.filter((r: unknown): r is string => typeof r === 'string' && r.length > 0)
      : [];

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        // @ts-expect-error responseModalities is not in the SDK types yet
        responseModalities: ['image', 'text'],
      },
    });

    const styleClause = refs.length
      ? `\n\nSTYLE REFERENCE (CRITICAL): ${refs.length > 1 ? 'design reference images are' : 'a design reference image is'} attached above. Match that ART STYLE closely — the same linework weight, level of detail, shading/rendering technique, color treatment, and overall illustration language. Reproduce the STYLE, not the specific character: design a NEW character from the description in that same style.`
      : '';

    const fullPrompt = `Generate a character reference sheet illustration for a 2D video game character.

Character name: ${name}
Character description: ${prompt}

REQUIREMENTS:
- Full body character illustration on a transparent/white background
- Front-facing T-pose or neutral standing pose for reference
- Clear, clean illustrated style suitable for a 2D game
- Show the full character from head to toe
- Consistent proportions and clean linework
- The character should be well-lit and clearly visible
- Include enough detail to establish their visual identity (outfit, colors, accessories)
- Canvas size: 512x768 pixels
- No background elements, just the character${styleClause}`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (refs.length) {
      parts.push({ text: `Design/style reference image${refs.length > 1 ? 's' : ''} — match this art style:` });
      for (const r of refs) {
        parts.push({ inlineData: { mimeType: detectImageMimeType(r), data: r } });
      }
    }
    parts.push({ text: fullPrompt });

    const result = await model.generateContent(parts);
    const response = result.response;

    // Find image part in response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ error: 'No response from model' }, { status: 500 });
    }

    const responseParts = candidates[0].content.parts;
    for (const part of responseParts) {
      if ('inlineData' in part && part.inlineData) {
        return NextResponse.json({ imageBase64: part.inlineData.data });
      }
    }

    return NextResponse.json({ error: 'No image generated — model returned text only' }, { status: 500 });
  } catch (error) {
    console.error('Error generating character reference:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate character: ${message}` },
      { status: 500 }
    );
  }
}
