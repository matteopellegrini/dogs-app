import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getDb, insertVariants, insertGeneRecords, insertZygosityVariants } from '@/lib/db';
import { parseVcf, parseSnpEffGenes, parseZygosityTsv } from '@/lib/vcf-parser';

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
  const dogId = formData.get('dogId') as string | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const name = file.name.toLowerCase();
  const isVcf = name.endsWith('.vcf');
  const isGenesTxt = name.includes('.genes.txt') || name.includes('genes.txt');
  const isTsv = name.endsWith('.tsv') || name.endsWith('.txt');

  if (!isVcf && !isTsv) {
    return NextResponse.json({ error: 'Supported formats: .vcf, .txt (.genes.txt), .tsv' }, { status: 400 });
  }

  const content = await file.text();
  const timestamp = Date.now();
  const safeName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, safeName);
  await writeFile(filePath, content);

  let fileType = isVcf ? 'vcf' : 'genes';

  const result = db
    .prepare(
      'INSERT INTO uploads (user_id, dog_id, filename, original_name, file_type, file_path) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(user.id, dogId ? parseInt(dogId) : null, safeName, file.name, fileType, filePath);

  const uploadId = result.lastInsertRowid as number;
  let recordCount = 0;

  if (isVcf) {
    const variants = parseVcf(content);
    if (variants.length > 0) {
      insertVariants(uploadId, user.id, variants);
      recordCount = variants.length;
    }
  } else if (isGenesTxt || content.includes('#GeneName')) {
    const genes = parseSnpEffGenes(content);
    if (genes.length > 0) {
      insertGeneRecords(uploadId, user.id, genes);
      recordCount = genes.length;
    }
  } else if (content.startsWith('CHROM\tPOS\tREF\tALT\tQUAL\tGENOTYPE\tZYGOSITY')) {
    const variants = parseZygosityTsv(content);
    if (variants.length > 0) {
      insertZygosityVariants(uploadId, user.id, variants);
      recordCount = variants.length;
      fileType = 'zygosity';
    }
  }

  return NextResponse.json({ ok: true, uploadId, recordCount, fileType });
}
