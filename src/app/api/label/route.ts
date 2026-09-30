import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { LabelReading, toPer100 } from '@/lib/label';

/**
 * Reads a nutrition label photo with Claude and returns per-100 g/ml values.
 * Body: { image: base64 JPEG (no data: prefix) }. With Supabase storage, requires the
 * signed-in user's access token, so only users of the app can spend API credits.
 */
export const maxDuration = 60;

const MAX_BASE64 = 4_000_000; // ~3 MB image; the browser sends a resized JPEG well under this

const SYSTEM = `You read nutrition labels from photos of food packaging and transcribe the nutrition table.
Transcribe numbers exactly as printed; do not convert or calculate anything.
If the label has a per 100 g or per 100 ml column, use that column. Only use per-serving values when there is no per-100 column, and then also give the serving size.
Use null for a value that is not on the label or cannot be read. Use "<0.5"-style values as the number shown (0.5).
Labels may be in any language (e.g. German: Brennwert, Eiweiß, Kohlenhydrate, davon Zucker, Fett, Ballaststoffe, Salz).`;

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_STORAGE === 'supabase') {
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return NextResponse.json({ error: 'Sign in to scan labels.' }, { status: 401 });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: 'Sign in to scan labels.' }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Label scanning is not set up yet (missing ANTHROPIC_API_KEY).' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!image || image.length > MAX_BASE64) return NextResponse.json({ error: 'Send one photo under 3 MB.' }, { status: 400 });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium', format: betaZodOutputFormat(LabelReading) },
      // If a safety classifier declines, retry on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: 'Transcribe the nutrition table on this label.' },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return NextResponse.json({ error: 'The label could not be read. Try another photo.' }, { status: 422 });
    }
    const result = toPer100(response.parsed_output);
    if ('error' in result) return NextResponse.json(result, { status: 422 });
    return NextResponse.json(result);
  } catch (err) {
    console.error('label scan failed', err);
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Too many scans right now. Try again in a minute.' }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'Label scanning is misconfigured (API key rejected).' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Label scanning failed. Try again.' }, { status: 502 });
  }
}
