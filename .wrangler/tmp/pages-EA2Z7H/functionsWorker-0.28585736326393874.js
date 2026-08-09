var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/game/save.ts
function toHttpUrl(url) {
  return url.replace(/^libsql:\/\//, "https://");
}
__name(toHttpUrl, "toHttpUrl");
var ALLOWED_ORIGINS = [
  "https://finalrank.pages.dev",
  "https://finalrank.web.app",
  "https://finalrank.firebaseapp.com",
  "https://sarok-archive.web.app",
  "https://sarok-archive.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000"
];
function getCorsOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "https://finalrank.web.app";
}
__name(getCorsOrigin, "getCorsOrigin");
function corsHeaders(request) {
  const origin = getCorsOrigin(request);
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
async function onRequest(context) {
  const headers = corsHeaders(context.request);
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers });
  }
  try {
    const body = await context.request.json();
    const { shortId, gameData } = body;
    if (!shortId || !gameData) {
      return new Response(JSON.stringify({ error: "Missing shortId or gameData" }), { status: 400, headers });
    }
    const httpUrl = toHttpUrl(url);
    const response = await fetch(`${httpUrl}/v2/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            type: "execute",
            stmt: {
              sql: `CREATE TABLE IF NOT EXISTS shared_games (
                short_id TEXT PRIMARY KEY,
                game_data TEXT NOT NULL,
                uid TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
              )`,
              args: []
            }
          },
          {
            type: "execute",
            stmt: {
              sql: `INSERT INTO shared_games (short_id, game_data, uid, updated_at)
                    VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(short_id) DO UPDATE SET
                      game_data = excluded.game_data,
                      uid = excluded.uid,
                      updated_at = datetime('now')`,
              args: [shortId, JSON.stringify(gameData), String(gameData.uid || "")]
            }
          }
        ]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Turso write failed", detail: errText }), { status: 502, headers });
    }
    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Save failed" }), { status: 500, headers });
  }
}
__name(onRequest, "onRequest");

// api/game/[id].ts
function toHttpUrl2(url) {
  return url.replace(/^libsql:\/\//, "https://");
}
__name(toHttpUrl2, "toHttpUrl");
var ALLOWED_ORIGINS2 = [
  "https://finalrank.web.app",
  "https://finalrank.firebaseapp.com",
  "https://sarok-archive.web.app",
  "https://sarok-archive.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000"
];
function getCorsOrigin2(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS2.includes(origin) ? origin : "https://finalrank.web.app";
}
__name(getCorsOrigin2, "getCorsOrigin");
function corsHeaders2(request) {
  const origin = getCorsOrigin2(request);
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
__name(corsHeaders2, "corsHeaders");
async function onRequest2(context) {
  const headers = corsHeaders2(context.request);
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  const shortId = context.params.id;
  if (!shortId) {
    return new Response(JSON.stringify({ error: "Missing game id" }), { status: 400, headers });
  }
  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers });
  }
  try {
    const httpUrl = toHttpUrl2(url);
    const response = await fetch(`${httpUrl}/v2/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            type: "execute",
            stmt: {
              sql: `CREATE TABLE IF NOT EXISTS shared_games (
                short_id TEXT PRIMARY KEY,
                game_data TEXT NOT NULL,
                uid TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
              )`,
              args: []
            }
          },
          {
            type: "execute",
            stmt: {
              sql: "SELECT game_data FROM shared_games WHERE short_id = ?",
              args: [shortId]
            }
          }
        ]
      })
    });
    const result = await response.json();
    const rows = result?.results?.[1]?.response?.result?.rows;
    if (rows && rows.length > 0) {
      const cell = rows[0];
      const raw = typeof cell === "string" ? cell : cell[0]?.value ?? cell[0];
      const gameData = JSON.parse(raw);
      return new Response(JSON.stringify(gameData), { headers });
    }
    return new Response(JSON.stringify({ error: "Game not found" }), { status: 404, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Fetch failed" }), { status: 500, headers });
  }
}
__name(onRequest2, "onRequest");

