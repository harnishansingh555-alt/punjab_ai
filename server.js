import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";

const app = express();
const PORT = process.env.PORT || 3000;
const CLAUDE_MODEL = (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-3.7-flash").trim();
const ENV_FILE = path.join(process.cwd(), ".env");

import os from "node:os";

// Settings are also kept in your home folder, so a new copy of this project never asks for them again.
const CONFIG_DIR = path.join(os.homedir(), ".punjab-ai");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const readConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch { return {}; } };
function writeConfig(patch) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...readConfig(), ...patch }, null, 2), { mode: 0o600 });
  } catch (e) { console.error("Could not save settings:", e.message); }
}
const saved = readConfig();

// Your Google sign-in Client ID is built in, so you never have to enter it.
const DEFAULT_CLIENT_ID = "737468148049-supdkq5jetbuphutlon3ku04f1cmb03s.apps.googleusercontent.com";

const clean = (k) => String(k || "").trim().replace(/^["']|["']$/g, "").trim();

// Keys: AI_API_KEY may hold any one key (sk-ant-... is Claude, gsk_... is Groq, anything else is Google Gemini).
// You can also set GROQ_API_KEY and GEMINI_API_KEY separately, so both work together.
// Built-in keys are used when nothing is set. Keep your GitHub repo PRIVATE, because these keys are in the code.
const BUILT_IN_GEMINI_KEY = ""; // no Google Gemini key: set GEMINI_API_KEY in .env to turn it on
const BUILT_IN_GROQ_KEY = "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";
const providerOf = (key) => (key.startsWith("sk-ant-") ? "claude" : key.startsWith("gsk_") ? "groq" : "gemini");
const good = (k) => (k && !/^your-/.test(k) ? k : "");
const main = good(clean(process.env.AI_API_KEY));
const KEYS = {
  claude: good(clean(process.env.ANTHROPIC_API_KEY)) || (main && providerOf(main) === "claude" ? main : ""),
  groq: good(clean(process.env.GROQ_API_KEY)) || (main && providerOf(main) === "groq" ? main : "") || BUILT_IN_GROQ_KEY,
  gemini: good(clean(process.env.GEMINI_API_KEY)) || (main && providerOf(main) === "gemini" ? main : "") || BUILT_IN_GEMINI_KEY,
  horde: good(clean(process.env.HORDE_API_KEY)), // AI Horde (free, community-run): last-resort backup
};
const KEY = KEYS.groq || KEYS.gemini || KEYS.claude; // used only for status messages
const GROQ_MODEL = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
const PROVIDER_NAME = { claude: "Claude", groq: "Groq", gemini: "Google Gemini", horde: "AI Horde" };

const NO_KEY = "There is no API key yet. Add AI_API_KEY to the .env file and restart the server.";

function setEnv(name, value) {
  let text = "";
  try { text = fs.readFileSync(ENV_FILE, "utf8"); } catch {}
  const kept = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith(name + "="));
  kept.push(`${name}=${value}`);
  fs.writeFileSync(ENV_FILE, kept.join("\n") + "\n");
}
function saveKey(key) {
  writeConfig({ apiKey: key });
  let text = "";
  try { text = fs.readFileSync(ENV_FILE, "utf8"); } catch {}
  const kept = text.split(/\r?\n/).filter((l) => l.trim() && !/^(AI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY)=/.test(l));
  kept.push(`AI_API_KEY=${key}`);
  fs.writeFileSync(ENV_FILE, kept.join("\n") + "\n");
}

// ---------- Google sign-in ----------
// The built-in ID always wins, so an old GOOGLE_CLIENT_ID left in Render or in ~/.punjab-ai can never cause a mismatch.
let CLIENT_ID = DEFAULT_CLIENT_ID;
let oauth = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

// Sessions are signed cookies (HMAC). The secret is created once and kept in .env.
let SECRET = clean(process.env.SESSION_SECRET) || clean(saved.sessionSecret);
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString("hex");
  writeConfig({ sessionSecret: SECRET });
}
const COOKIE = "pai_session";
const SESSION_DAYS = 30;
const b64 = (x) => Buffer.from(x).toString("base64url");
const sign = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("base64url");

function makeSession(user) {
  const body = b64(JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 864e5 }));
  return `${body}.${sign(body)}`;
}
function readSession(req) {
  const raw = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [body, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!body || !sig) return null;
  const good = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  try {
    const u = JSON.parse(Buffer.from(body, "base64url").toString());
    return u.exp > Date.now() ? u : null;
  } catch { return null; }
}
const cookieFlags = (req, maxAge) =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "");

