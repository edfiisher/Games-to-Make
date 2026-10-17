import { readHistory, remember } from "./progress.js";
import { createDescent } from "./descent.js";

const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const tiers = {
  plankton: "● Green run",
  tooclever: "↺ Crowded line",
  schooler: "◆ Blue run",
  rare: "◆ Black run",
  deepcut: "✳ Off-piste",
  krillion: "✦ First tracks",
  miss: "— Caught an edge",
};
const storage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};
const SESSION_KEY = "fresh-tracks-session-v1";
let session = null,
  state = null,
  view = "",
  busy = false,
  offset = 0,
  sound = false,
  audio,
  generation = 0,
  polling = false;
let knownCount = 0,
  knownIds = null,
  knownAliases = {},
  ignoredCorrection = null;
const descent = createDescent();
$("name").value = storage.getItem("fresh-tracks-name") ?? "";
$("name").addEventListener("input", () =>
  storage.setItem("fresh-tracks-name", $("name").value),
);
function saveSession() {
  try {
    session
      ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      : sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
function newSession(s) {
  generation++;
  session = { code: s.code, playerId: s.playerId };
  state = null;
  view = "";
  saveSession();
  render(s);
  history.replaceState(null, "", "/");
}
function showHome() {
  generation++;
  session = null;
  state = null;
  view = "";
  saveSession();
  $("home").hidden = false;
  $("game").hidden = true;
  document.body.classList.remove("playing");
  $("run-number").textContent = "YOUR NEXT RUN AWAITS";
  descent.reset();
  updateBankNote();
  history.replaceState(null, "", "/");
}
function updateBankNote() {
  const seen = new Set(
    readHistory(storage)
      .map((id) => knownAliases[id] ?? id)
      .filter((id) => !knownIds || knownIds.has(id)),
  ).size;
  const left = Math.max(0, knownCount - seen);
  $("bank-note").textContent = knownCount
    ? `${knownCount} questions on the mountain · ${left ? left + " still unexplored" : "time to revisit some favourite lines"}`
    : "New turns, every time you play.";
}
function setBusy(value) {
  busy = value;
  for (const el of document.querySelectorAll(
    "#start, #answerform button, #joinform button, [data-next], #skip, #again, #new-run, #confirm-correction, #dismiss-correction",
  ))
    el.disabled = value;
}
function report(error) {
  if (error.expired) showHome();
  $("error").textContent =
    error.name === "TimeoutError"
      ? "The mountain is taking a moment. Please try again."
      : error.message;
}
async function api(action, data = {}) {
  const r = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, ...data }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw Error("The server is waking up. Please try again in a moment.");
  const d = await r.json();
  if (!r.ok) {
    const error = Error(d.error ?? "Could not reach the mountain. Try again.");
    error.expired = d.expired;
    error.state = d.state;
    throw error;
  }
  return d;
}
async function act(action, data = {}) {
  if (busy) return;
  const started = generation;
  setBusy(true);
  $("error").textContent = "";
  try {
    const s = await api(action, { roundId: state?.roundId, ...data });
    if (started === generation) render(s);
  } catch (error) {
    if (started === generation) {
      if (error.state) render(error.state);
      report(error);
    }
  } finally {
    setBusy(false);
  }
}
async function startRun() {
  if (busy) return;
  setBusy(true);
  $("error").textContent = "";
  try {
    newSession(
      await api("start", { name: $("name").value, seen: readHistory(storage) }),
    );
    if (innerWidth < 761)
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  } catch (error) {
    report(error);
  } finally {
    setBusy(false);
  }
}
async function join(code) {
  if (busy) return;
  setBusy(true);
  $("error").textContent = "";
  try {
    newSession(await api("join", { code, name: $("name").value }));
    if (innerWidth < 761)
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  } catch (error) {
    report(error);
  } finally {
    setBusy(false);
  }
}
$("start").onclick = startRun;
$("new-run").onclick = startRun;
$("joinform").onsubmit = (event) => {
  event.preventDefault();
  join($("code").value.trim());
};
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "SOUND ON" : "SOUND OFF";
  $("sound").setAttribute("aria-pressed", String(sound));
  if (sound) tone();
};
function tone(tier = "schooler") {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const notes = {
      plankton: [330],
      tooclever: [294, 330],
      schooler: [330, 440],
      rare: [330, 440, 554],
      deepcut: [330, 440, 554, 660],
      krillion: [330, 440, 554, 660, 880],
      miss: [220],
    }[tier] ?? [330];
    notes.forEach((note, i) => {
      const start = audio.currentTime + i * 0.1,
        o = audio.createOscillator(),
        g = audio.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(note, start);
      g.gain.setValueAtTime(0.035, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      o.connect(g).connect(audio.destination);
      o.start(start);
      o.stop(start + 0.3);
    });
  } catch {}
}

