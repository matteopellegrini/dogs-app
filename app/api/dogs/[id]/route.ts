import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserByEmail, getDogById, updateDog } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await getUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;
  const dogId = parseInt(id, 10);
  const body = await req.json();

  const dog = await getDogById(dogId, user.id);
  if (!dog) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await updateDog(dogId, user.id, {
    notes: 'notes' in body ? body.notes : undefined,
    name:  'name'  in body ? body.name  : undefined,
    breed: 'breed' in body ? body.breed : undefined,
    dob:   'dob'   in body ? body.dob   : undefined,
  });

  return NextResponse.json({ ok: true });
}
