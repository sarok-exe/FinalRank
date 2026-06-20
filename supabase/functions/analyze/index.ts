/**
 * Supabase Edge Function for remote Stockfish evaluation.
 *
 * Usage:
 *   POST /functions/v1/analyze
 *   Body: { fen: string, depth: number, multiPv: number }
 *   Returns: { lines: { evaluation: { type: 'cp'|'mate', value: number }, depth: number, pv: string[] }[] }
 *
 * Deploy:
 *   supabase functions deploy analyze --no-verify-jwt
 *
 * Environment variables (set via supabase secrets):
 *   - None required by default
 *
 * Stockfish WASM integration:
 *   Copy stockfish-17-lite-single.{js,wasm} into this directory,
 *   then import and initialize via Emscripten:
 *
 *   import createStockfish from './stockfish-17-lite-single.js';
 *   const sf = await createStockfish();
 *
 *   The WASM binary should be bundled alongside this function.
 */

interface EvalRequest {
  fen: string;
  depth: number;
  multiPv: number;
}

interface EvalResponse {
  lines: {
    evaluation: { type: 'cp' | 'mate'; value: number };
    depth: number;
    pv: string[];
  }[];
}

/**
 * Evaluate a chess position using Stockfish WASM.
 *
 * Replace the placeholder logic below with actual Stockfish integration:
 *
 *   const stockfish = await createStockfish();
 *   const lines = await new Promise((resolve) => {
 *     const results: any[] = [];
 *     stockfish.onmessage = (event) => {
 *       const msg = typeof event === 'string' ? event : event.data;
 *       if (msg.startsWith('bestmove')) resolve(results);
 *       if (msg.includes('multipv') && msg.includes('pv')) {
 *         results.push(parseUciLine(msg));
 *       }
 *     };
 *     stockfish.postMessage('uci');
 *     stockfish.postMessage('ucinewgame');
 *     stockfish.postMessage(`position fen ${fen}`);
 *     stockfish.postMessage(`go depth ${depth} multipv ${multiPv}`);
 *   });
 */
async function evaluatePosition(fen: string, depth: number, multiPv: number): Promise<EvalResponse['lines']> {
  // Placeholder: implement Stockfish WASM integration here
  return [
    {
      evaluation: { type: 'cp', value: 28 },
      depth,
      pv: ['e2e4', 'e7e5', 'g1f3'],
    },
  ];
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: EvalRequest = await req.json();

    if (!body.fen || typeof body.depth !== 'number') {
      return new Response('Missing fen or depth', { status: 400 });
    }

    const lines = await evaluatePosition(body.fen, body.depth, body.multiPv || 2);

    const response: EvalResponse = { lines };
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Evaluation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
