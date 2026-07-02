import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { inflateRawSync, unzipSync } from 'zlib';
import path from 'path';
import { getDb } from '@/lib/db';

// Pure-Node PDF text extractor — no worker, no bundling issues.
// Handles FlateDecode streams and uncompressed content streams.
async function extractPdfText(buf: Buffer): Promise<string> {
  const src = buf.toString('latin1');
  const texts: string[] = [];

  // Find all stream...endstream blocks
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;

  while ((m = streamRe.exec(src)) !== null) {
    const streamStart = m.index + m[0].indexOf('\n') + 1;
    // Look back for the object's dictionary to check /Filter
    const dictSrc = src.slice(Math.max(0, m.index - 800), m.index);
    const isFlate = /\/Filter\s*\/FlateDecode|\/Filter\s*\[.*?FlateDecode/s.test(dictSrc);
    const isText = /\/Subtype\s*\/Form|\/Type\s*\/XObject/.test(dictSrc) === false;

    let content = '';
    const rawBytes = Buffer.from(m[1], 'latin1');
    if (isFlate) {
      try { content = unzipSync(rawBytes).toString('latin1'); } catch {
        try { content = inflateRawSync(rawBytes).toString('latin1'); } catch { continue; }
      }
    } else {
      content = m[1];
    }

    // Extract text operators: (text)Tj, [(text)]TJ, and strings in BT blocks
    const btRe = /BT\s*([\s\S]*?)\s*ET/g;
    let bt: RegExpExecArray | null;
    while ((bt = btRe.exec(content)) !== null) {
      const block = bt[1];
      // Match (string)Tj and (string) in TJ arrays
      const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let s: RegExpExecArray | null;
      while ((s = strRe.exec(block)) !== null) {
        const decoded = s[1]
          .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\').replace(/\\\(/g, '(').replace(/\\\)/g, ')');
        if (decoded.trim()) texts.push(decoded);
      }
    }
  }

  return texts.join(' ');
}

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

  // Parse PDF text using pure Node.js (no worker/bundling issues)
  let parsedText = '';
  try {
    parsedText = await extractPdfText(buffer);
  } catch (err) {
    console.error('[upload] PDF parse error:', err);
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