// gzip makes pages load faster. If the optional "compression" package is missing the site still works.
try { const { default: compression } = await import("compression"); app.use(compression({ filter: (req, res) => !String(res.getHeader("content-type") || "").includes("text/event-stream") && compression.filter(req, res) })); } catch {}
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json({ limit: "50kb" }));
app.use(express.static("public", {
  extensions: ["html"], // /about works as well as /about.html
  setHeaders(res, file) {
    if (/\.(png|jpg|svg|ico|woff2?)$/.test(file)) res.setHeader("Cache-Control", "public, max-age=604800");
    else if (/sw\.js$/.test(file) || /\.html$/.test(file)) res.setHeader("Cache-Control", "no-cache");
    else res.setHeader("Cache-Control", "public, max-age=600");
  },
}));

// Simple in-memory rate limit: 20 requests per minute per IP.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

const SYSTEM_PROMPT = `You are Punjab AI, a friendly and knowledgeable assistant that speaks English and Punjabi.

Language rules:
- Reply in the language of the user's latest message.
- Always write Punjabi in Gurmukhi script (ਪੰਜਾਬੀ), even if the user types Punjabi in Roman letters.
- If the language is unclear, use the interface language given below.

Style: warm, clear and concise. Use short paragraphs and plain text (no markdown tables or headings). If you are unsure of something, say so instead of guessing.`;

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-14)
    .map((m, i, a) => ({ role: m.role, content: m.content.slice(0, i >= a.length - 2 ? 4000 : 1200) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs.length && msgs[msgs.length - 1].role === "user" ? msgs : null;
}

// ---------- Claude ----------
function explainClaude(status, data) {
  const msg = String(data?.error?.message || "");
  console.error("Claude API error", status, msg);
  if (/credit balance/i.test(msg)) return "Your Anthropic account has no credit left. Add credit in the Claude Console (billing), then try again.";
  if (status === 401) return "The Claude API key is wrong. Put a new key on the AI_API_KEY line in .env and restart.";
  if (status === 403) return "This API key is not allowed to use that model or service.";
  if (status === 404) return `Model "${CLAUDE_MODEL}" was not found. Check ANTHROPIC_MODEL in the .env file.`;
  if (status === 429) return "Too many requests to Claude right now. Wait a minute and try again.";
  if (status >= 500) return "Claude is busy or down right now. Try again in a moment.";
  return "Claude returned an error: " + msg.slice(0, 200);
}

async function askClaude(messages, system, key) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1024, system, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { error: explainClaude(r.status, data) };
  const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return reply ? { reply } : { error: "Claude sent an empty answer. Try again." };
}

// ---------- Google Gemini ----------
function explainGemini(status, data) {
  const msg = String(data?.error?.message || "");
  console.error("Gemini API error", status, msg);
  const detail = msg ? ` (Google said: ${msg.slice(0, 160)})` : "";
  if (/api key not valid|api_key_invalid|expired/i.test(msg) || status === 401) return "Google did not accept this key." + detail + " Check the AI_API_KEY line in .env, then restart.";
  if (status === 403) return "Google did not allow this key." + detail + " Make sure the Gemini API is allowed for the key in Google AI Studio.";
  if (status === 429) return "Google's free limit was reached. Wait a minute and try again." + detail;
  if (status >= 500) return "Google is busy right now. Try again in a moment.";
  return "Google returned an error: " + msg.slice(0, 200);
}

async function askGemini(messages, system, key) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: 2048 },
  });
  const readReply = (data) => (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  // Model names change over time, so try the chosen one first, then others.
  const models = [...new Set([GEMINI_MODEL, "gemini-3.7-flash", "gemini-3.6-flash", "gemini-2.5-flash"])];
  let lastErr = null;
  const keyRejected = (r, data) => r.status === 401 || r.status === 403 ||
    (r.status === 400 && /api key not valid|api_key_invalid|expired/i.test(String(data?.error?.message || "")));
  for (const model of models) {
    // 1) Normal Gemini API (AI Studio keys, AIza... format).
    let r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body,
    });
    let data = await r.json().catch(() => ({}));
    // 2) Google answers "API key not valid" with HTTP 400 (not 401) when the key belongs to Vertex AI express mode
    //    (keys that start with AQ.). So on any key rejection, retry on the Vertex AI address.
    if (keyRejected(r, data)) {
      const first = explainGemini(r.status, data);
      const r2 = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "content-type": "application/json" }, body,
      });
      const data2 = await r2.json().catch(() => ({}));
      if (r2.ok) { r = r2; data = data2; }
      else if (r2.status === 404) { console.error(`Vertex model ${model} not found, trying the next one`); continue; }
      else if (keyRejected(r2, data2)) { return { error: first }; }
      else { return { error: explainGemini(r2.status, data2) }; }
    }
    if (r.status === 404) { console.error(`Gemini model ${model} not found, trying the next one`); lastErr = null; continue; }
    if (!r.ok) return { error: explainGemini(r.status, data) };
    const reply = readReply(data);
    return reply ? { reply } : { error: "Google sent an empty answer. Try again." };
  }
  return lastErr || { error: "No Gemini model was found. Set GEMINI_MODEL in the .env file to a current model name." };
}

