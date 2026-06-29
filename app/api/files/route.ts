import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, getUploadsForUser, getVariantSummaryForUser, getGeneSummaryForUser, getZygosityVariantsForUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as
    | { id: number }
    | undefined;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const uploads = getUploadsForUser(user.id);
  const summary = getVariantSummaryForUser(user.id);
  const genes = getGeneSummaryForUser(user.id);
  const zygVariants = getZygosityVariantsForUser(user.id);

  return NextResponse.json({ uploads, summary, genes, zygVariants });
}
