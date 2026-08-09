import 'dotenv/config';
import { createClient } from '@libsql/client';
const url = process.env.VITE_TURSO_DATABASE_URL.replace(/^libsql:\/\//, 'https://');
const db = createClient({ url, authToken: process.env.VITE_TURSO_AUTH_TOKEN });
await db.execute("DROP TABLE IF EXISTS bench_t");
await db.execute("CREATE TABLE bench_t (id TEXT PRIMARY KEY, fen TEXT, rating INTEGER)");
const mk = (n) => Array.from({ length: n }, (_, i) => ({ sql: "INSERT OR IGNORE INTO bench_t VALUES (?,?,?)", args: [`bench${i}`, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1", 1500] }));
for (const size of [1000, 5000, 20000]) {
  const total = 20000;
  const batches = total / size;
  const t0 = Date.now();
  for (let b = 0; b < batches; b++) await db.batch(mk(size));
  const dt = (Date.now() - t0) / 1000;
  console.log(`size=${size}: ${total} rows in ${dt.toFixed(1)}s -> ${(total / dt).toFixed(0)} rows/s`);
}
await db.execute("DROP TABLE bench_t");