// One call to a Gemini model: normal address first, then the Vertex AI express address when Google says "API key not valid".
async function geminiCall(model, payload, key) {
  const body = JSON.stringify(payload);
  const rejected = (r, d) => r.status === 401 || r.status === 403 ||
    (r.status === 400 && /api key not valid|api_key_invalid|expired/i.test(String(d?.error?.message || "")));
  const open = (vertex) => vertex
    ? fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body })
    : fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body });
  // AQ. keys are Vertex AI express keys, so use that address first and skip a guaranteed failure.
  let vertex = memo.geminiVertex ?? key.startsWith("AQ.");
  let r = await open(vertex);
  let data = await r.json().catch(() => ({}));
  if (rejected(r, data)) {
    const r2 = await open(!vertex);
    const d2 = await r2.json().catch(() => ({}));
    if (r2.ok || r2.status === 404 || !rejected(r2, d2)) { r = r2; data = d2; }
  }
  return { r, data };
}

// ---------- Groq (very fast, free tier) ----------
function explainGroq(status, data) {
  const msg = String(data?.error?.message || "");
  console.error("Groq API error", status, msg);
  if (status === 401) return "Groq did not accept this key. Check the key at console.groq.com and the GROQ_API_KEY or AI_API_KEY setting.";
  if (status === 403) return "Groq did not allow this key." + (msg ? ` (Groq said: ${msg.slice(0, 140)})` : "");
  if (status === 429) return "Groq's free limit was reached. Wait a minute and try again.";
  if (status >= 500) return "Groq is busy right now. Try again in a moment.";
  return "Groq returned an error: " + msg.slice(0, 200);
}

async function askGroq(messages, system, key) {
  const models = [...new Set([GROQ_MODEL, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"])];
  let last = null;
  for (const model of models) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...messages], max_tokens: 1024, temperature: 0.6 }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      const reply = String(data.choices?.[0]?.message?.content || "").trim();
      return reply ? { reply } : { error: "Groq sent an empty answer. Try again." };
    }
    if ((r.status === 404 || r.status === 400) && /model/i.test(String(data?.error?.message || ""))) {
      console.error(`Groq model ${model} not usable, trying the next one`);
      last = { error: explainGroq(r.status, data) };
      continue;
    }
    return { error: explainGroq(r.status, data) };
  }
  return last || { error: "No Groq model was found. Set GROQ_MODEL in the .env file." };
}

