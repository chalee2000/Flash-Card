const KEY_KNOWN = "flashcard.known", KEY_CUSTOM = "flashcard.custom";
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let custom = load(KEY_CUSTOM, []);
let known = new Set(load(KEY_KNOWN, []));
let deck = [], idx = 0;

const $ = id => document.getElementById(id);
const allWords = () => WORDS.concat(custom.map(c => [c[0], c[1], c[2], "คำของฉัน"]));

function buildCategories() {
  const cur = $("category").value || "ทั้งหมด";
  const cats = ["ทั้งหมด", ...new Set(allWords().map(w => w[3]))];
  $("category").innerHTML = cats.map(c => `<option>${c}</option>`).join("");
  $("category").value = cats.includes(cur) ? cur : "ทั้งหมด";
}

function buildDeck(shuffle = false) {
  const cat = $("category").value;
  deck = allWords().filter(w => (cat === "ทั้งหมด" || w[3] === cat) && !($("hideKnown").checked && known.has(w[0])));
  if (shuffle) for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  idx = 0; render();
}

function render() {
  $("card").classList.remove("flipped");
  const total = allWords().length;
  $("bar").style.width = (known.size / total * 100) + "%";
  if (!deck.length) {
    $("word").textContent = "🎉 ไม่มีการ์ดเหลือ"; $("phon").textContent = ""; $("meaning").textContent = ""; $("example").textContent = "";
    $("status").textContent = `จำได้แล้ว ${known.size}/${total} คำ`; return;
  }
  const [en, th, ex] = deck[idx];
  $("word").textContent = en; $("meaning").textContent = th; $("example").textContent = ex || "";
  $("phon").textContent = (IPA[en] || "") + (known.has(en) ? "  ✓ จำได้แล้ว" : "");
  $("status").textContent = `การ์ด ${idx + 1}/${deck.length} · จำได้แล้ว ${known.size}/${total} คำ`;
}

const flip = () => $("card").classList.toggle("flipped");
const move = d => { if (!deck.length) return; idx = (idx + d + deck.length) % deck.length; render(); };
const speakText = text => {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US"; u.rate = 0.9;
  const voices = speechSynthesis.getVoices().filter(v => /^en[-_]US$/i.test(v.lang));
  const v = voices.find(v => /google us|samantha|aria|jenny|zira|alex/i.test(v.name)) || voices[0];
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
};
const speak = () => { if (deck.length) speakText(deck[idx][0]); };
function mark(isKnown) {
  if (!deck.length) return;
  const en = deck[idx][0];
  isKnown ? known.add(en) : known.delete(en);
  save(KEY_KNOWN, [...known]);
  if (isKnown && $("hideKnown").checked) { deck.splice(idx, 1); if (idx >= deck.length) idx = 0; render(); }
  else move(1);
}

$("card").onclick = flip;
$("speak").onclick = e => { e.stopPropagation(); speak(); };
$("next").onclick = () => move(1);
$("prev").onclick = () => move(-1);
$("known").onclick = () => mark(true);
$("unknown").onclick = () => mark(false);
$("shuffle").onclick = () => buildDeck(true);
$("category").onchange = () => { buildDeck(); if (mode === "quiz") quizSetup(); else if (mode === "game") gameSetup(); };
$("hideKnown").onchange = () => buildDeck();
$("reset").onclick = () => { if (confirm("ล้างความคืบหน้าทั้งหมด?")) { known.clear(); save(KEY_KNOWN, []); buildDeck(); } };
$("addForm").onsubmit = e => {
  e.preventDefault();
  custom.push([$("newEn").value.trim(), $("newTh").value.trim(), $("newEx").value.trim()]);
  save(KEY_CUSTOM, custom); e.target.reset(); buildCategories(); buildDeck();
};
document.addEventListener("keydown", e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (mode === "quiz") {
    if ($("quizPlay").hidden) return;
    if (/^[1-4]$/.test(e.key)) answer(+e.key - 1);
    else if ((e.key === "Enter" || e.key === " ") && Q.answered) { e.preventDefault(); nextQuestion(); }
    return;
  }
  if (mode !== "study") return;
  if (e.key === " ") { e.preventDefault(); flip(); }
  else if (e.key === "ArrowRight") move(1);
  else if (e.key === "ArrowLeft") move(-1);
  else if (e.key.toLowerCase() === "k") mark(true);
});

