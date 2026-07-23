import { Chess } from 'chess.js';
import type { EngineLine, Evaluation} from '../../types';
import { STARTING_FEN } from '../../types';
const STOCKFISH_SINGLE = 'stockfish-18-lite-single.js';

const uciEvaluationTypes: Record<string, string | undefined> = {
  cp: 'centipawn',
  mate: 'mate',
};

export class Engine {
  private worker: Worker;
  private version: string;
  private position = STARTING_FEN;
  private evaluating = false;

  constructor(version: string = STOCKFISH_SINGLE) {
    this.worker = new Worker('/engines/' + version);
    this.version = version;
    this.worker.postMessage('uci');
    this.setPosition(this.position);
  }

  private consumeLogs(
    command: string,
    endCondition: (logMessage: string) => boolean,
    onLogReceived?: (logMessage: string) => void,
  ): Promise<string[]> {
    const logMessages: string[] = [];
    const worker = this.worker;
    return new Promise((res, rej) => {
      function onMessageReceived(event: MessageEvent) {
        const message = String(event.data);
        onLogReceived?.(message);
        logMessages.push(message);
        if (endCondition(message)) {
          worker.removeEventListener('message', onMessageReceived);
          worker.removeEventListener('error', onError);
          res(logMessages);
        }
      }
      function onError() {
        worker.removeEventListener('message', onMessageReceived);
        worker.removeEventListener('error', onError);
        rej(new Error('worker error'));
      }
      worker.addEventListener('message', onMessageReceived);
      worker.addEventListener('error', onError);
      worker.postMessage(command);
    });
  }

  onMessage(handler: (message: string) => void) {
    this.worker.addEventListener('message', event => { handler(String(event.data)); });
    return this;
  }

  onError(handler: (error: string) => void) {
    this.worker.addEventListener('error', event => { handler(String(event.error)); });
    return this;
  }

  terminate() {
    this.worker.postMessage('quit');
    this.worker.terminate();
  }

  setOption(option: string, value: string) {
    this.worker.postMessage(`setoption name ${option} value ${value}`);
    return this;
  }

  setLineCount(lines: number) {
    this.setOption('MultiPV', lines.toString());
    return this;
  }

  setThreadCount(threads: number) {
    this.setOption('Threads', threads.toString());
    return this;
  }

  setPosition(fen: string, uciMoves?: string[]) {
    this.worker.postMessage('ucinewgame');
    if (uciMoves?.length) {
      this.worker.postMessage(`position fen ${fen} moves ${uciMoves.join(' ')}`);
      const board = new Chess(fen);
      for (const uciMove of uciMoves) {
        try { board.move(uciMove); } catch { break; }
      }
      this.position = board.fen();
      return this;
    }
    this.worker.postMessage(`position fen ${fen}`);
    this.position = fen;
    return this;
  }

  /** Set position without sending ucinewgame — avoids aborting an idle engine */
  setPositionQuiet(fen: string, uciMoves?: string[]) {
    if (uciMoves?.length) {
      this.worker.postMessage(`position fen ${fen} moves ${uciMoves.join(' ')}`);
      const board = new Chess(fen);
      for (const uciMove of uciMoves) {
        try { board.move(uciMove); } catch { break; }
      }
      this.position = board.fen();
      return this;
    }
    this.worker.postMessage(`position fen ${fen}`);
    this.position = fen;
    return this;
  }

  async evaluate(options: {
    depth: number;
    goMode?: 'depth' | 'time';
    timeLimit?: number;
    onEngineLine?(line: EngineLine): void;
  }): Promise<EngineLine[]> {
    const engineLines: EngineLine[] = [];
    const goCommand = options.goMode === 'time' && options.timeLimit
      ? `go movetime ${options.timeLimit}`
      : `go depth ${options.depth}${options.timeLimit ? ` movetime ${options.timeLimit}` : ''}`;
    this.evaluating = true;
    await this.consumeLogs(
      goCommand,
      log => log.startsWith('bestmove'),
      log => {
        if (!log.startsWith('info depth')) return;
        if (log.includes('currmove')) return;
        const depth = parseInt((/(?<= depth )\d+/.exec(log))?.[0] || '');
        if (isNaN(depth)) return;
        const index = parseInt((/(?<= multipv )\d+/.exec(log))?.[0] || '') || 1;
        const scoreMatches = / score (cp|mate) (-?\d+)/.exec(log);
        const evaluationType = uciEvaluationTypes[scoreMatches?.[1] || ''];
        if (evaluationType !== 'centipawn' && evaluationType !== 'mate') return;
        let evaluationScore = parseInt(scoreMatches?.[2] || '');
        if (isNaN(evaluationScore)) return;
        if (this.position.includes(' b ')) evaluationScore = -evaluationScore;
        const moveUcis = (/ pv (.*)/.exec(log))?.at(1)?.split(' ') || [];
        const moveSans: string[] = [];
        const board = new Chess(this.position);
        for (const moveUci of moveUcis) {
          try { moveSans.push(board.move(moveUci).san); } catch { break; }
        }
        const newEngineLine: EngineLine = {
          depth,
          index,
          evaluation: { type: evaluationType, value: evaluationScore },
          source: this.version,
          moves: moveUcis.map((uci, i) => ({ uci, san: moveSans[i] || uci })),
        };
        engineLines.push(newEngineLine);
        options.onEngineLine?.(newEngineLine);
      },
    );
    this.evaluating = false;
    return engineLines;
  }

  async stopEvaluation() {
    this.worker.postMessage('stop');
    if (this.evaluating) {
      await this.consumeLogs('', log => log.includes('bestmove'));
    }
    this.evaluating = false;
  }

  async getBestMove(fen: string, depth: number): Promise<string | null> {
    this.setPosition(fen);
    const lines = await this.evaluate({ depth });
    const top = getTopEngineLine(lines);
    return top?.moves?.[0]?.uci || null;
  }
}

export function getTopEngineLine(lines: EngineLine[]) {
  return lines.reduce<EngineLine | undefined>((best, line) =>
    !best || line.depth - line.index > best.depth - best.index ? line : best,
    undefined
  );
}

export function getLineGroupSibling(lines: EngineLine[], referenceLine: EngineLine, index: number) {
  return lines.find(line =>
    line.depth === referenceLine.depth && line.source === referenceLine.source && line.index === index
  );
}