// ---------- AI Horde (free community text generation; slower, used as the backup) ----------
async function askHorde(messages, system, key) {
  const headers = { "Content-Type": "application/json", apikey: key, "Client-Agent": "PunjabAI:1.0:punjab-ai" };
  const convo = messages.slice(-8).map((m) => (m.role === "assistant" ? "Assistant: " : "User: ") + m.content).join("\n");
  const prompt = `${system}\n\n${convo}\nAssistant:`;
  const r = await fetch("https://aihorde.net/api/v2/generate/text/async", {
    method: "POST", headers,
    body: JSON.stringify({ prompt, params: { max_length: 300, max_context_length: 2048, temperature: 0.7, stop_sequence: ["\nUser:"] }, trusted_workers: false }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) { console.error("Horde start failed", r.status, d); return { error: "AI Horde did not accept the request" + (d.message ? ": " + String(d.message).slice(0, 120) : "."), status: r.status }; }
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((ok) => setTimeout(ok, 2500));
    const s = await (await fetch("https://aihorde.net/api/v2/generate/text/status/" + d.id, { headers })).json().catch(() => ({}));
    if (s.faulted) return { error: "AI Horde could not finish the answer. Try again." };
    if (s.done) {
      const text = String(s.generations?.[0]?.text || "").replace(/\n?User:[\s\S]*$/, "").trim();
      return text ? { reply: text } : { error: "AI Horde sent an empty answer. Try again." };
    }
  }
  fetch("https://aihorde.net/api/v2/generate/text/status/" + d.id, { method: "DELETE", headers }).catch(() => {});
  return { error: "AI Horde is busy right now. Try again in a moment." };
}

const ASK = { claude: askClaude, groq: askGroq, gemini: askGemini, horde: askHorde };
// Chooses the provider order. Groq is much faster for English. Gemini is better at Punjabi (Gurmukhi), so it goes first for Punjabi.
async function askAI(messages, system, opts = {}) {
  const order = ["groq", "gemini", "claude", "horde"].filter((p) => KEYS[p]);
  const last = messages[messages.length - 1]?.content || "";
  const punjabi = opts.punjabi ?? /[\u0A00-\u0A7F]/.test(last);
  if (punjabi && order.includes("gemini")) { order.splice(order.indexOf("gemini"), 1); order.unshift("gemini"); }
  if (!order.length) return { error: NO_KEY };
  let lastErr = null;
  for (const p of order) {
    try {
      const out = await ASK[p](messages, system, KEYS[p]);
      if (out.reply) return { ...out, provider: p };
      lastErr = out.error;
      console.error(`Provider ${p} failed, trying the next one: ${out.error}`);
    } catch (err) {
      console.error(err);
      lastErr = "Could not reach the AI service. Check your internet connection.";
    }
  }
  return { error: lastErr || NO_KEY };
}


// ---------- Fast streaming layer ----------
// Words are sent to the browser as soon as the AI writes them, instead of waiting for the whole answer.
// The server also remembers which model/address works and which provider is down, so it never wastes time retrying dead ones.
const memo = { geminiFast: undefined, groqModel: "", geminiModel: "", geminiVertex: null };
const cooldown = {}; // provider -> time until which it is skipped
const cool = (p, ms = 60_000) => { cooldown[p] = Date.now() + ms; };

async function* sseLines(res) {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
  if (buf.trim().startsWith("data:")) yield buf.trim().slice(5).trim();
}

async function streamGroq(messages, system, key, onDelta, signal, maxTok = 700) {
  const models = [...new Set([memo.groqModel, GROQ_MODEL, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean))];
  let last = null;
  for (const model of models) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...messages], max_tokens: maxTok, temperature: 0.6, stream: true }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      if (r.status === 429 && model !== models[models.length - 1]) { last = { error: explainGroq(r.status, data) }; continue; } // other model has its own limit
      if ((r.status === 404 || r.status === 400) && /model/i.test(String(data?.error?.message || ""))) { last = { error: explainGroq(r.status, data) }; continue; }
      return { error: explainGroq(r.status, data), status: r.status };
    }
    let got = "";
    for await (const d of sseLines(r)) {
      if (d === "[DONE]") break;
      try { const t = JSON.parse(d).choices?.[0]?.delta?.content; if (t) { got += t; onDelta(t); } } catch {}
    }
    memo.groqModel = model;
    return got.trim() ? { reply: got } : { error: "Groq sent an empty answer. Try again." };
  }
  return last || { error: "No Groq model was found. Set GROQ_MODEL in the .env file." };
}

