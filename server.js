import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  bank,
  questions,
  scores,
  judge,
  suggestAnswer,
  selectQuestions,
} from "./questions.js";

const ROUND_MS = 25000,
  MAX_BODY = 128 * 1024,
  ROOM_LIFETIME = 6 * 60 * 60 * 1000;
export function createGameServer({ now = Date.now } = {}) {
  const rooms = new Map();
  const assets = new Map();
  const token = () => randomBytes(16).toString("hex");
  function advance(p) {
    p.revision++;
    if (p.results.length === 7) {
      p.phase = "done";
      return;
    }
    p.phase = "answering";
    p.deadline = now() + ROUND_MS;
    p.roundId = token();
    p.correction = null;
  }
  function finish(room, p, answer, raw) {
    p.revision++;
    const q = room.questions[p.results.length];
    p.results.push({
      questionId: q.id,
      prompt: q.text,
      answer: answer?.answer ?? null,
      raw: raw ?? null,
      tier: answer?.tier ?? "miss",
      score: answer ? scores[answer.tier] : 0,
    });
    p.phase = p.results.length === 7 ? "done" : "feedback";
    p.deadline = null;
    p.roundId = null;
    p.correction = null;
  }
  function settle(room, p) {
    if (p.phase === "answering" && now() >= p.deadline)
      finish(room, p, null, null);
  }
  function state(room, player, includeAnswers = true) {
    for (const p of room.players.values()) settle(room, p);
    const completed = player.results.length === 7;
    const active = player.phase === "answering";
    return {
      revision: player.revision,
      code: room.code,
      playerId: player.id,
      name: player.name,
      phase: player.phase,
      deadline: player.deadline,
      roundId: player.roundId,
      serverNow: now(),
      round: player.results.length,
      correction: player.correction
        ? {
            id: player.correction.id,
            from: player.correction.raw,
            to: player.correction.answer.answer,
            reason: player.correction.reason,
          }
        : null,
      freshCount: room.freshCount,
      bankSize: questions.length,
      question: active
        ? {
            id: room.questions[player.results.length].id,
            text: room.questions[player.results.length].text,
            note: room.questions[player.results.length].note ?? "",
            scoring: room.questions[player.results.length].scoring,
          }
        : null,
      playedIds: [
        ...player.results.map((r) => r.questionId),
        ...(player.phase === "answering"
          ? [room.questions[player.results.length].id]
          : []),
      ],
      results: player.results,
      board: [...room.players.values()]
        .map((p) => ({
          name: p.name,
          isYou: p.id === player.id,
          score: p.results.reduce((s, r) => s + r.score, 0),
          rounds: p.results.length,
          done: p.results.length === 7,
        }))
        .sort((a, b) => b.score - a.score),
      ...(completed && includeAnswers
        ? {
            answers: room.questions.map((q) => ({
              text: q.text,
              source: q.source,
              scoring: q.scoring,
              count: q.answers.length,
            })),
          }
        : {}),
    };
  }
  function addPlayer(room, name) {
    const p = {
      id: token(),
      name:
        name?.trim() || `Skier ${randomBytes(2).toString("hex").toUpperCase()}`,
      results: [],
      revision: 0,
      phase: "intro",
      deadline: null,
      roundId: null,
      correction: null,
    };
    room.players.set(p.id, p);
    return p;
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/info" && req.method === "GET")
        return send(200, {
          name: "Counterline",
          version: 5,
          questionCount: questions.length,
          questionIds: questions.map((q) => q.id),
          questionAliases: bank.questionAliases,
          rounds: 7,
          roundSeconds: 25,
        });
      if (url.pathname.startsWith("/api/")) {
        if (req.method !== "POST") return send(405, { error: "Use POST" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > MAX_BODY)
            return send(413, { error: "Request too large" });
        }
        let b;
        try {
          b = JSON.parse(body);
        } catch {
          return send(400, { error: "Invalid request" });
        }
        if (!b || typeof b !== "object" || Array.isArray(b))
          return send(400, { error: "Invalid request" });
        if (
          b.name !== undefined &&
          (typeof b.name !== "string" || b.name.length > 24)
        )
          return send(400, { error: "Names can be up to 24 characters" });
        for (const [key, room] of rooms)
          if (now() - room.touchedAt > ROOM_LIFETIME) rooms.delete(key);
        if (url.pathname === "/api/start") {
          if (
            b.seen !== undefined &&
            (!Array.isArray(b.seen) ||
              b.seen.length > 3000 ||
              !b.seen.every((id) => typeof id === "string" && id.length <= 64))
          )
            return send(400, { error: "Invalid question history" });
          if (rooms.size >= 2000)
            return send(503, {
              error: "The server is busy. Please try again later.",
            });
          const selection = selectQuestions(b.seen ?? []);
          let code;
          do {
            code = randomBytes(3).toString("hex").toUpperCase();
          } while (rooms.has(code));
          const room = {
            code,
            ...selection,
            players: new Map(),
            touchedAt: now(),
          };
          rooms.set(code, room);
          const p = addPlayer(room, b.name);
          return send(200, state(room, p));
        }
        if (url.pathname === "/api/join") {
          if (
            typeof b.code !== "string" ||
            !/^[A-F0-9]{6}$/i.test(b.code.trim())
          )
            return send(400, { error: "Enter a six-character invite code" });
          const room = rooms.get(b.code.trim().toUpperCase());
          if (!room)
            return send(404, {
              error: "This invite has expired. Ask your friend for a new one.",
            });
          if (room.players.size >= 12)
            return send(409, { error: "This run already has 12 skiers" });
          room.touchedAt = now();
          const p = addPlayer(room, b.name);
          return send(200, state(room, p));
        }
        const room = rooms.get(b.code),
          p = room?.players.get(b.playerId);
        if (!p)
          return send(404, {
            error: "This run has expired. Start a fresh run.",
            expired: true,
          });
        room.touchedAt = now();
        settle(room, p);
        if (url.pathname === "/api/name") {
          if (p.phase === "answering")
            return send(409, { error: "Change your name between questions." });
          if (!b.name?.trim()) return send(400, { error: "Enter a name." });
          p.name = b.name.trim();
          p.revision++;
          return send(200, state(room, p));
        }
        if (url.pathname === "/api/answers") {
          if (p.results.length !== 7)
            return send(403, {
              error: "Finish the run to open answer sheets.",
            });
          if (
            !Number.isInteger(b.index) ||
            b.index < 0 ||
            b.index >= 7 ||
            (b.query !== undefined &&
              (typeof b.query !== "string" || b.query.length > 80)) ||
            (b.offset !== undefined &&
              (!Number.isInteger(b.offset) || b.offset < 0))
          )
            return send(400, { error: "Invalid answer sheet request" });
          const q = room.questions[b.index],
            query = (b.query ?? "")
              .normalize("NFKD")
              .replace(/\p{M}/gu, "")
              .toLowerCase();
          const filtered = query
            ? q.answers.filter((a) =>
                a.answer
                  .normalize("NFKD")
                  .replace(/\p{M}/gu, "")
                  .toLowerCase()
                  .includes(query),
              )
            : q.answers;
          const offset = b.offset ?? 0;
          return send(200, {
            text: q.text,
            source: q.source,
            scoring: q.scoring,
            total: filtered.length,
            offset,
            answers: filtered.slice(offset, offset + 100).map((a) => ({
              answer: a.answer,
              tier: a.tier,
              score: scores[a.tier],
            })),
          });
        }
        if (url.pathname === "/api/next") {
          if (p.phase === "intro" || p.phase === "feedback") advance(p);
        } else if (
          ["/api/answer", "/api/skip", "/api/confirm", "/api/dismiss"].includes(
            url.pathname,
          )
        ) {
          if (p.phase !== "answering" || b.roundId !== p.roundId)
            return send(409, {
              error: "That turn has ended.",
              state: state(room, p),
            });
          if (url.pathname === "/api/skip") finish(room, p, null, null);
          else if (url.pathname === "/api/confirm") {
            if (!p.correction || b.correctionId !== p.correction.id)
              return send(409, {
                error: "That suggestion is no longer available.",
                state: state(room, p),
              });
            finish(room, p, p.correction.answer, p.correction.raw);
          } else if (url.pathname === "/api/dismiss") {
            p.correction = null;
            p.revision++;
          } else {
            if (typeof b.answer !== "string" || b.answer.length > 160)
              return send(400, {
                error: "Answers can be up to 160 characters",
              });
            const question = room.questions[p.results.length];
            p.correction = null;
            const a = judge(question, b.answer);
            if (a) finish(room, p, a, b.answer);
            else {
              const suggestion = suggestAnswer(question, b.answer);
              p.revision++;
              if (suggestion)
                p.correction = { id: token(), raw: b.answer, ...suggestion };
              else
                return send(200, {
                  ...state(room, p),
                  rejected:
                    "No clear match yet. Try another spelling or a more complete answer.",
                });
            }
          }
        } else if (url.pathname !== "/api/state")
          return send(404, { error: "Not found" });
        return send(200, state(room, p, b.summary !== true));
      }
      if (req.method !== "GET") return send(405, { error: "Use GET" });
      const files = {
        "/": ["index.html", "text/html"],
        "/app.js": ["app.js", "text/javascript"],
        "/style.css": ["style.css", "text/css"],
        "/progress.js": ["progress.js", "text/javascript"],
        "/descent.js": ["descent.js", "text/javascript"],
        "/skier.js": ["skier.js", "text/javascript"],
        "/sources": ["sources.html", "text/html"],
        "/icon.svg": ["icon.svg", "image/svg+xml"],
      };
      const f = files[url.pathname];
      if (!f) return send(404, { error: "Not found" });
      let asset = assets.get(f[0]);
      if (!asset) {
        const contents = await readFile(
          new URL("./public/" + f[0], import.meta.url),
        );
        asset = {
          contents,
          etag:
            '"' +
            createHash("sha256").update(contents).digest("hex").slice(0, 24) +
            '"',
        };
        assets.set(f[0], asset);
      }
      const headers = {
        "Content-Type":
          f[1] + (f[1].startsWith("image/") ? "" : "; charset=utf-8"),
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        ETag: asset.etag,
      };
      if (req.headers["if-none-match"] === asset.etag) {
        res.writeHead(304, headers);
        return res.end();
      }
      res.writeHead(200, {
        ...headers,
        "Content-Length": asset.contents.length,
      });
      res.end(asset.contents);
    } catch {
      if (!res.headersSent)
        send(500, { error: "Something went wrong. Please try again." });
      else res.end();
    }
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createGameServer().listen(port, "0.0.0.0", () =>
    console.log(`Counterline listening on port ${port}`),
  );
}
