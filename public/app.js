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
  plankton: "Common",
  tooclever: "Popular alternative",
  schooler: "Uncommon",
  rare: "Rare",
  deepcut: "Very rare",
  krillion: "Standout",
  miss: "No score",
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
const SESSION_KEY = "counterline-session-v1";
const LEGACY_SESSION_KEY = "fresh-tracks-session-v1";
let session = null,
  state = null,
  view = "",
  busy = false,
  offset = 0,
  sound = storage.getItem("counterline-sound") === "on",
  audio,
  generation = 0,
  polling = false;
let knownCount = 0,
  knownIds = null,
  knownAliases = {},
  ignoredCorrection = null;
const descent = createDescent();
$("name").value =
  storage.getItem("counterline-name") ??
  storage.getItem("fresh-tracks-name") ??
  "";
$("name").addEventListener("input", () =>
  storage.setItem("counterline-name", $("name").value),
);
function soundLabel() {
  $("sound").textContent = sound ? "SOUND ON" : "SOUND OFF";
  $("sound").setAttribute("aria-pressed", String(sound));
}
soundLabel();
function saveSession() {
  try {
    session
      ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      : sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
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
  $("run-number").textContent = "SOLO OR WITH FRIENDS";
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
    ? `${knownCount} questions · ${left ? left + " unseen on this device" : "all played; oldest questions return first"}`
    : "Questions are selected automatically.";
}
function setBusy(value) {
  busy = value;
  for (const el of document.querySelectorAll(
    "#start, #group-start, #answerform button, #joinform button, #nameform button, [data-next], #skip, #again, #new-run, #confirm-correction, #dismiss-correction",
  ))
    el.disabled = value;
  for (const button of document.querySelectorAll("[data-busy-label]")) {
    button.textContent = button.dataset.busyLabel;
    delete button.dataset.busyLabel;
    button.setAttribute("aria-busy", "false");
  }
  if (value) {
    const focused = document.activeElement;
    const pending =
      focused instanceof HTMLButtonElement && focused.getClientRects().length
        ? focused
        : (document.querySelector(
            "#answerform button, .ready-card [data-next], #again",
          ) ?? $("start"));
    pending.setAttribute("aria-busy", "true");
    pending.dataset.busyLabel = pending.textContent;
    pending.textContent = "PLEASE WAIT…";
  }
}
function connectionFailed() {
  $("connection").textContent =
    state?.phase === "answering"
      ? "Connection lost. Reconnecting… Your timer continues."
      : "Connection lost. Reconnecting…";
  $("connection").hidden = false;
}
function report(error) {
  if (error.expired) showHome();
  $("error").textContent =
    error.name === "TimeoutError"
      ? "The server took too long to respond. Please try again."
      : error instanceof TypeError
        ? "Could not connect. Please try again."
        : error.message;
}
async function api(action, data = {}) {
  const sentAt = performance.now();
  const r = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, ...data }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw Error("The server is waking up. Please try again in a moment.");
  const d = await r.json();
  d.receivedAt = Date.now();
  d.roundTripMs = performance.now() - sentAt;
  $("connection").hidden = true;
  if (!r.ok) {
    const error = Error(d.error ?? "The request failed. Please try again.");
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
    if (
      started === generation &&
      action === "answer" &&
      state?.correction &&
      state.correction.id !== ignoredCorrection
    )
      $("confirm-correction")?.focus({ preventScroll: true });
  }
}
async function startRun({ invite = false } = {}) {
  if (busy) return;
  setBusy(true);
  $("error").textContent = "";
  try {
    newSession(
      await api("start", { name: $("name").value, seen: readHistory(storage) }),
    );
    if (invite) $("invite").click();
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
$("group-start").onclick = () => startRun({ invite: true });
$("new-run").onclick = startRun;
$("joinform").onsubmit = (event) => {
  event.preventDefault();
  join($("code").value.trim());
};
$("sound").onclick = () => {
  sound = !sound;
  storage.setItem("counterline-sound", sound ? "on" : "off");
  soundLabel();
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
      title: "Join my Counterline game",
      text: "Seven questions. Join my game with this link.",
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
  if (!busy) $("confirm-correction").focus({ preventScroll: true });
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
  const retry = details.querySelector(".sheet-retry"),
    more = details.querySelector(".sheet-more"),
    list = details.querySelector(".answer-list");
  retry.hidden = true;
  more.disabled = true;
  list.setAttribute("aria-busy", "true");
  status.textContent = "Loading answers…";
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
    const html = result.answers
      .map((a) => `<div>${escape(a.answer)} <b>· ${a.score}</b></div>`)
      .join("");
    if (offset) list.insertAdjacentHTML("beforeend", html);
    else list.innerHTML = html || "No matching answers.";
    const loaded = offset + result.answers.length;
    status.textContent = `${loaded} of ${result.total} answers`;
    more.disabled = false;
    list.setAttribute("aria-busy", "false");
    more.hidden = loaded >= result.total;
    more.onclick = () => paintAnswers(details, query, loaded);
  } catch (error) {
    if (
      details.isConnected &&
      current === generation &&
      sheetTickets.get(details) === ticket
    ) {
      status.textContent = error.message;
      list.setAttribute("aria-busy", "false");
      retry.hidden = false;
      retry.onclick = () => paintAnswers(details, query, offset);
    }
  }
}
function render(s) {
  if (state?.code === s.code && s.revision < state.revision) return;
  if (s.code === state?.code && !s.answers && state.answers)
    s.answers = state.answers;
  const prior = state;
  state = s;
  offset =
    s.serverNow + (s.roundTripMs ?? 0) / 2 - (s.receivedAt ?? Date.now());
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
    s.phase === "answering" ? "INVITE BETWEEN TURNS" : "INVITE FRIENDS";
  $("run-number").textContent =
    s.board.length > 1
      ? "SHARED RUN · " + s.board.length + " SKIERS"
      : "SOLO RUN";
  $("dots").innerHTML = Array.from(
    { length: 7 },
    (_, i) => `<i class="${i < s.results.length ? "done" : ""}"></i>`,
  ).join("");
  $("dots").setAttribute(
    "aria-label",
    `${s.results.length} of 7 questions complete`,
  );
  if ($("player-label")) $("player-label").textContent = `Name: ${s.name}`;
  $("roundlabel").textContent =
    s.results.length === 7
      ? "RUN COMPLETE"
      : `QUESTION ${s.phase === "feedback" ? s.round : s.round + 1} / 7`;
  $("leaderboard").hidden = s.board.length < 2;
  $("board").innerHTML = s.board
    .map(
      (p, i) =>
        `<li class="${p.isYou ? "you" : ""}"><div>${i + 1}. ${escape(p.name)}${p.isYou ? " (you)" : ""}<small>${p.done ? "Finished" : p.rounds + " of 7 complete"}</small></div><b>${p.score}<small>points</small></b></li>`,
    )
    .join("");
  const key = s.code + ":" + s.phase + ":" + s.round;
  if (key === view) {
    if ($("rejected") && Object.hasOwn(s, "rejected"))
      $("rejected").textContent = s.rejected;
    renderCorrection(s);
    return;
  }
  const previous = view;
  view = key;
  ignoredCorrection = null;
  const stage = $("stage");
  stage.classList.remove("urgent");
  if (s.phase === "intro") {
    stage.innerHTML = `<div class="ready-card"><span class="ready-tag">TIMER NOT STARTED</span><h2>Ready to start?</h2><p class="hint">Start the timer to reveal your first question. You can invite friends before starting.</p><button data-next class="primary">START TIMER · 25 SECONDS</button><button id="ready-invite" class="secondary ready-invite">INVITE FRIENDS</button><details class="name-editor"><summary><span id="player-label">Name: ${escape(s.name)}</span> · Change</summary><form id="nameform"><label for="player-name">Your name</label><div class="input-row"><input id="player-name" maxlength="24" required autocomplete="nickname" value="${escape(s.name)}"><button class="secondary" type="submit">SAVE</button></div><p id="name-status" role="status"></p></form></details></div>`;
    $("ready-invite").onclick = () => $("invite").click();
    $("nameform").onsubmit = async (event) => {
      event.preventDefault();
      const name = $("player-name").value.trim();
      if (!name) return;
      await act("name", { name });
      if (state?.name === name) {
        $("name-status").textContent = "Name saved.";
        storage.setItem("counterline-name", name);
        $("name").value = name;
      }
    };
  } else if (s.phase === "answering") {
    const left = Math.max(0, Math.min(25000, s.deadline - Date.now() - offset));
    stage.innerHTML = `<div class="kicker">QUESTION ${s.round + 1} OF 7</div><h2 id="question" tabindex="-1">${escape(s.question.text)}</h2>${s.question.note ? `<p class="question-note" id="question-note">${escape(s.question.note)}</p>` : ""}<div class="clockline"><span>SECONDS LEFT</span><strong id="seconds" role="timer" aria-live="off">${(left / 1000).toFixed(1)}</strong></div><div class="timer" aria-hidden="true"><i id="bar" style="width:${left / 250}%"></i></div><form id="answerform"><label class="sr-only" for="answer">Your answer</label><input id="answer" aria-describedby="question${s.question.note ? " question-note" : ""}" placeholder="Type your answer" maxlength="160" autocomplete="off" autocapitalize="sentences" spellcheck="false" required><button type="submit" class="primary">SUBMIT</button></form><p id="rejected" role="status"></p><section id="correction" class="correction" aria-label="Answer correction" hidden></section><button id="skip" class="text-button">Pass this turn</button>`;
    if (s.correction) $("answer").value = s.correction.from;
    $("answer").addEventListener("input", () => {
      $("rejected").textContent = "";
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
    stage.innerHTML = `<div class="feedback" data-tier="${r.tier}"><h2 id="feedback-title" class="tier" tabindex="-1">${tiers[r.tier]}</h2><div class="points">+${r.score}<small> points</small></div><p class="answerlabel">${escape(r.answer ?? r.raw ?? "No answer submitted")}</p><p class="hint">${r.score ? `${(r.score * 10).toLocaleString()} metres skied` : "No points this question."}</p><button data-next class="primary">NEXT QUESTION</button></div>`;
  } else {
    if (previous) tone(s.results.at(-1).tier);
    stage.innerHTML = `<h2 id="result-title" tabindex="-1">Run complete</h2><div class="result-total">${score}<small> / 700 points</small></div><p class="hint">${(score * 10).toLocaleString()} metres skied${s.board.length > 1 ? " · Scores update as friends finish." : ""}</p><div class="finish-actions"><button id="again" class="primary">PLAY AGAIN</button></div>${s.freshCount < 7 ? '<p class="recycle-note">Some questions are repeats. Once every question has been seen, the oldest ones return first.</p>' : ""}${s.results.map((r, i) => `<div class="resultrow"><div><small>${i + 1}. ${escape(r.prompt)}</small>${escape(r.answer ?? r.raw ?? "—")}</div><span>${tiers[r.tier]}<br><b>+${r.score} points</b></span></div>`).join("")}<div class="sheets"><h3>Answers & sources</h3>${(s.answers ?? []).map(resultSheet).join("")}</div>`;
    $("again").onclick = startRun;
    for (const details of stage.querySelectorAll(".answer-sheet"))
      details.addEventListener("toggle", () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "true";
        const index = details.dataset.sheet;
        details.querySelector(".sheet-content").innerHTML =
          `<input aria-label="Search answers for question ${Number(index) + 1}" placeholder="Search answers" maxlength="80"><p class="sheet-status" role="status"></p><div class="answer-list" role="region" tabindex="0" aria-label="Answers for question ${Number(index) + 1}"></div><button class="text-button sheet-more" hidden>Show 100 more</button><button class="secondary sheet-retry" hidden>RETRY</button><p class="sheet-credit"></p>`;
        let debounce;
        details.querySelector("input").oninput = (event) => {
          clearTimeout(debounce);
          const query = event.target.value;
          debounce = setTimeout(() => paintAnswers(details, query), 250);
        };
        const descriptor = state.answers[Number(index)];
        const credit =
          descriptor.scoring === "recorded"
            ? "Recorded answer tiers."
            : "House ratings estimate familiarity, not player popularity.";
        details.querySelector(".sheet-credit").innerHTML =
          `${credit} <a href="${escape(descriptor.source)}" target="_blank" rel="noreferrer">Question source ↗</a>`;
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
  const target =
    s.phase === "intro"
      ? stage.querySelector("[data-next]")
      : s.phase === "feedback"
        ? $("feedback-title")
        : s.phase === "done"
          ? $("result-title")
          : innerWidth < 761
            ? $("question")
            : $("answer");
  requestAnimationFrame(() => {
    if (target?.isConnected && !$("invite-dialog").open)
      target.focus({ preventScroll: true });
  });
}
setInterval(() => {
  if (state?.phase !== "answering") return;
  const left = Math.max(
    0,
    Math.min(25000, state.deadline - Date.now() - offset),
  );
  if ($("seconds")) {
    $("seconds").textContent = (left / 1000).toFixed(1);
    $("bar").style.width = left / 250 + "%";
    $("stage").classList.toggle("urgent", left < 5000);
  }
}, 100);
async function pollState() {
  if (!session || busy || polling || document.visibilityState === "hidden")
    return;
  polling = true;
  const started = generation;
  try {
    const s = await api("state", { summary: !!state?.answers });
    if (started === generation && !busy) render(s);
  } catch (error) {
    if (started === generation) {
      if (error.expired) report(error);
      else connectionFailed();
    }
  } finally {
    polling = false;
  }
}
setInterval(pollState, 1200);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") pollState();
});
window.addEventListener("online", pollState);
window.addEventListener("offline", () => {
  if (session) connectionFailed();
});

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
    session = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) ??
        sessionStorage.getItem(LEGACY_SESSION_KEY),
    );
    saveSession();
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
