import { NextResponse, type NextRequest } from 'next/server';
import { fromOff, OFF_FIELDS, type OffFood } from '@/lib/off';

/**
 * Proxies Open Food Facts: the search endpoint sends no CORS headers, and OFF asks
 * clients to identify themselves with a User-Agent, which browsers can't set.
 * `?q=` searches by name; a barcode (8–14 digits) looks up that one product.
 */
const UA = 'EasyTracking/0.1 (personal nutrition tracker)';
const DAY = 60 * 60 * 24;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ foods: [] });

  const barcode = /^\d{8,14}$/.test(q);
  const url = barcode
    ? `https://world.openfoodfacts.org/api/v2/product/${q}?fields=${OFF_FIELDS}`
    : `https://search.openfoodfacts.org/search?${new URLSearchParams({ q, page_size: '30', langs: 'en,de', fields: OFF_FIELDS })}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, next: { revalidate: DAY } });
  } catch {
    return NextResponse.json({ error: 'Open Food Facts could not be reached.' }, { status: 502 });
  }
  if (res.status === 429) return NextResponse.json({ error: 'Too many searches. Try again in a minute.' }, { status: 429 });
  if (barcode && res.status === 404) return NextResponse.json({ foods: [] });
  if (!res.ok) return NextResponse.json({ error: 'Open Food Facts search failed.' }, { status: 502 });

  const body = await res.json();
  const products = barcode ? [body.product] : (body.hits ?? []);
  const seen = new Set<string>();
  const foods: OffFood[] = [];
  for (const p of products) {
    const food = p && fromOff(p);
    if (!food) continue;
    const key = `${food.name}|${food.brand ?? ''}|${food.kcal}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    foods.push(food);
  }
  return NextResponse.json({ foods: foods.slice(0, 12) }, { headers: { 'Cache-Control': `public, max-age=${DAY}` } });
}
