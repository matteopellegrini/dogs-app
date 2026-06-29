import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, getDogsForUser, createDog } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: number } | undefined;
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(getDogsForUser(user.id));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: number } | undefined;
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { name, breed, dob, notes } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const result = createDog(user.id, name, breed, dob, notes);
  return NextResponse.json({ id: result.lastInsertRowid });
}
