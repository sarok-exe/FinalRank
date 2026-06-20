interface Env {
  VITE_TURSO_DATABASE_URL?: string;
  VITE_TURSO_AUTH_TOKEN?: string;
}

export async function onRequest(context: { request: Request; env: Env; params: { id: string } }): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const shortId = context.params.id;
  if (!shortId) {
    return new Response(JSON.stringify({ error: 'Missing game id' }), { status: 400, headers });
  }

  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers });
  }

  try {
    const response = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql: 'SELECT game_data FROM shared_games WHERE short_id = ?',
              args: [shortId],
            },
          },
        ],
      }),
    });

    const result = await response.json<any>();
    const rows = result?.results?.[0]?.response?.result?.rows;

    if (rows && rows.length > 0) {
      const cell = rows[0];
      const raw = typeof cell === 'string' ? cell : (cell[0]?.value ?? cell[0]);
      const gameData = JSON.parse(raw);
      return new Response(JSON.stringify(gameData), { headers });
    }

    return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed' }), { status: 500, headers });
  }
}
