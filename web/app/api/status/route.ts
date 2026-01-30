import { NextResponse } from 'next/server';
import { calculateAvailability } from '@/lib/availability';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const availability = calculateAvailability(userId);

  return NextResponse.json(availability);
}
