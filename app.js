const KEY_KNOWN = "flashcard.known", KEY_CUSTOM = "flashcard.custom";
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const DEFAULT_CAT = "คำของฉัน";

let custom = load(KEY_CUSTOM, []);
let known = new Set(load(KEY_KNOWN, []));
let deck = [], idx = 0;

const $ = id => document.getElementById(id);
const allWords = () => WORDS.concat(custom.map(c => [c[0], c[1], c[2], c[3] || DEFAULT_CAT]));

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
    $("word").textContent = "🎉 ไม่มีการ์ดเหลือ"; $("phon").textContent = ""; $("meaning").textContent = ""; $("example").textContent = ""; $("cardTag").textContent = ""; $("pic").hidden = true;
    $("status").textContent = `จำได้แล้ว ${known.size}/${total} คำ`; $("counter").textContent = "0 / 0"; return;
  }
  const [en, th, ex, cat] = deck[idx];
  $("cardTag").textContent = cat;
  renderPic(en);
  $("word").textContent = en; $("meaning").textContent = th; $("example").textContent = ex || "";
  $("phon").textContent = phonLine(en) + (known.has(en) ? "  ✓ จำได้แล้ว" : "");
  $("status").textContent = `จำได้แล้ว ${known.size}/${total} คำ`;
  $("counter").textContent = `${idx + 1} / ${deck.length}`;
}

function renderPic(en) {
  const box = $("pic"), p = picOf(en);
  box.replaceChildren();
  box.hidden = !p;
  if (!p) return;
  if (p.img) { const im = document.createElement("img"); im.src = p.img; im.alt = ""; box.append(im); }
  else box.textContent = p.emoji;
}

const flip = () => $("card").classList.toggle("flipped");
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// เปลี่ยนการ์ดแบบเลื่อนเข้า: ปิด transition ชั่วคราวเพื่อไม่ให้เห็นการ์ดหมุนกลับ
function animateCard(cls) {
  const c = $("card");
  c.classList.add("instant"); c.classList.remove("enter-next", "enter-prev");
  render();
  void c.offsetWidth;
  c.classList.remove("instant");
  if (cls && !reduceMotion()) c.classList.add(cls);
}
const move = d => { if (!deck.length) return; idx = (idx + d + deck.length) % deck.length; animateCard(d > 0 ? "enter-next" : "enter-prev"); };
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
let marking = false;
function mark(isKnown) {
  if (!deck.length || marking) return;
  const en = deck[idx][0];
  isKnown ? known.add(en) : known.delete(en);
  save(KEY_KNOWN, [...known]);
  const go = () => {
    if (isKnown && $("hideKnown").checked) { deck.splice(idx, 1); if (idx >= deck.length) idx = 0; animateCard("enter-next"); }
    else move(1);
  };
  if (isKnown && !reduceMotion()) {
    marking = true; $("card").classList.add("stamped");
    setTimeout(() => { $("card").classList.remove("stamped"); marking = false; go(); }, 420);
  } else go();
}