// ---------- ระบบรางวัล ----------
const KEY_REWARD = "flashcard.rewards";
const R = Object.assign({ points: 0, quizzes: 0, correct: 0, perfect: 0, bestStreak: 0, bestPct: 0, games: 0, flawless: 0, dirs: {}, badges: [] }, load(KEY_REWARD, {}));
const saveR = () => save(KEY_REWARD, R);
const MIN_COUNTED = 5; // ต้องทำอย่างน้อย 5 ข้อจึงนับเป็นรอบทดสอบ
const LEVELS = [[0, "มือใหม่", "🌱"], [100, "นักเรียน", "📘"], [200, "นักอ่าน", "📖"], [300, "นักท่องศัพท์", "🧭"], [500, "นักสำรวจ", "🔍"], [700, "ผู้ชำนาญ", "🎓"], [1000, "ผู้เชี่ยวชาญ", "🏅"], [1500, "ปรมาจารย์", "👑"], [2200, "อัจฉริยะ", "🧠"], [3000, "ตำนาน", "🌟"], [5000, "เทพศัพท์", "🔱"]];
const BADGES = [
  ["first", "🎯", "ทดสอบครั้งแรก", "ทำแบบทดสอบจนจบ 1 รอบ", r => r.quizzes >= 1],
  ["perfect", "🏆", "เต็มทุกข้อ", "ตอบถูกทุกข้อในรอบเดียว", r => r.perfect >= 1],
  ["streak5", "🔥", "ถูกติดกัน 5 ข้อ", "ตอบถูกต่อเนื่อง 5 ข้อ", r => r.bestStreak >= 5],
  ["streak10", "⚡", "ถูกติดกัน 10 ข้อ", "ตอบถูกต่อเนื่อง 10 ข้อ", r => r.bestStreak >= 10],
  ["both", "🔄", "ครบสองทิศทาง", "ทำทั้งอังกฤษ→ไทย และไทย→อังกฤษ", r => r.dirs.en && r.dirs.th],
  ["pts100", "🥉", "100 แต้ม", "สะสมครบ 100 แต้ม", r => r.points >= 100],
  ["pts500", "🥈", "500 แต้ม", "สะสมครบ 500 แต้ม", r => r.points >= 500],
  ["pts1000", "🥇", "1,000 แต้ม", "สะสมครบ 1,000 แต้ม", r => r.points >= 1000],
  ["quizzes10", "📚", "ขยัน", "ทำแบบทดสอบครบ 10 รอบ", r => r.quizzes >= 10],
  ["game1", "🧩", "เล่นเกมจับคู่", "เล่นเกมจับคู่จนจบ 1 รอบ", r => r.games >= 1],
  ["flawless", "🎴", "จับคู่ไม่พลาด", "จับคู่ครบโดยพลิกแค่ 6 ครั้ง", r => r.flawless >= 1],
  ["correct100", "💯", "ถูกสะสม 100 ข้อ", "ตอบถูกสะสมครบ 100 ข้อ", r => r.correct >= 100]
];
const levelOf = p => LEVELS.reduce((acc, l, k) => (p >= l[0] ? k : acc), 0);

function unlockBadges() {
  const fresh = BADGES.filter(b => !R.badges.includes(b[0]) && b[4](R));
  fresh.forEach(b => R.badges.push(b[0]));
  if (fresh.length) saveR();
  return fresh;
}

