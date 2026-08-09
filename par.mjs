import 'dotenv/config';
import { createClient } from '@libsql/client';
const url = process.env.VITE_TURSO_DATABASE_URL.replace(/^libsql:\/\//, 'https://');
const mk = (tag) => createClient({ url, authToken: process.env.VITE_TURSO_AUTH_TOKEN, concurrency: 2 });
const main = createClient({ url, authToken: process.env.VITE_TURSO_AUTH_TOKEN });
await main.execute("DROP TABLE IF EXISTS bench_t");
await main.execute("CREATE TABLE bench_t (id TEXT PRIMARY KEY, fen TEXT, rating INTEGER)");
const rows = Array.from({ length: 40000 }, (_, i) => ({ sql: "INSERT INTO bench_t VALUES (?,?,?)", args: [`p${i}`, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1", 1500] }));
const bench = async (nWorkers, batchSize) => {
  const t0 = Date.now();
  const per = Math.ceil(rows.length / nWorkers);
  const work = Array.from({ length: nWorkers }, (_, w) => {
    const db = mk(w);
    const chunks = [];
    for (let i = w * per; i < Math.min(rows.length, (w + 1) * per); i += batchSize) chunks.push(rows.slice(i, i + batchSize));
    return (async () => { for (const c of chunks) await db.batch(c); })();
  });
  await Promise.all(work);
  const dt = (Date.now() - t0) / 1000;
  console.log(`workers=${nWorkers} batch=${batchSize}: ${rows.length} rows in ${dt.toFixed(1)}s = ${(rows.length / dt).toFixed(0)} rows/s`);
};
await bench(1, 5000);
await bench(4, 5000);
await main.execute("DROP TABLE IF EXISTS bench_t");
