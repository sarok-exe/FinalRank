/**
 * Cloudflare Pages Function for remote Stockfish evaluation.
 *
 * Usage:
 *   POST /analyze
 *   Body: { fen: string, depth: number, multiPv: number }
 *   Returns: { lines: { evaluation: { type: 'cp'|'mate', value: number }, depth: number, pv: string[] }[] }
 *
 * Deploy:
 *   1. Add wrangler.toml or configure via Cloudflare Dashboard
 *   2. Bundle with Stockfish WASM (e.g. @mlc-ai/web-stockfish or custom build)
 *   3. Set appropriate memory (256 MB+) and CPU (2+ cores) in wrangler.toml:
 *      [unsafe]
 *      bindings = [{ type = "wasm", name = "STOCKFISH_WASM", path = "../path/to/stockfish.wasm" }]
 *
 * Environment variables (set in Cloudflare Dashboard):
 *   - None required by default
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
 * Minimal Stockfish UCI wrapper for Cloudflare Workers.
 * Requires a Stockfish WASM module compiled for workerd.
 *
 * Integration example with @mlc-ai/web-stockfish or custom Emscripten build:
 *
 *   import stockfishInit from '../path/to/stockfish.js';
 *   const wasmBinary = ...; // loaded from env
 *   const sf = await stockfishInit({ wasmBinary });
 *   sf.postMessage('uci');
 *   // listen to sf.onmessage for UCI output
 *   // sf.postMessage(`position fen ${fen}`);
 *   // sf.postMessage(`go depth ${depth} multipv ${multiPv}`);
 */
async function evaluatePosition(fen: string, depth: number, multiPv: number): Promise<EvalResponse['lines']> {
  // Placeholder: implement Stockfish WASM integration here
  // Return mock lines to demonstrate the contract:
  return [
    {
      evaluation: { type: 'cp', value: 28 },
      depth,
      pv: ['e2e4', 'e7e5', 'g1f3'],
    },
    {
      evaluation: { type: 'cp', value: 10 },
      depth,
      pv: ['d2d4', 'd7d5', 'c2c4'],
    },
  ];
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: EvalRequest = await request.json();

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
}
