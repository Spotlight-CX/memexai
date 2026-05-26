import { NextResponse } from 'next/server';

type RoadmapInterestInput = {
  feature_id?: unknown;
  feature_title?: unknown;
  interest_type?: unknown;
  note?: unknown;
  email?: unknown;
  source_path?: unknown;
};

const maxNoteLength = 1000;
const maxEmailLength = 240;
const maxFieldLength = 160;

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  let input: RoadmapInterestInput;

  try {
    input = (await request.json()) as RoadmapInterestInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const featureId = cleanString(input.feature_id, maxFieldLength);
  const featureTitle = cleanString(input.feature_title, maxFieldLength);
  const note = cleanString(input.note, maxNoteLength);
  const email = cleanString(input.email, maxEmailLength);
  const sourcePath = cleanString(input.source_path, maxFieldLength) || '/roadmap';

  if (!featureId || !featureTitle) {
    return NextResponse.json({ ok: false, error: 'MISSING_FEATURE' }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'INVALID_EMAIL' }, { status: 400 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_ROADMAP_TABLE || process.env.AIRTABLE_ROADMAP_TABLE_ID;

  if (!apiKey || !baseId || !table) {
    return NextResponse.json(
      {
        ok: false,
        error: 'AIRTABLE_NOT_CONFIGURED',
        message: 'Roadmap interest capture is not configured yet. Please use Slack for now.',
      },
      { status: 424 },
    );
  }

  const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [
        {
          fields: {
            feature_id: featureId,
            feature_title: featureTitle,
            interest_type: cleanString(input.interest_type, maxFieldLength) || 'vote',
            note,
            email,
            source_path: sourcePath,
            created_at: new Date().toISOString(),
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let airtableError = '';
    try {
      const parsed = JSON.parse(body) as { error?: { type?: string; message?: string } };
      airtableError = parsed.error?.type ?? '';
    } catch {
      airtableError = '';
    }

    if (airtableError === 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND') {
      return NextResponse.json(
        {
          ok: false,
          error: 'AIRTABLE_CONFIG_INVALID',
          message:
            'Airtable could not find or access the configured base/table. Check PAT base access, AIRTABLE_BASE_ID, and AIRTABLE_ROADMAP_TABLE or AIRTABLE_ROADMAP_TABLE_ID.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'AIRTABLE_WRITE_FAILED',
        message: body.slice(0, 500) || `Airtable returned ${response.status}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
