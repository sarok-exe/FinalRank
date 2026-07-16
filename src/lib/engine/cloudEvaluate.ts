import { Chess } from 'chess.js';
import type { EngineLine} from '../../types';
import { EngineVersion } from '../../types';

type CloudEvalVariation = {
  moves: string;
  cp?: number;
  mate?: number;
}

type CloudEvalResponse = {
  fen: string;
  knodes: number;
  depth: number;
  pvs: CloudEvalVariation[];
}

export async function getCloudEvaluation(fen: string, multiPv = 2): Promise<EngineLine[]> {
  if (!fen?.includes(' ')) {
    return [];
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, 800);
  const res = await fetch(
      `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data: CloudEvalResponse = await res.json();
  const lines: EngineLine[] = [];

  for (const variation of data.pvs) {
    const board = new Chess(fen);
    const moveUcis = variation.moves.split(' ');
    const moves: { uci: string; san: string }[] = [];

    for (const uci of moveUcis) {
      try {
        const m = board.move(uci);
        moves.push({ uci: m.lan, san: m.san });
      } catch {
        break;
      }
    }

    lines.push({
      evaluation: {
        type: variation.mate !== undefined ? 'mate' : 'centipawn',
        value: variation.mate ?? variation.cp ?? 0,
      },
      source: EngineVersion.LICHESS_CLOUD,
      depth: data.depth,
      index: data.pvs.indexOf(variation) + 1,
      moves,
    });
  }

  return lines;
}
