import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail, initSchema } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email, name, password } = await req.json();
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  await initSchema();
  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }
  await createUser(email, name, password);
  return NextResponse.json({ ok: true });
}