// Sharing is optional: every solo run can become a shared run.
$("invite").onclick = () => {
  if (!state || state.phase === "answering") return;
  $("invite-link").value = location.origin + "/?room=" + state.code;
  $("roomcode").textContent = state.code;
  $("share-status").textContent = "";
  $("share").hidden = !navigator.share;
  $("invite-dialog").showModal();
};
$("close-invite").onclick = () => $("invite-dialog").close();
$("invite-dialog").addEventListener("click", (event) => {
  if (event.target === $("invite-dialog")) {
    const r = event.target.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      event.target.close();
  }
});
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("invite-link").value);
    $("share-status").textContent = "Link copied. Send it to your friend.";
  } catch {
    $("invite-link").select();
    $("share-status").textContent =
      "Select and copy the link above, or send the invite code.";
  }
};
$("share").onclick = async () => {
  try {
    await navigator.share({
      title: "Join my Fresh Tracks run",
      text: "Same mountain. Same questions. Race you to the bottom?",
      url: $("invite-link").value,
    });
  } catch (error) {
    if (error.name !== "AbortError")
      $("share-status").textContent = "Try copying the link instead.";
  }
};

function renderCorrection(s) {
  const box = $("correction");
  if (!box) return;
  if (!s.correction || s.correction.id === ignoredCorrection) {
    box.hidden = true;
    box.dataset.id = "";
    return;
  }
  box.hidden = false;
  if (box.dataset.id === s.correction.id) return;
  box.dataset.id = s.correction.id;
  box.innerHTML = `<span class="correction-label">DID YOU MEAN…</span><p>${escape(s.correction.to)}?</p><div class="correction-actions"><button id="confirm-correction" class="primary" type="button">ACCEPT & SUBMIT ✓</button><button id="dismiss-correction" class="secondary" type="button">KEEP TYPING</button></div><small>Your original timer keeps running.</small>`;
  $("confirm-correction").onclick = () =>
    act("confirm", { correctionId: s.correction.id });
  $("dismiss-correction").onclick = async () => {
    await act("dismiss");
    $("answer")?.focus({ preventScroll: true });
  };
  setBusy(busy);
}
function resultSheet(q, index) {
  return `<details class="answer-sheet" data-sheet="${index}"><summary>${escape(q.text)}</summary><div class="sheet-content"></div></details>`;
}
const sheetTickets = new WeakMap();
async function paintAnswers(details, query = "", offset = 0) {
  const ticket = (sheetTickets.get(details) ?? 0) + 1;
  sheetTickets.set(details, ticket);
  const current = generation,
    status = details.querySelector(".sheet-status");
  status.textContent = "Loading recorded answers…";
  try {
    const result = await api("answers", {
      index: Number(details.dataset.sheet),
      query,
      offset,
    });
    if (
      current !== generation ||
      !details.isConnected ||
      sheetTickets.get(details) !== ticket
    )
      return;
    const list = details.querySelector(".answer-list");
    const html = result.answers
      .map((a) => `<div>${escape(a.answer)} <b>· ${a.score}</b></div>`)
      .join("");
    if (offset) list.insertAdjacentHTML("beforeend", html);
    else list.innerHTML = html || "No recorded match.";
    const loaded = offset + result.answers.length;
    status.textContent = `${loaded} of ${result.total} answers`;
    const more = details.querySelector(".sheet-more");
    more.hidden = loaded >= result.total;
    more.onclick = () => paintAnswers(details, query, loaded);
  } catch (error) {
    if (details.isConnected && current === generation)
      status.textContent = error.message;
  }
}
function render(s) {
  if (state?.code === s.code && s.revision < state.revision) return;
  if (s.code === state?.code && !s.answers && state.answers)
    s.answers = state.answers;
  const prior = state;
  state = s;
  offset = s.serverNow - Date.now();
  remember(storage, s.playedIds);
  knownCount = s.bankSize;
  $("home").hidden = true;
  $("game").hidden = false;
  document.body.classList.add("playing");
  $("error").textContent = "";
  const score = s.results.reduce((total, r) => total + r.score, 0);
  $("score").textContent = score;
  $("distance").innerHTML = (score * 10).toLocaleString() + "<span>m</span>";
  if (prior?.code !== s.code) descent.reset(score);
  else if (s.results.length > prior.results.length)
    descent.setScore(score, { tier: s.results.at(-1).tier, celebrate: true });
  else descent.setScore(score);
  $("invite").disabled = s.phase === "answering";
  $("invite").title =
    s.phase === "answering"
      ? "Invite before the timer starts or between turns"
      : "";
  $("invite").textContent =
    s.phase === "answering" ? "INVITE BETWEEN TURNS" : "INVITE A FRIEND ↗";
  $("run-number").textContent =
    s.board.length > 1
      ? "SHARED RUN · " + s.board.length + " SKIERS"
      : "SOLO RUN";
  $("dots").innerHTML = Array.from(
    { length: 7 },
    (_, i) => `<i class="${i < s.results.length ? "done" : ""}"></i>`,
  ).join("");
  $("roundlabel").textContent =
    s.results.length === 7
      ? "RUN COMPLETE"
      : `TURN ${s.phase === "feedback" ? s.round : s.round + 1} / 7`;
  $("leaderboard").hidden = s.board.length < 2;
  $("board").innerHTML = s.board
    .map(
      (p, i) =>
        `<li class="${p.isYou ? "you" : ""}"><div>${i + 1}. ${escape(p.name)}${p.isYou ? " (you)" : ""}<small>${p.done ? "At the valley" : p.rounds + " of 7 turns complete"}</small></div><b>${(p.score * 10).toLocaleString()}m</b></li>`,
    )
    .join("");
  const key = s.code + ":" + s.phase + ":" + s.round;
  if (key === view) {
    if ($("rejected")) $("rejected").textContent = s.rejected ?? "";
    renderCorrection(s);
    return;
  }
  const previous = view;
  view = key;
  ignoredCorrection = null;
  const stage = $("stage");
  stage.classList.remove("urgent");
  if (s.phase === "intro") {
    stage.innerHTML = `<div class="ready-card"><span class="ready-tag">● TIMER NOT STARTED</span><h2>Take your time<br>at the top.</h2><p class="hint">Invite your friends and get comfortable. The question stays hidden and the clock stays stopped until you press Start timer.</p><button data-next class="primary">START TIMER · 25 SECONDS ↘</button><button id="ready-invite" class="secondary ready-invite">INVITE A FRIEND ↗</button></div>`;
    $("ready-invite").onclick = () => $("invite").click();
  } else if (s.phase === "answering") {
    stage.innerHTML = `<div class="kicker">TURN ${s.round + 1} OF 7 · THINK OFF-PISTE</div><h2 id="question">${escape(s.question.text)}</h2>${s.question.note ? `<p class="question-note">${escape(s.question.note)}</p>` : ""}<div class="clockline"><span>FIND ONE RARE ANSWER</span><strong id="seconds">${(Math.max(0, s.deadline - s.serverNow) / 1000).toFixed(1)}</strong></div><div class="timer"><i id="bar" style="width:${Math.max(0, s.deadline - s.serverNow) / 250}%"></i></div><form id="answerform"><input id="answer" aria-label="Your answer" placeholder="Take a different line…" maxlength="160" autocomplete="off" required><button type="submit" class="primary">LET IT RUN ↘</button></form><p id="rejected" role="status"></p><section id="correction" class="correction" aria-label="Answer correction" hidden></section><button id="skip" class="text-button">Pass this turn</button>`;
    if (s.correction) $("answer").value = s.correction.from;
    $("answer").addEventListener("input", () => {
      if (state.correction) {
        ignoredCorrection = state.correction.id;
        $("correction").hidden = true;
      }
    });
    $("answerform").onsubmit = (event) => {
      event.preventDefault();
      act("answer", { answer: $("answer").value });
    };
    $("skip").onclick = () => act("skip");
    if (innerWidth >= 761) $("answer").focus({ preventScroll: true });
  } else if (s.phase === "feedback") {
    const r = s.results.at(-1);
    if (previous) tone(s.results.at(-1).tier);
    stage.innerHTML = `<div class="feedback" data-tier="${r.tier}"><span class="tier">${tiers[r.tier]}</span><div class="points">+${(r.score * 10).toLocaleString()}<small>m</small></div><p class="answerlabel">${escape(r.answer ?? r.raw ?? "No answer this turn")}</p><p class="hint">${r.score ? `+${r.score} points. A little further down the mountain.` : "No distance this time. A new line is coming."}</p><button data-next class="primary">NEXT TURN ↘</button></div>`;
  } else {
    if (previous) tone(s.results.at(-1).tier);
    stage.innerHTML = `<div class="kicker">THAT’S A WRAP. SKIS OFF.</div><div class="result-total">${(score * 10).toLocaleString()}<small> metres skied</small></div><p class="hint">${score} / 700 points · ${s.board.length > 1 ? "See how your friends are getting on below." : "Just you, seven turns, and a very good mountain."}</p><div class="finish-actions"><button id="again" class="primary">FRESH SNOW. ANOTHER RUN? ↘</button></div>${s.freshCount < 7 ? '<p class="recycle-note">You’re exploring familiar terrain. Once you’ve seen every question, the least recently played ones return.</p>' : ""}${s.results.map((r, i) => `<div class="resultrow"><div><small>${i + 1}. ${escape(r.prompt)}</small>${escape(r.answer ?? r.raw ?? "—")}</div><span>${tiers[r.tier]}<br><b>+${r.score * 10}m</b></span></div>`).join("")}<div class="sheets"><div class="kicker">THE LINES YOU COULD HAVE TAKEN</div>${(s.answers ?? []).map(resultSheet).join("")}</div>`;
    $("again").onclick = startRun;
    for (const details of stage.querySelectorAll(".answer-sheet"))
      details.addEventListener("toggle", () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "true";
        const index = details.dataset.sheet;
        details.querySelector(".sheet-content").innerHTML =
          `<input aria-label="Search answers for question ${Number(index) + 1}" placeholder="Search recorded answers…" maxlength="80"><p class="sheet-status" role="status"></p><div class="answer-list"></div><button class="text-button sheet-more" hidden>Show 100 more</button><p class="sheet-credit"></p>`;
        let debounce;
        details.querySelector("input").oninput = (event) => {
          clearTimeout(debounce);
          const query = event.target.value;
          debounce = setTimeout(() => paintAnswers(details, query), 250);
        };
        details.querySelector(".sheet-credit").textContent =
          state.answers[Number(index)].scoring === "recorded"
            ? "Recorded answer tiers from the cited companion archive."
            : "House rarity tiers use an English-language familiarity proxy, not player statistics.";
        paintAnswers(details);
      });
  }
  renderCorrection(s);
  if (prior && s.results.length > prior.results.length && innerWidth < 761)
    requestAnimationFrame(() =>
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
  for (const button of stage.querySelectorAll("[data-next]"))
    button.onclick = () => act("next");
  setBusy(busy);
}
setInterval(() => {
  if (state?.phase !== "answering") return;
  const left = Math.max(0, state.deadline - Date.now() - offset);
  if ($("seconds")) {
    $("seconds").textContent = (left / 1000).toFixed(1);
    $("bar").style.width = left / 250 + "%";
    $("stage").classList.toggle("urgent", left < 5000);
  }
}, 100);
setInterval(async () => {
  if (!session || busy || polling || document.visibilityState === "hidden")
    return;
  polling = true;
  const started = generation;
  try {
    const s = await api("state", { summary: !!state?.answers });
    if (started === generation && !busy) render(s);
  } catch (error) {
    if (started === generation) report(error);
  } finally {
    polling = false;
  }
}, 1200);

async function boot() {
  fetch("/api/info")
    .then((r) => r.json())
    .then((info) => {
      knownCount = info.questionCount;
      knownIds = new Set(info.questionIds ?? []);
      knownAliases = info.questionAliases ?? {};
      updateBankNote();
    })
    .catch(() => {});
  const invite = new URLSearchParams(location.search).get("room");
  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {}
  // A shared link takes priority over the run already open in this tab.
  if (invite) {
    if (session?.code === invite.toUpperCase()) {
      try {
        render(await api("state"));
        history.replaceState(null, "", "/");
        return;
      } catch {
        session = null;
      }
    }
    session = null;
    await join(invite);
    return;
  }
  if (session) {
    setBusy(true);
    try {
      const s = await api("state");
      if (s.phase === "done") {
        remember(storage, s.playedIds);
        showHome();
      } else render(s);
    } catch {
      showHome();
    } finally {
      setBusy(false);
    }
  }
}
boot();