// ปัดซ้าย/ขวาบนการ์ดเพื่อเปลี่ยนการ์ด
let swipe = null, swiped = false;
$("card").addEventListener("pointerdown", e => { swipe = { x: e.clientX, y: e.clientY }; });
$("card").addEventListener("pointercancel", () => { swipe = null; });
$("card").addEventListener("pointerup", e => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    swiped = true; setTimeout(() => { swiped = false; }, 350);
    move(dx < 0 ? 1 : -1);
  }
});
$("card").onclick = () => { if (swiped) { swiped = false; return; } flip(); };
$("speak").onclick = e => { e.stopPropagation(); speak(); };
$("next").onclick = () => move(1);
$("prev").onclick = () => move(-1);
$("known").onclick = () => mark(true);
$("unknown").onclick = () => mark(false);
$("shuffle").onclick = () => buildDeck(true);
$("category").onchange = () => { buildDeck(); if (mode === "quiz") quizSetup(); else if (mode === "game") gameSetup(); };
$("hideKnown").onchange = () => buildDeck();
$("reset").onclick = () => { if (confirm("ล้างความคืบหน้าทั้งหมด?")) { known.clear(); save(KEY_KNOWN, []); buildDeck(); } };
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
const saveR = () => { save(KEY_REWARD, R); renderHeader(); if (!$("rewardsPanel").hidden) renderRewards(); };
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
let lastPts = null;
function renderHeader() {
  const cur = LEVELS[levelOf(R.points)];
  $("hdrLevel").textContent = `${cur[2]} ${cur[1]}`;
  $("hdrPoints").textContent = R.points.toLocaleString("en-US");
  if (lastPts !== null && R.points > lastPts) { const c = $("hdrPoints").parentElement; c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
  lastPts = R.points;
}

// จอกว้างแสดงแผงรางวัลด้านขวาตลอด จอมือถือแสดงเฉพาะหน้าเริ่มแบบทดสอบและเกม
const wide = matchMedia("(min-width: 960px)");
let rewardsWanted = false;
function setRewards(on) {
  rewardsWanted = on;
  const vis = on || wide.matches;
  show("rewardsPanel", vis);
  if (vis) renderRewards();
}
if (wide.addEventListener) wide.addEventListener("change", () => setRewards(rewardsWanted));

function toast(text) {
  const t = document.createElement("div");
  t.className = "toast-item"; t.textContent = text;
  $("toast").append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3000);
}
const listItems = lines => lines.map((t, i) => { const li = document.createElement("li"); li.textContent = t; li.style.setProperty("--i", i); return li; });
// ข้อความเลื่อนระดับและเหรียญใหม่ ใช้ทั้งในหน้าสรุปและ toast
function rewardLines(fresh, lvl0) {
  const lines = fresh.map(b => `${b[1]} ปลดล็อก ${b[2]}`);
  const lv = levelOf(R.points);
  if (lv > lvl0) lines.unshift(`⬆️ เลื่อนระดับเป็น ${LEVELS[lv][2]} ${LEVELS[lv][1]}`);
  lines.forEach(toast);
  return lines;
}
const levelOf = p => LEVELS.reduce((acc, l, k) => (p >= l[0] ? k : acc), 0);

function unlockBadges() {
  const fresh = BADGES.filter(b => !R.badges.includes(b[0]) && b[4](R));
  fresh.forEach(b => R.badges.push(b[0]));
  if (fresh.length) saveR();
  return fresh;
}

function renderRewards() {
  const li = levelOf(R.points), cur = LEVELS[li], nxt = LEVELS[li + 1];
  $("rwEmoji").textContent = cur[2];
  $("rwLevel").textContent = cur[1];
  $("rwPoints").textContent = `${R.points.toLocaleString("en-US")} แต้ม`;
  $("rwNext").textContent = nxt ? `อีก ${nxt[0] - R.points} แต้มถึงระดับ ${nxt[1]}` : "ถึงระดับสูงสุดแล้ว";
  $("rwBar").style.width = (nxt ? (R.points - cur[0]) / (nxt[0] - cur[0]) * 100 : 100) + "%";
  $("rwBest").textContent = R.quizzes ? `คะแนนสูงสุด ${R.bestPct}% · ทำแล้ว ${R.quizzes} รอบ` : "ยังไม่เคยทำแบบทดสอบ";
  $("badges").replaceChildren(...BADGES.map(b => {
    const on = R.badges.includes(b[0]), d = document.createElement("div");
    d.className = "badge" + (on ? " on" : "");
    d.title = b[3];
    const ic = document.createElement("span"), name = document.createElement("strong"), desc = document.createElement("small");
    ic.className = "em"; ic.textContent = on ? b[1] : "🔒";
    name.textContent = b[2]; desc.textContent = b[3];
    d.append(ic, name, desc);
    return d;
  }));
}

