import type { EngineLine} from '../../types';
import { EngineVersion } from '../../types';
import { Chess } from 'chess.js';

const CLOUDFLARE_EVAL_URL = import.meta.env.VITE_CLOUDFLARE_EVAL_URL || '';
const SUPABASE_EVAL_URL = import.meta.env.VITE_SUPABASE_EVAL_URL || '';

export function isCloudflareEvalConfigured(): boolean {
  return !!CLOUDFLARE_EVAL_URL;
}

export function isSupabaseEvalConfigured(): boolean {
  return !!SUPABASE_EVAL_URL;
}

type RemoteEvalRequest = {
  fen: string;
  depth: number;
  multiPv: number;
}

type RemoteEvalLine = {
  evaluation: { type: 'cp' | 'mate'; value: number };
  depth: number;
  pv: string[];
}

type RemoteEvalResponse = {
  lines: RemoteEvalLine[];
}

async function parseRemoteResponse(
  response: Response,
  fen: string,
  source: string,
): Promise<EngineLine[]> {
  if (!response.ok) throw new Error(`remote eval failed (${response.status})`);
  const data: RemoteEvalResponse = await response.json();
  return data.lines.map((line, i) => {
    const board = new Chess(fen);
    const moves = line.pv.map(uci => {
      try {
        const m = board.move(uci);
        return { uci: m.lan, san: m.san };
      } catch {
        return { uci, san: uci };
      }
    });
    return {
      evaluation: {
        type: line.evaluation.type === 'mate' ? 'mate' : 'centipawn',
        value: line.evaluation.value,
      },
      source,
      depth: line.depth,
      index: i + 1,
      moves,
    };
  });
}

export async function getCloudflareEvaluation(
  fen: string,
  depth: number,
  multiPv = 2,
): Promise<EngineLine[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
  try {
    const res = await fetch(CLOUDFLARE_EVAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth, multiPv } satisfies RemoteEvalRequest),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return parseRemoteResponse(res, fen, EngineVersion.STOCKFISH_18_LITE);
  } catch {
    clearTimeout(timeoutId);
    throw new Error('cloudflare eval failed');
  }
}

export async function getSupabaseEvaluation(
  fen: string,
  depth: number,
  multiPv = 2,
): Promise<EngineLine[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
  try {
    const res = await fetch(SUPABASE_EVAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth, multiPv } satisfies RemoteEvalRequest),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return parseRemoteResponse(res, fen, EngineVersion.STOCKFISH_18_LITE);
  } catch {
    clearTimeout(timeoutId);
    throw new Error('supabase eval failed');
  }
}
