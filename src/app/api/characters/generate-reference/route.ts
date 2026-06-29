import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const { prompt, name } = await request.json();

    if (!prompt || !name) {
      return NextResponse.json({ error: 'Prompt and name are required' }, { status: 400 });
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        responseModalities: ['image', 'text'],
      } as any,
    });

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
- No background elements, just the character`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;

    // Find image part in response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ error: 'No response from model' }, { status: 500 });
    }

    const parts = candidates[0].content.parts;
    for (const part of parts) {
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
