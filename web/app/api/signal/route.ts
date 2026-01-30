import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, type, payload, timestamp } = body;

    if (!userId || !type) {
      return NextResponse.json({ error: 'Missing userId or type' }, { status: 400 });
    }

    const stmt = db.prepare('INSERT INTO signals (user_id, type, payload, timestamp) VALUES (?, ?, ?, ?)');
    stmt.run(userId, type, JSON.stringify(payload), timestamp || Date.now());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording signal:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
