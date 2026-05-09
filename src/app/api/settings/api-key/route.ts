import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Custom API keys are disabled. SyllaScan now uses the server-managed OpenAI key configured in the deployment environment.',
    },
    { status: 410 }
  );
}
