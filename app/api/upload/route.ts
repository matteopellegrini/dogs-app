import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as
    | { id: number }
    | undefined;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const sample = (formData.get('sample') as string | null) ?? '';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Parse PDF text
  let parsedText = '';
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const parsed = await pdfParse(buffer);
    parsedText = parsed.text;
  } catch {
    // Store without parsed text if parsing fails
  }

  const timestamp = Date.now();
  const safeName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, safeName);
  await writeFile(filePath, buffer);

  const result = db
    .prepare(
      'INSERT INTO uploads (user_id, filename, original_name, file_type, file_path, parsed_text, sample) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(user.id, safeName, file.name, 'pdf', filePath, parsedText || null, sample || null);

  return NextResponse.json({ ok: true, uploadId: result.lastInsertRowid, fileType: 'pdf' });
}