function renderRewards() {
  const li = levelOf(R.points), cur = LEVELS[li], nxt = LEVELS[li + 1];
  $("rwLevel").textContent = `${cur[2]} ระดับ ${cur[1]}`;
  $("rwPoints").textContent = `⭐ ${R.points.toLocaleString("en-US")} แต้ม`;
  $("rwNext").textContent = nxt ? `อีก ${nxt[0] - R.points} แต้มถึงระดับ ${nxt[1]}` : "ถึงระดับสูงสุดแล้ว";
  $("rwBar").style.width = (nxt ? (R.points - cur[0]) / (nxt[0] - cur[0]) * 100 : 100) + "%";
  $("rwBest").textContent = R.quizzes ? `คะแนนสูงสุด ${R.bestPct}% · ทำแล้ว ${R.quizzes} รอบ` : "ยังไม่เคยทำแบบทดสอบ";
  $("badges").replaceChildren(...BADGES.map(b => {
    const on = R.badges.includes(b[0]), d = document.createElement("div");
    d.className = "badge" + (on ? " on" : "");
    const ic = document.createElement("span"), name = document.createElement("strong"), desc = document.createElement("small");
    ic.className = "ic"; ic.textContent = on ? b[1] : "🔒";
    name.textContent = b[2]; desc.textContent = b[3];
    d.append(ic, name, desc);
    return d;
  }));
}

// ---------- แบบทดสอบ ----------
let mode = "study";
const Q = { dir: "en", qs: [], i: 0, score: 0, wrong: [], answered: false, opts: [], cur: null, pts: 0, streak: 0, retry: false, lvl0: 0 };
const shuffled = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const catPool = () => { const cat = $("category").value; return allWords().filter(w => cat === "ทั้งหมด" || w[3] === cat); };
const show = (id, on) => { $(id).hidden = !on; };

function setMode(m) {
  mode = m;
  clearInterval(G.timer);
  show("study", m === "study"); show("studyTools", m === "study"); show("quiz", m === "quiz"); show("game", m === "game");
  show("rewardsPanel", false);
  $("modeStudy").setAttribute("aria-pressed", m === "study");
  $("modeQuiz").setAttribute("aria-pressed", m === "quiz");
  $("modeGame").setAttribute("aria-pressed", m === "game");
  if (m === "quiz") quizSetup();
  if (m === "game") gameSetup();
}

function quizSetup() {
  show("quizSetup", true); show("quizPlay", false); show("quizResult", false);
  const n = catPool().length;
  $("quizInfo").textContent = n ? `หมวดนี้มี ${n} คำ เลือกหมวดจากเมนูด้านบน` : "หมวดนี้ยังไม่มีคำ";
  $("quizStart").disabled = !n;
  show("rewardsPanel", true); renderRewards();
}

function startQuiz(words, retry = false) {
  Q.dir = $("quizDir").value; Q.qs = words; Q.i = 0; Q.score = 0; Q.wrong = [];
  Q.pts = 0; Q.streak = 0; Q.retry = retry; Q.lvl0 = levelOf(R.points);
  show("quizSetup", false); show("quizResult", false); show("rewardsPanel", false); show("quizPlay", true);
  showQuestion();
}

function showQuestion() {
  const w = Q.qs[Q.i], p = Q.dir === "en" ? 0 : 1, a = 1 - p;
  const cands = allWords().filter(x => x[0] !== w[0] && x[p] !== w[p]);
  const seen = new Set([w[a]]), opts = [w];
  for (const x of [...shuffled(cands.filter(x => x[3] === w[3])), ...shuffled(cands.filter(x => x[3] !== w[3]))]) {
    if (opts.length === 4) break;
    if (!seen.has(x[a])) { seen.add(x[a]); opts.push(x); }
  }
  Q.opts = shuffled(opts); Q.answered = false; Q.cur = w;
  $("qWord").textContent = w[p];
  $("qPhon").textContent = Q.dir === "en" ? (IPA[w[0]] || "") : "";
  show("qSpeak", Q.dir === "en");
  $("opts").replaceChildren(...Q.opts.map((o, k) => {
    const b = document.createElement("button");
    b.className = "opt"; b.textContent = `${k + 1}. ${o[a]}`; b.onclick = () => answer(k);
    return b;
  }));
  $("qFeedback").textContent = ""; $("qFeedback").className = "feedback";
  show("qNext", false);
  quizProgress();
}

function quizProgress() {
  $("quizStatus").textContent = `ข้อ ${Q.i + 1}/${Q.qs.length} · ถูก ${Q.score} · ⭐ ${Q.pts}`;
  $("quizBar").style.width = ((Q.i + (Q.answered ? 1 : 0)) / Q.qs.length * 100) + "%";
}

