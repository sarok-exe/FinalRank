const AI_KEY_STORAGE = 'finalrank_ai_key';

export type AiCoachConfig = { baseUrl: string; apiKey: string; model: string };

export function getAiApiKey(): string {
  try {
    return localStorage.getItem(AI_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setAiApiKey(key: string): void {
  try {
    if (key) {
      localStorage.setItem(AI_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(AI_KEY_STORAGE);
    }
  } catch {
    // localStorage unavailable — key is stored in-memory only for this session.
  }
}

type AiCoachContext = {
  san: string;
  classification: string;
  color: 'w' | 'b';
  ply: number;
  fromEval: number | null;
  toEval: number | null;
  bestSan: string | null;
  bestPv: string[];
};

export async function generateAiCoachNote(
  config: AiCoachConfig,
  ctx: AiCoachContext,
): Promise<string> {
  const side = ctx.color === 'w' ? 'White' : 'Black';
  const fromStr = ctx.fromEval != null ? `${ctx.fromEval >= 0 ? '+' : ''}${ctx.fromEval.toFixed(2)}` : 'unknown';
  const toStr = ctx.toEval != null ? `${ctx.toEval >= 0 ? '+' : ''}${ctx.toEval.toFixed(2)}` : 'unknown';

  const systemMsg = [
    'You are Kiruma, a concise chess coach.',
    'Given the context of a single move, write a 1–2 sentence note.',
    'Be concrete: mention the tactical or positional reason, avoid vague praise.',
    'Keep the tone direct and helpful. Match the user\'s language if detectable.',
  ].join(' ');

  const userMsg = [
    `Move: ${ctx.san} (${side}, ply ${ctx.ply}).`,
    `Classification: ${ctx.classification}.`,
    `Eval swing: ${fromStr} → ${toStr} (player perspective, pawns).`,
    ctx.bestSan ? `Engine best: ${ctx.bestSan}.` : '',
    ctx.bestPv.length > 0 ? `Best line: ${ctx.bestPv.join(' ')}.` : '',
    '',
    'Write a 1–2 sentence coaching note for this move.',
  ].filter(Boolean).join(' ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI coach request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('AI coach returned an empty response.');
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