async function streamGemini(messages, system, key, onDelta, signal, maxTok = 1200) {
  // Thinking is switched off: it adds seconds of waiting before the first word. If a model refuses that setting, we retry without it.
  const mkBody = (fast) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: maxTok, ...(fast ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
  });
  let fast = memo.geminiFast !== false;
  let body = mkBody(fast);
  const models = [...new Set([memo.geminiModel, GEMINI_MODEL, "gemini-3.7-flash", "gemini-3.6-flash", "gemini-2.5-flash"].filter(Boolean))];
  const rejected = (r, d) => r.status === 401 || r.status === 403 || (r.status === 400 && /api key not valid|api_key_invalid|expired/i.test(String(d?.error?.message || "")));
  // Keys starting with AQ. belong to Vertex AI express mode, so go straight to that address instead of failing on the other one first.
  const vertexFirst = memo.geminiVertex ?? key.startsWith("AQ.");
  const open = (model, vertex) => fetch(
    vertex
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    { method: "POST", signal, headers: vertex ? { "content-type": "application/json" } : { "content-type": "application/json", "x-goog-api-key": key }, body });
  let lastErr = null;
  for (const model of models) {
    let vertex = vertexFirst;
    let r = await open(model, vertex);
    if (!r.ok) {
      let data = await r.json().catch(() => ({}));
      if (Array.isArray(data)) data = data[0] || {};
      if (fast && r.status === 400 && /thinking/i.test(String(data?.error?.message || ""))) {
        memo.geminiFast = false; fast = false; body = mkBody(false);
        r = await open(model, vertex);
        if (!r.ok) { data = await r.json().catch(() => ({})); if (Array.isArray(data)) data = data[0] || {}; }
      }
      if (!r.ok && rejected(r, data)) {
        const first = explainGemini(r.status, data);
        vertex = !vertex;
        r = await open(model, vertex);
        if (!r.ok) {
          let d2 = await r.json().catch(() => ({})); if (Array.isArray(d2)) d2 = d2[0] || {};
          if (r.status === 404) { lastErr = null; continue; }
          return { error: rejected(r, d2) ? first : explainGemini(r.status, d2), status: r.status };
        }
      } else if (!r.ok && r.status === 404) { console.error(`Gemini model ${model} not found, trying the next one`); continue; }
      else if (!r.ok) return { error: explainGemini(r.status, data), status: r.status };
    }
    let got = "";
    for await (const d of sseLines(r)) {
      try { const t = (JSON.parse(d).candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""); if (t) { got += t; onDelta(t); } } catch {}
    }
    memo.geminiModel = model; memo.geminiVertex = vertex;
    return got.trim() ? { reply: got } : { error: "Google sent an empty answer. Try again." };
  }
  return lastErr || { error: "No Gemini model was found. Set GEMINI_MODEL in the .env file to a current model name." };
}

// Claude has no streaming path here: its whole answer arrives as one piece.
const streamClaude = async (messages, system, key, onDelta) => { const o = await askClaude(messages, system, key); if (o.reply) onDelta(o.reply); return o; };
const streamHorde = async (messages, system, key, onDelta) => { const o = await askHorde(messages, system, key); if (o.reply) onDelta(o.reply); return o; };
const STREAM = { claude: streamClaude, groq: streamGroq, gemini: streamGemini, horde: streamHorde };

async function askAIStream(messages, system, opts, onDelta, signal) {
  let order = ["groq", "gemini", "claude", "horde"].filter((p) => KEYS[p]);
  const last = messages[messages.length - 1]?.content || "";
  const punjabi = opts.punjabi ?? /[਀-੿]/.test(last);
  if (punjabi && order.includes("gemini")) { order = ["gemini", ...order.filter((p) => p !== "gemini")]; }
  if (!order.length) return { error: NO_KEY };
  // Providers that just failed go to the back of the line (but are still tried if everything else fails).
  const now = Date.now();
  order = [...order.filter((p) => !(cooldown[p] > now)), ...order.filter((p) => cooldown[p] > now)];
  let lastErr = null; const errs = [];
  for (const p of order) {
    let sent = 0;
    try {
      const out = await STREAM[p](messages, system, KEYS[p], (t) => { sent += t.length; onDelta(t); }, signal, opts.short ? 220 : undefined);
      if (out.reply) return { reply: out.reply, provider: p };
      lastErr = out.error; errs.push(`${PROVIDER_NAME[p]}: ${out.error}`);
      if ([401, 403, 429].includes(out.status) || /limit|key|credit/i.test(out.error || "")) cool(p, 90_000); else cool(p, 15_000);
      console.error(`Provider ${p} failed, trying the next one: ${out.error}`);
    } catch (err) {
      if (signal?.aborted) return { aborted: true };
      console.error(err);
      cool(p, 15_000);
      if (sent) return { reply: "", error: "The connection was cut. Please send again." };
      lastErr = "Could not reach the AI service. Check your internet connection.";
    }
  }
  return { error: errs.length > 1 ? "None of the AI services worked. " + errs.join(" | ") : lastErr || NO_KEY };
}

// ---------- Auth routes ----------
app.get("/api/status", (_req, res) => res.json({ hasKey: !!KEY, providers: Object.keys(KEYS).filter((p) => KEYS[p]), googleClientId: CLIENT_ID }));
app.get("/api/config", (_req, res) => res.json({ googleClientId: CLIENT_ID || null }));

app.get("/api/me", (req, res) => {
  const u = readSession(req);
  res.json({ user: u ? { name: u.name, email: u.email, picture: u.picture } : null });
});

