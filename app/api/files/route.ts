import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserByEmail, getUploadsForUser, getVariantSummaryForUser, getGeneSummaryForUser, getZygosityVariantsForUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await getUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const [uploads, summary, genes, zygVariants] = await Promise.all([
    getUploadsForUser(user.id),
    getVariantSummaryForUser(user.id),
    getGeneSummaryForUser(user.id),
    getZygosityVariantsForUser(user.id),
  ]);

  return NextResponse.json({ uploads, summary, genes, zygVariants });
}
