import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: number } | undefined;
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;
  const dogId = parseInt(id, 10);
  const body = await req.json();

  // Verify dog belongs to user
  const dog = db.prepare('SELECT id FROM dogs WHERE id = ? AND user_id = ?').get(dogId, user.id);
  if (!dog) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if ('notes' in body) { fields.push('notes = ?'); values.push(body.notes); }
  if ('name' in body)  { fields.push('name = ?');  values.push(body.name); }
  if ('breed' in body) { fields.push('breed = ?'); values.push(body.breed); }
  if ('dob' in body)   { fields.push('dob = ?');   values.push(body.dob); }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  values.push(dogId, user.id);
  db.prepare(`UPDATE dogs SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  return NextResponse.json({ ok: true });
}