app.post("/api/auth/google", async (req, res) => {
  if (!oauth) return res.status(400).json({ error: "Google sign-in is not set up yet." });
  const credential = req.body?.credential;
  if (typeof credential !== "string" || credential.length > 4000) return res.status(400).json({ error: "Missing Google credential." });
  try {
    const ticket = await oauth.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || p.email_verified === false) return res.status(401).json({ error: "Your Google email is not verified." });
    const user = { sub: p.sub, name: p.name || p.email, email: p.email, picture: p.picture || "" };
    res.setHeader("Set-Cookie", `${COOKIE}=${makeSession(user)}; ${cookieFlags(req, SESSION_DAYS * 86400)}`);
    res.json({ user: { name: user.name, email: user.email, picture: user.picture } });
  } catch (e) {
    console.error("Google sign-in failed:", e.message);
    res.status(401).json({ error: "Google sign-in failed. Check that the Client ID is right and http://localhost:" + PORT + " is an authorized origin." });
  }
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE}=; ${cookieFlags(req, 0)}`);
  res.json({ ok: true });
});

// ---------- Routes ----------
app.post("/api/chat", async (req, res) => {
  const who = readSession(req);
  if (CLIENT_ID && !who) return res.status(401).json({ error: "Please sign in with Google to chat.", code: "auth" });
  if (rateLimited(who ? who.sub : req.ip)) {
    return res.status(429).json({ error: "Too many requests. Wait a minute and try again." });
  }
  const messages = cleanMessages(req.body?.messages);
  if (!messages) return res.status(400).json({ error: "Send at least one user message." });

  const uiLang = req.body?.lang === "pa" ? "Punjabi (Gurmukhi)" : "English";
  const voiceHint = req.body?.voice ? "\n\nThis is a live spoken conversation: answer in 1 to 3 short, natural sentences, with no lists, markdown or emojis." : "";
  const system = `${SYSTEM_PROMPT}\n\nInterface language: ${uiLang}.${voiceHint}`;
  const opts = { punjabi: req.body?.lang === "pa" || undefined, short: !!req.body?.voice };

  // Streaming: the browser asks for it with {stream:true} and gets words as they are written.
  if (req.body?.stream) {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    const ac = new AbortController();
    res.on("close", () => { if (!res.writableEnded) ac.abort(); });
    const send = (o) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(o)}\n\n`); };
    const out = await askAIStream(messages, system, opts, (d) => send({ d }), ac.signal);
    if (out.aborted) return;
    if (out.error && !out.reply) send({ error: out.error }); else send({ done: true });
    return res.end();
  }

  const parts = [];
  const out = await askAIStream(messages, system, opts, (d) => parts.push(d));
  if (out.error && !out.reply) return res.status(502).json({ error: out.error });
  res.json({ reply: out.reply });
});


// Open http://localhost:3000/api/test to check the connection.
app.get("/api/test", async (_req, res) => {
  const lines = [];
  for (const p of Object.keys(KEYS).filter((x) => KEYS[x])) {
    let out;
    try { out = await ASK[p]([{ role: "user", content: "Say hello in one short sentence." }], "You are a test.", KEYS[p]); }
    catch { out = { error: "Could not reach the service." }; }
    lines.push(out.reply ? `${PROVIDER_NAME[p]}: WORKING. Reply: ${out.reply}` : `${PROVIDER_NAME[p]}: NOT WORKING. ${out.error}`);
  }
  res.type("text").send(lines.length ? lines.join("\n\n") : "NOT WORKING: " + NO_KEY);
});


app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    const apiKey = KEYS.horde; // आपके पास जो apiKey है

    if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
    }

    try {
        const response = await fetch('https://stablehorde.net/api/v2/generate/async', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                prompt: prompt,
                params: { sampler_name: 'k_euler_a', steps: 30 }
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  res.status(404).sendFile(path.join(process.cwd(), "public", "404.html"));
});

// Warm up the connections to the AI services, so the first question does not pay for the slow handshake.
const warm = () => ["https://api.groq.com", "https://generativelanguage.googleapis.com", "https://aiplatform.googleapis.com"].forEach((u) => fetch(u, { method: "HEAD", signal: AbortSignal.timeout(5000) }).catch(() => {}));
setTimeout(warm, 500);
setInterval(warm, 4 * 60_000).unref();

app.listen(PORT, () => {
  console.log(`Punjab AI running at http://localhost:${PORT}`);
  console.log("Google sign-in: on");
  const on = Object.keys(KEYS).filter((p) => KEYS[p]).map((p) => PROVIDER_NAME[p]);
  console.log(on.length ? `AI providers: ${on.join(", ")}. Test them at http://localhost:${PORT}/api/test` : NO_KEY);
});