// ---------- แบบทดสอบ ----------
let mode = "study";
const Q = { dir: "en", qs: [], i: 0, score: 0, wrong: [], answered: false, opts: [], cur: null, pts: 0, streak: 0, best: 0, retry: false, lvl0: 0 };
const radioVal = name => { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : ""; };
const shuffled = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const catPool = () => { const cat = $("category").value; return allWords().filter(w => cat === "ทั้งหมด" || w[3] === cat); };
const show = (id, on) => { $(id).hidden = !on; };

function setMode(m) {
  mode = m;
  clearInterval(G.timer);
  show("study", m === "study"); show("studyTools", m === "study"); show("quiz", m === "quiz"); show("game", m === "game"); show("manage", m === "manage"); show("mainToolbar", m !== "manage");
  setRewards(false);
  $("modeStudy").setAttribute("aria-pressed", m === "study");
  $("modeQuiz").setAttribute("aria-pressed", m === "quiz");
  $("modeGame").setAttribute("aria-pressed", m === "game");
  $("modeManage").setAttribute("aria-pressed", m === "manage");
  if (m === "quiz") quizSetup();
  if (m === "game") gameSetup();
  if (m === "manage") { msg(""); renderCustomList(); renderCatList(); }
}

function quizSetup() {
  show("quizSetup", true); show("quizPlay", false); show("quizResult", false);
  const n = catPool().length;
  $("quizInfo").textContent = n ? `หมวดนี้มี ${n} คำ เลือกหมวดจากเมนูด้านบน` : "หมวดนี้ยังไม่มีคำ";
  $("quizStart").disabled = !n;
  setRewards(true);
}

function startQuiz(words, retry = false) {
  Q.dir = radioVal("quizDir") || "en"; Q.qs = words; Q.i = 0; Q.score = 0; Q.wrong = [];
  Q.pts = 0; Q.streak = 0; Q.best = 0; Q.retry = retry; Q.lvl0 = levelOf(R.points);
  show("quizSetup", false); show("quizResult", false); setRewards(false); show("quizPlay", true);
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
  $("qPhon").textContent = Q.dir === "en" ? phonLine(w[0]) : "";
  show("qSpeak", Q.dir === "en");
  $("opts").replaceChildren(...Q.opts.map((o, k) => {
    const b = document.createElement("button");
    b.className = "opt"; b.onclick = () => answer(k);
    const kk = document.createElement("span"), tx = document.createElement("span");
    kk.className = "k"; kk.textContent = k + 1; tx.textContent = o[a];
    b.append(kk, tx);
    return b;
  }));
  $("qFeedback").textContent = ""; $("qFeedback").className = "feedback"; $("qExample").textContent = "";
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
    R.bestStreak = Math.max(R.bestStreak, Q.streak); Q.best = Math.max(Q.best, Q.streak);
    saveR();
    floatPts(gain + bonus);
  } else { btns[k].classList.add("wrong"); Q.wrong.push(w); Q.streak = 0; }
  $("qFeedback").textContent = ok ? `✓ ถูกต้อง +${gain}` + (bonus ? ` +${bonus} 🔥 ติดกัน ${Q.streak} ข้อ` : "") : `✗ ผิด · คำตอบคือ ${w[a]}`;
  $("qExample").textContent = w[2] || "";
  $("qFeedback").className = "feedback " + (ok ? "ok" : "no");
  $("qNext").textContent = Q.i + 1 < Q.qs.length ? "ถัดไป →" : "ดูผลคะแนน";
  show("qNext", true);
  quizProgress();
}

function floatPts(n) {
  const f = $("ptsFloat");
  f.textContent = `+${n}`; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
}

function setRing(pct) {
  const ring = $("resRing"), fg = ring.querySelector(".ring-fg");
  ring.dataset.tone = pct >= 80 ? "good" : pct >= 50 ? "" : "bad";
  fg.style.strokeDashoffset = 100;
  requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = 100 - pct; }));
}

function nextQuestion() {
  if (!Q.answered) return;
  Q.i++;
  Q.i < Q.qs.length ? showQuestion() : showResult();
}