function answer(k) {
  if (Q.answered || k >= Q.opts.length) return;
  Q.answered = true;
  const w = Q.cur, a = Q.dir === "en" ? 1 : 0, ok = Q.opts[k] === w, btns = $("opts").children;
  Q.opts.forEach((o, j) => { if (o === w) btns[j].classList.add("right"); btns[j].disabled = true; });
  let gain = 0, bonus = 0;
  if (ok) {
    Q.score++; Q.streak++;
    gain = 10; bonus = Q.streak >= 3 ? 5 : 0;
    Q.pts += gain + bonus; R.points += gain + bonus; R.correct++;
    R.bestStreak = Math.max(R.bestStreak, Q.streak);
    saveR();
  } else { btns[k].classList.add("wrong"); Q.wrong.push(w); Q.streak = 0; }
  $("qFeedback").textContent = (ok ? `✓ ถูกต้อง +${gain}` + (bonus ? ` +${bonus} 🔥 ติดกัน ${Q.streak} ข้อ` : "") : `✗ ผิด · คำตอบคือ ${w[a]}`) + (w[2] ? `\n${w[2]}` : "");
  $("qFeedback").className = "feedback " + (ok ? "ok" : "no");
  $("qNext").textContent = Q.i + 1 < Q.qs.length ? "ถัดไป →" : "ดูผลคะแนน";
  show("qNext", true);
  quizProgress();
}

function nextQuestion() {
  if (!Q.answered) return;
  Q.i++;
  Q.i < Q.qs.length ? showQuestion() : showResult();
}

function showResult() {
  show("quizPlay", false); show("quizResult", true);
  const n = Q.qs.length, pct = Math.round(Q.score / n * 100);
  $("resScore").textContent = `${Q.score}/${n} (${pct}%)`;
  $("resMsg").textContent = pct === 100 ? "🎉 เต็มทุกข้อ" : pct >= 80 ? "เก่งมาก" : pct >= 50 ? "ดีแล้ว ทบทวนอีกนิด" : "ลองท่องคำศัพท์อีกรอบแล้วทำใหม่";
  const counted = !Q.retry && n >= MIN_COUNTED, perfect = counted && Q.score === n;
  if (counted) {
    R.quizzes++; R.dirs[Q.dir] = true; R.bestPct = Math.max(R.bestPct, pct);
    if (perfect) { R.perfect++; R.points += 50; Q.pts += 50; }
    saveR();
  }
  const fresh = unlockBadges();
  $("resPoints").textContent = `ได้ +${Q.pts} แต้ม` + (perfect ? " (รวมโบนัสเต็มทุกข้อ +50)" : "") + (counted ? "" : `\n(รอบนี้ไม่นับสถิติ ต้องทำใหม่อย่างน้อย ${MIN_COUNTED} ข้อ ไม่ใช่รอบทำซ้ำข้อที่ผิด)`);
  const lines = fresh.map(b => `🎉 ปลดล็อก ${b[1]} ${b[2]}`);
  const lv = levelOf(R.points);
  if (lv > Q.lvl0) lines.unshift(`⬆️ เลื่อนระดับเป็น ${LEVELS[lv][2]} ${LEVELS[lv][1]}`);
  $("resBadges").replaceChildren(...lines.map(t => { const li = document.createElement("li"); li.textContent = t; return li; }));
  $("resWrong").replaceChildren(...Q.wrong.map(w => { const li = document.createElement("li"); li.textContent = `${w[0]} — ${w[1]}`; return li; }));
  show("retryWrong", Q.wrong.length > 0);
}

$("modeStudy").onclick = () => setMode("study");
$("modeQuiz").onclick = () => setMode("quiz");
$("quizStart").onclick = () => startQuiz(shuffled(catPool()).slice(0, +$("quizCount").value));
$("quizAgain").onclick = quizSetup;
$("retryWrong").onclick = () => startQuiz(shuffled(Q.wrong), true);
$("qNext").onclick = nextQuestion;
$("qSpeak").onclick = () => speakText(Q.cur[0]);

