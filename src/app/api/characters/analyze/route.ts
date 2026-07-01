import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { detectImageMimeType } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { imageBase64, name } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analyze this character image for a 2D video game. Extract the following details and respond in JSON format only (no markdown, no code fences):

{
  "description": "A detailed description of the character's appearance, role, and visual identity (2-3 sentences)",
  "artStyle": "The art style (e.g., anime, western cartoon, painterly, cel-shaded, watercolor, comic book, chibi, semi-realistic)",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "costumeDetails": "Detailed description of their outfit/clothing",
  "accessories": "Any accessories, weapons, or held items",
  "bodyProportions": "Body proportions description (e.g., chibi 2-3 heads tall, realistic 7-8 heads, heroic 8-9 heads)",
  "personalityNotes": "Inferred personality based on pose, expression, and design (e.g., confident, cheerful, mysterious)"
}

Character name for context: "${name || 'Unknown'}"

Be specific about colors — extract actual hex values from the image. Be descriptive but concise.`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: detectImageMimeType(imageBase64),
          data: imageBase64,
        },
      },
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON from response (handle potential markdown fences)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const analysis = JSON.parse(jsonStr);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing character:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to analyze character image: ${message}` },
      { status: 500 }
    );
  }
}