function showResult() {
  show("quizPlay", false); show("quizResult", true);
  const n = Q.qs.length, pct = Math.round(Q.score / n * 100);
  $("resPct").textContent = `${pct}%`;
  $("resScore").textContent = `${Q.score}/${n} ข้อ`;
  setRing(pct);
  $("resMsg").textContent = pct === 100 ? "🎉 เต็มทุกข้อ" : pct >= 80 ? "เก่งมาก" : pct >= 50 ? "ดีแล้ว ทบทวนอีกนิด" : "ลองท่องคำศัพท์อีกรอบแล้วทำใหม่";
  const counted = !Q.retry && n >= MIN_COUNTED, perfect = counted && Q.score === n;
  if (counted) {
    R.quizzes++; R.dirs[Q.dir] = true; R.bestPct = Math.max(R.bestPct, pct);
    if (perfect) { R.perfect++; R.points += 50; Q.pts += 50; }
    saveR();
  }
  $("statCorrect").textContent = `${Q.score}/${n}`;
  $("statPts").textContent = `+${Q.pts}`;
  $("statStreak").textContent = Q.best;
  $("resPoints").textContent = (perfect ? "รวมโบนัสเต็มทุกข้อ +50 แต้ม" : "") + (counted ? "" : `รอบนี้ไม่นับสถิติ (ต้องทำอย่างน้อย ${MIN_COUNTED} ข้อ และไม่ใช่รอบทำซ้ำข้อที่ผิด)`);
  $("resBadges").replaceChildren(...listItems(rewardLines(unlockBadges(), Q.lvl0)));
  $("resWrong").replaceChildren(...Q.wrong.map(w => { const li = document.createElement("li"); li.textContent = `${w[0]} — ${w[1]}`; return li; }));
  show("wrongBox", Q.wrong.length > 0);
  show("retryWrong", Q.wrong.length > 0);
}

$("modeStudy").onclick = () => setMode("study");
$("modeQuiz").onclick = () => setMode("quiz");
$("quizStart").onclick = () => startQuiz(shuffled(catPool()).slice(0, +(radioVal("quizCount") || 10)));
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
  setRewards(true);
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
  show("gameSetup", false); show("gameResult", false); setRewards(false); show("gamePlay", true);
  $("board").replaceChildren(...G.tiles.map((t, i) => {
    const b = document.createElement("button"), inner = document.createElement("span");
    const back = document.createElement("span"), front = document.createElement("span");
    b.className = "tile"; b.setAttribute("aria-label", `การ์ดใบที่ ${i + 1}`);
    inner.className = "tile-in"; back.className = "tile-face tile-back"; front.className = "tile-face tile-front";
    back.textContent = "?"; front.textContent = t.text;
    inner.append(back, front); b.append(inner);
    b.onclick = () => flipTile(i);
    t.el = b;
    return b;
  }));
  clearInterval(G.timer); G.timer = setInterval(gameStatus, 1000); gameStatus();
}

function flipTile(i) {
  const t = G.tiles[i];
  if (G.lock || t.up || t.done) return;
  t.up = true; t.el.classList.add("up"); t.el.setAttribute("aria-label", t.text);
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
      for (const x of [a, b]) { x.up = false; x.el.classList.remove("up"); x.el.setAttribute("aria-label", `การ์ดใบที่ ${G.tiles.indexOf(x) + 1}`); }
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
  $("gResScore").textContent = G.moves === 6 ? "ไม่พลาดเลยสักครั้ง" : G.moves <= 8 ? "เยี่ยมมาก" : G.moves <= 12 ? "ดีมาก" : "จับคู่ครบแล้ว";
  $("gStatMoves").textContent = G.moves;
  $("gStatTime").textContent = fmtTime(secs);
  $("gStatPts").textContent = `+${G.pts}`;
  $("gResPoints").textContent = bonus ? `รวมโบนัสพลิกน้อย +${bonus} แต้ม` : "";
  $("gResBadges").replaceChildren(...listItems(rewardLines(unlockBadges(), G.lvl0)));
  show("gamePlay", false); show("gameResult", true);
}