// ---------- เกมจับคู่ ----------
const G = { tiles: [], first: null, lock: false, moves: 0, found: 0, t0: 0, pts: 0, lvl0: 0, timer: null };
const pickPairs = () => {
  const out = [], seen = new Set();
  for (const w of shuffled(catPool())) {
    if (!seen.has(w[1])) { seen.add(w[1]); out.push(w); }
    if (out.length === 6) break;
  }
  return out;
};
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function gameSetup() {
  clearInterval(G.timer);
  show("gameSetup", true); show("gamePlay", false); show("gameResult", false);
  const ok = pickPairs().length === 6;
  $("gameInfo").textContent = ok ? "เลือกหมวดจากเมนูด้านบน แล้วกดเริ่มเล่น" : "หมวดนี้มีคำไม่พอ ต้องมีอย่างน้อย 6 คำที่ความหมายไม่ซ้ำกัน";
  $("gameStart").disabled = !ok;
  show("rewardsPanel", true); renderRewards();
}

function gameStatus() {
  const s = Math.floor((Date.now() - G.t0) / 1000);
  $("gameStatus").textContent = `พลิก ${G.moves} ครั้ง · พบ ${G.found}/6 คู่ · ⏱ ${fmtTime(s)}`;
}

function startGame() {
  const pairs = pickPairs();
  if (pairs.length < 6) return;
  Object.assign(G, { first: null, lock: false, moves: 0, found: 0, pts: 0, lvl0: levelOf(R.points), t0: Date.now() });
  G.tiles = shuffled(pairs.flatMap(w => [{ key: w[0], text: w[0], en: true }, { key: w[0], text: w[1], en: false }]));
  show("gameSetup", false); show("gameResult", false); show("rewardsPanel", false); show("gamePlay", true);
  $("board").replaceChildren(...G.tiles.map((t, i) => {
    const b = document.createElement("button");
    b.className = "tile"; b.textContent = "❓"; b.setAttribute("aria-label", `การ์ดใบที่ ${i + 1}`);
    b.onclick = () => flipTile(i);
    t.el = b;
    return b;
  }));
  clearInterval(G.timer); G.timer = setInterval(gameStatus, 1000); gameStatus();
}

function flipTile(i) {
  const t = G.tiles[i];
  if (G.lock || t.up || t.done) return;
  t.up = true; t.el.textContent = t.text; t.el.classList.add("up");
  if (t.en) speakText(t.text);
  if (G.first === null) { G.first = i; return; }
  const a = G.tiles[G.first], b = t;
  G.first = null; G.moves++;
  if (a.key === b.key) {
    a.done = b.done = true; a.el.classList.add("done"); b.el.classList.add("done");
    G.found++; G.pts += 10; R.points += 10; saveR(); gameStatus();
    if (G.found === 6) { G.lock = true; clearInterval(G.timer); setTimeout(finishGame, 600); }
  } else {
    G.lock = true; gameStatus();
    setTimeout(() => {
      for (const x of [a, b]) { x.up = false; x.el.textContent = "❓"; x.el.classList.remove("up"); }
      G.lock = false;
    }, 800);
  }
}

function finishGame() {
  const secs = Math.floor((Date.now() - G.t0) / 1000);
  const bonus = G.moves <= 8 ? 40 : G.moves <= 12 ? 20 : 0;
  R.points += bonus; G.pts += bonus; R.games++;
  if (G.moves === 6) R.flawless++;
  saveR();
  const lines = unlockBadges().map(b => `🎉 ปลดล็อก ${b[1]} ${b[2]}`);
  const lv = levelOf(R.points);
  if (lv > G.lvl0) lines.unshift(`⬆️ เลื่อนระดับเป็น ${LEVELS[lv][2]} ${LEVELS[lv][1]}`);
  $("gResScore").textContent = `พลิก ${G.moves} ครั้ง · ${fmtTime(secs)}`;
  $("gResPoints").textContent = `ได้ +${G.pts} แต้ม` + (bonus ? ` (รวมโบนัสพลิกน้อย +${bonus})` : "");
  $("gResBadges").replaceChildren(...lines.map(t => { const li = document.createElement("li"); li.textContent = t; return li; }));
  show("gamePlay", false); show("gameResult", true);
}

$("modeGame").onclick = () => setMode("game");
$("gameStart").onclick = startGame;
$("gameAgain").onclick = gameSetup;

buildCategories(); buildDeck();