// api/puzzles.ts
function toHttpUrl3(url) {
  return url.replace(/^libsql:\/\//, "https://").replace(/^sql:\/\//, "https://");
}
__name(toHttpUrl3, "toHttpUrl");
function toArg(value) {
  return { type: typeof value === "number" ? "integer" : "text", value: String(value) };
}
__name(toArg, "toArg");
var ALLOWED_ORIGINS3 = [
  "https://finalrank.pages.dev",
  "https://finalrank.web.app",
  "https://finalrank.firebaseapp.com",
  "https://sarok-archive.web.app",
  "https://sarok-archive.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000"
];
function getCorsOrigin3(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS3.includes(origin) ? origin : "https://finalrank.web.app";
}
__name(getCorsOrigin3, "getCorsOrigin");
function corsHeaders3(request) {
  const origin = getCorsOrigin3(request);
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}
__name(corsHeaders3, "corsHeaders");
var SCHEMA = `
CREATE TABLE IF NOT EXISTS puzzles (
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  moves TEXT NOT NULL,
  rating INTEGER NOT NULL,
  rating_deviation INTEGER,
  popularity INTEGER,
  plays INTEGER,
  themes TEXT NOT NULL DEFAULT '',
  game_url TEXT,
  opening TEXT,
  daily_date TEXT,
  served INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles(rating);
CREATE TABLE IF NOT EXISTS puzzles_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);`;
async function pipeline(httpUrl, token, requests) {
  const res = await fetch(`${httpUrl}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) {
    throw new Error(`Turso ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return data.results ?? [];
}
__name(pipeline, "pipeline");
async function ensureSchema(httpUrl, token) {
  await pipeline(httpUrl, token, [{ type: "execute", stmt: { sql: SCHEMA, args: [] } }]);
  try {
    await pipeline(httpUrl, token, [
      { type: "execute", stmt: { sql: "ALTER TABLE puzzles ADD COLUMN served INTEGER NOT NULL DEFAULT 0", args: [] } }
    ]);
  } catch {
  }
}
__name(ensureSchema, "ensureSchema");
async function refillFromLichess(httpUrl, dbToken, lichessToken, count, min, max) {
  const res = await fetch("https://lichess.org/api/puzzles", {
    headers: { "Authorization": `Bearer ${lichessToken}`, "Accept": "application/x-ndjson" }
  });
  if (!res.ok || !res.body) return 0;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const collected = [];
  while (collected.length < count) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const p = JSON.parse(line);
        if (p.puzzleId && p.fen && p.moves && p.rating != null && p.rating >= min && p.rating <= max) {
          collected.push({
            id: p.puzzleId,
            fen: p.fen,
            moves: p.moves,
            rating: p.rating,
            themes: (p.themes ?? []).join("|")
          });
          if (collected.length >= count) break;
        }
      } catch {
      }
    }
  }
  try {
    reader.releaseLock();
  } catch {
  }
  if (collected.length === 0) return 0;
  const stmts = collected.map((p) => ({
    type: "execute",
    stmt: {
      sql: `INSERT INTO puzzles (id, fen, moves, rating, themes, served)
            VALUES (?, ?, ?, ?, ?, 0)
            ON CONFLICT(id) DO NOTHING`,
      args: [toArg(p.id), toArg(p.fen), toArg(p.moves), toArg(p.rating), toArg(p.themes)]
    }
  }));
  await pipeline(httpUrl, dbToken, [{ type: "execute", stmt: { sql: SCHEMA, args: [] } }, ...stmts]);
  return collected.length;
}
__name(refillFromLichess, "refillFromLichess");
async function onRequest3(context) {
  const headers = corsHeaders3(context.request);
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  const url = context.env.VITE_TURSO_DATABASE_URL;
  const token = context.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers });
  }
  const params = new URL(context.request.url).searchParams;
  const count = Math.min(50, Math.max(1, parseInt(params.get("count") || "10", 10) || 10));
  const min = parseInt(params.get("min") || "400", 10) || 400;
  const max = parseInt(params.get("max") || "2000", 10) || 2e3;
  try {
    const httpUrl = toHttpUrl3(url);
    await ensureSchema(httpUrl, token);
    const fetchRandom = /* @__PURE__ */ __name(async (n) => {
      const results = await pipeline(httpUrl, token, [
        {
          type: "execute",
          stmt: {
            sql: `SELECT id, fen, moves, rating, popularity, plays, themes, opening, served
                  FROM puzzles WHERE rating BETWEEN ? AND ?
                  ORDER BY served ASC, RANDOM() LIMIT ?`,
            args: [toArg(min), toArg(max), toArg(n)]
          }
        }
      ]);
      return results[0]?.response?.result?.rows ?? [];
    }, "fetchRandom");
    let rows = await fetchRandom(count);
    if (rows.length < count && context.env.LICHESS_API_TOKEN) {
      const need = count - rows.length;
      try {
        await refillFromLichess(httpUrl, token, context.env.LICHESS_API_TOKEN, Math.max(need, 10), min, max);
        rows = await fetchRandom(count);
      } catch {
      }
    }
    const puzzles = rows.map((r) => {
      const cell = /* @__PURE__ */ __name((i) => {
        const c = r.row[i];
        return c != null ? String(c.value ?? "") : "";
      }, "cell");
      return {
        id: cell(0),
        fen: cell(1),
        moves: cell(2),
        rating: Number(cell(3)),
        popularity: Number(cell(5)),
        plays: Number(cell(6)),
        themes: cell(7).split("|").filter(Boolean),
        opening: cell(8)
      };
    });
    if (puzzles.length > 0) {
      const ids = puzzles.map((p) => toArg(p.id));
      const stmts = ids.map((id) => ({
        type: "execute",
        stmt: { sql: "UPDATE puzzles SET served = served + 1 WHERE id = ?", args: [id] }
      }));
      try {
        await pipeline(httpUrl, token, stmts);
      } catch {
      }
    }
    return new Response(JSON.stringify({ puzzles, count: puzzles.length }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Puzzle query failed" }), { status: 500, headers });
  }
}
__name(onRequest3, "onRequest");

// ../.wrangler/tmp/pages-EA2Z7H/functionsRoutes-0.008727694919434592.mjs
var routes = [
  {
    routePath: "/api/game/save",
    mountPath: "/api/game",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/game/:id",
    mountPath: "/api/game",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/puzzles",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  }
];

// ../../../../.npm/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