$("modeGame").onclick = () => setMode("game");
$("gameStart").onclick = startGame;
$("gameAgain").onclick = gameSetup;

// ---------- เพิ่มคำของฉัน ----------
let editing = -1, delArmed = -1, delTimer = null;
const saveCustom = () => save(KEY_CUSTOM, custom);
let pendingImg = "";
const picOf = en => { const c = custom.find(c => c[0] === en); return c && c[5] ? { img: c[5] } : PIC[en] ? { emoji: PIC[en] } : null; };

function readImage(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read"));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error("decode"));
      im.onload = () => {
        const s = Math.min(1, 320 / Math.max(im.width, im.height, 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function showPreview() {
  show("imgPreview", !!pendingImg); show("dropZone", !pendingImg);
  if (pendingImg) $("imgPreview").querySelector("img").src = pendingImg;
}
const norm = s => s.trim().toLowerCase();
const exists = (en, skip = -1) => WORDS.some(w => norm(w[0]) === norm(en)) || custom.some((c, i) => i !== skip && norm(c[0]) === norm(en));
const ipaOf = en => { const c = custom.find(c => c[0] === en); return (c && c[4]) || IPA[en] || ""; };
const readOf = en => { const c = custom.find(c => c[0] === en); return (c && c[6]) || ""; };
const phonLine = en => [ipaOf(en), readOf(en)].filter(Boolean).join("  ·  ");
const msg = (text, ok = true) => { $("manageMsg").textContent = text; $("manageMsg").className = "feedback " + (ok ? "ok" : "no"); };
const RESERVED = "ทั้งหมด";

function refreshAfterChange() {
  buildCategories(); buildDeck(); renderCustomList(); renderCatList();
}

function renderCatList() {
  $("catList").replaceChildren(...[...new Set(allWords().map(w => w[3]))].map(c => { const o = document.createElement("option"); o.value = c; return o; }));
}

function renderCustomList() {
  $("customCount").textContent = custom.length ? `${custom.length} คำ` : "";
  show("searchWrap", custom.length > 0);
  const empty = text => { const li = document.createElement("li"); li.className = "empty"; li.textContent = text; $("customList").replaceChildren(li); };
  if (!custom.length) return empty("ยังไม่มีคำของคุณ กรอกฟอร์มด้านบนเพื่อเพิ่มคำแรก");
  const q = norm($("listSearch").value);
  const rows = custom.map((c, i) => i).reverse().filter(i => !q || norm(custom[i][0]).includes(q) || norm(custom[i][1]).includes(q));
  if (!rows.length) return empty("ไม่พบคำที่ค้นหา");
  const iconBtn = (icon, label, cls, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = cls; b.setAttribute("aria-label", label); b.title = label; b.onclick = fn;
    b.innerHTML = `<svg class="ic"><use href="#${icon}"/></svg>`;
    return b;
  };
  $("customList").replaceChildren(...rows.map(i => {
    const c = custom[i], li = document.createElement("li"), info = document.createElement("div"), act = document.createElement("div");
    li.className = "cw"; info.className = "cw-info"; act.className = "cw-act";
    if (c[5]) { const t = document.createElement("img"); t.className = "thumb"; t.src = c[5]; t.alt = ""; li.append(t); }
    else { const av = document.createElement("span"); av.className = "avatar"; av.setAttribute("aria-hidden", "true"); av.textContent = (c[0][0] || "?").toUpperCase(); li.append(av); }
    const en = document.createElement("strong"), th = document.createElement("span"), meta = document.createElement("div"), cat = document.createElement("span");
    en.textContent = c[0]; th.textContent = c[1];
    meta.className = "cw-meta"; cat.className = "cat-chip"; cat.textContent = c[3] || DEFAULT_CAT; meta.append(cat);
    const extra = [c[4], c[6]].filter(Boolean).join(" · ");
    if (extra) { const s = document.createElement("small"); s.textContent = extra; meta.append(s); }
    info.append(en, th, meta);
    act.append(iconBtn("i-edit", "แก้ไข", "ghost icon-btn", () => startEdit(i)));
    if (delArmed === i) { const d = document.createElement("button"); d.type = "button"; d.className = "small bad"; d.textContent = "กดอีกครั้ง"; d.setAttribute("aria-label", "ยืนยันลบ"); d.onclick = () => deleteWord(i); act.append(d); }
    else act.append(iconBtn("i-trash", "ลบ", "ghost icon-btn", () => deleteWord(i)));
    li.append(info, act);
    return li;
  }));
}

function resetForm() {
  editing = -1; $("wordForm").reset(); pendingImg = ""; showPreview();
  $("formTitle").textContent = "เพิ่มคำใหม่"; $("saveWord").textContent = "เพิ่มคำ"; show("cancelEdit", false);
}

function startEdit(i) {
  const c = custom[i];
  editing = i;
  $("newEn").value = c[0]; $("newTh").value = c[1]; $("newEx").value = c[2] || ""; $("newIpa").value = c[4] || ""; $("newRead").value = c[6] || ""; $("newCat").value = c[3] && c[3] !== DEFAULT_CAT ? c[3] : "";
  pendingImg = c[5] || ""; $("newImg").value = ""; showPreview();
  $("moreFields").open = !!(c[2] || c[4] || c[5] || c[6]);
  $("formTitle").textContent = "แก้ไขคำ"; $("saveWord").textContent = "บันทึกการแก้ไข"; show("cancelEdit", true);
  msg("");
  try { $("wordForm").scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  $("newEn").focus();
}

function deleteWord(i) {
  if (delArmed !== i) {
    delArmed = i; clearTimeout(delTimer);
    delTimer = setTimeout(() => { delArmed = -1; renderCustomList(); }, 3000);
    renderCustomList();
    return;
  }
  clearTimeout(delTimer); delArmed = -1;
  const en = custom.splice(i, 1)[0][0];
  known.delete(en); save(KEY_KNOWN, [...known]);
  if (editing === i) resetForm(); else if (editing > i) editing--;
  msg(`ลบ "${en}" แล้ว`);
  saveCustom(); refreshAfterChange();
}

$("wordForm").onsubmit = e => {
  e.preventDefault();
  const en = $("newEn").value.trim(), th = $("newTh").value.trim(), ex = $("newEx").value.trim();
  const ipa = $("newIpa").value.trim(), read = $("newRead").value.trim(), cat = $("newCat").value.trim() || DEFAULT_CAT, img = pendingImg;
  if (!en || !th) return msg("กรอกคำอังกฤษและคำแปลไทยให้ครบ", false);
  if (cat === RESERVED) return msg(`ชื่อหมวด "${RESERVED}" ใช้ไม่ได้ กรุณาตั้งชื่ออื่น`, false);
  if (exists(en, editing)) return msg(`มีคำว่า "${en}" อยู่แล้ว`, false);
  let text, k;
  if (editing >= 0) {
    k = editing;
    const old = custom[k][0];
    custom[k] = [en, th, ex, cat, ipa, img, read];
    if (old !== en && known.has(old)) { known.delete(old); known.add(en); save(KEY_KNOWN, [...known]); }
    text = `แก้ไข "${en}" แล้ว`;
  } else {
    custom.push([en, th, ex, cat, ipa, img, read]); k = custom.length - 1;
    text = `เพิ่ม "${en}" แล้ว`;
  }
  let ok = true;
  if (!saveCustom()) {
    if (img) { custom[k][5] = ""; ok = saveCustom(); text += ok ? " (รูปใหญ่เกินพื้นที่เก็บข้อมูลของเบราว์เซอร์ จึงบันทึกโดยไม่มีรูป)" : " (บันทึกลงเบราว์เซอร์ไม่สำเร็จ)"; }
    else { ok = false; text += " (บันทึกลงเบราว์เซอร์ไม่สำเร็จ)"; }
    ok = false;
  }
  const keepCat = editing < 0;
  resetForm();
  if (keepCat) $("newCat").value = cat === DEFAULT_CAT ? "" : cat; // เก็บหมวดไว้เพิ่มคำต่อเนื่อง
  msg(text, ok);
  refreshAfterChange();
  $("newEn").focus();
};

async function takeImage(f) {
  if (!f) return;
  if (!f.type.startsWith("image/")) { $("newImg").value = ""; return msg("เลือกไฟล์รูปภาพเท่านั้น", false); }
  try { pendingImg = await readImage(f); showPreview(); msg(""); }
  catch { $("newImg").value = ""; msg("เปิดไฟล์รูปนี้ไม่ได้ ลองรูปอื่น", false); }
}
$("newImg").onchange = () => takeImage($("newImg").files[0]);
$("dropZone").addEventListener("dragover", e => { e.preventDefault(); $("dropZone").classList.add("over"); });
$("dropZone").addEventListener("dragleave", () => $("dropZone").classList.remove("over"));
$("dropZone").addEventListener("drop", e => { e.preventDefault(); $("dropZone").classList.remove("over"); takeImage(e.dataTransfer.files[0]); });
$("listSearch").oninput = renderCustomList;
$("imgRemove").onclick = () => { pendingImg = ""; $("newImg").value = ""; showPreview(); };

$("cancelEdit").onclick = () => { resetForm(); msg(""); };

// รองรับ 3 รูปแบบ: "en /ipa/ คำอ่าน ความหมาย", "en ความหมายไทย" และ "en = ไทย = ตัวอย่าง"
function parseLine(line) {
  if (line.includes("=")) {
    const p = line.split("=").map(s => s.trim());
    return { en: p[0], th: p[1] || "", ex: p.slice(2).join("=").trim(), ipa: "", read: "" };
  }
  const m = line.match(/^(.+?)\s*(\/[^\/]+\/)\s*(.*)$/);
  if (m) {
    const toks = m[3].split(/\s+/).filter(Boolean);
    const read = toks.length > 1 ? toks[0] : "";
    return { en: m[1].trim(), th: (toks.length > 1 ? toks.slice(1) : toks).join(" "), ex: "", ipa: m[2], read };
  }
  const t = line.search(/[\u0E00-\u0E7F]/);
  if (t > 0) return { en: line.slice(0, t).trim(), th: line.slice(t).trim(), ex: "", ipa: "", read: "" };
  return { en: line, th: "", ex: "", ipa: "", read: "" };
}

$("bulkAdd").onclick = () => {
  const cat = $("newCat").value.trim() || DEFAULT_CAT;
  if (cat === RESERVED) return msg(`ชื่อหมวด "${RESERVED}" ใช้ไม่ได้ กรุณาตั้งชื่ออื่น`, false);
  let added = 0;
  const skipped = [];
  for (const raw of $("bulkText").value.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const { en, th, ex, ipa, read } = parseLine(line);
    if (!en || !th) { skipped.push(`"${line}" (รูปแบบไม่ถูกต้อง)`); continue; }
    if (exists(en)) { skipped.push(`"${en}" (มีอยู่แล้ว)`); continue; }
    custom.push([en, th, ex, cat, ipa, "", read]); added++;
  }
  if (!added && !skipped.length) return msg("ยังไม่ได้วางรายการคำ", false);
  msg(`เพิ่ม ${added} คำ` + (skipped.length ? ` · ข้าม ${skipped.length} บรรทัด: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? " ..." : ""}` : ""), added > 0);
  if (added && !skipped.length) $("bulkText").value = "";
  if (added) { saveCustom(); refreshAfterChange(); }
};
$("modeManage").onclick = () => setMode("manage");

renderHeader(); buildCategories(); buildDeck(); setRewards(false);
