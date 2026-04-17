import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type'); // chongun | today
  const key = req.nextUrl.searchParams.get('key');    // e.g. 丙_申_酉

  if (!type || !key || !['chongun', 'today'].includes(type)) {
    return NextResponse.json(null, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'saju-cache', `${type}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    const entry = data[key];
    if (!entry) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(entry, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
