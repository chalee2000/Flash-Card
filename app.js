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
$("category").onchange = () => { buildDeck(); if (mode === "quiz") quizSetup(); };
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
  if (e.key === " ") { e.preventDefault(); flip(); }
  else if (e.key === "ArrowRight") move(1);
  else if (e.key === "ArrowLeft") move(-1);
  else if (e.key.toLowerCase() === "k") mark(true);
});

// ---------- แบบทดสอบ ----------
let mode = "study";
const Q = { dir: "en", qs: [], i: 0, score: 0, wrong: [], answered: false, opts: [], cur: null };
const shuffled = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const catPool = () => { const cat = $("category").value; return allWords().filter(w => cat === "ทั้งหมด" || w[3] === cat); };
const show = (id, on) => { $(id).hidden = !on; };

function setMode(m) {
  mode = m;
  show("study", m === "study"); show("studyTools", m === "study"); show("quiz", m === "quiz");
  $("modeStudy").setAttribute("aria-pressed", m === "study");
  $("modeQuiz").setAttribute("aria-pressed", m === "quiz");
  if (m === "quiz") quizSetup();
}

function quizSetup() {
  show("quizSetup", true); show("quizPlay", false); show("quizResult", false);
  const n = catPool().length;
  $("quizInfo").textContent = n ? `หมวดนี้มี ${n} คำ เลือกหมวดจากเมนูด้านบน` : "หมวดนี้ยังไม่มีคำ";
  $("quizStart").disabled = !n;
}

function startQuiz(words) {
  Q.dir = $("quizDir").value; Q.qs = words; Q.i = 0; Q.score = 0; Q.wrong = [];
  show("quizSetup", false); show("quizResult", false); show("quizPlay", true);
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
  $("quizStatus").textContent = `ข้อ ${Q.i + 1}/${Q.qs.length} · ถูก ${Q.score}`;
  $("quizBar").style.width = ((Q.i + (Q.answered ? 1 : 0)) / Q.qs.length * 100) + "%";
}

function answer(k) {
  if (Q.answered || k >= Q.opts.length) return;
  Q.answered = true;
  const w = Q.cur, a = Q.dir === "en" ? 1 : 0, ok = Q.opts[k] === w, btns = $("opts").children;
  Q.opts.forEach((o, j) => { if (o === w) btns[j].classList.add("right"); btns[j].disabled = true; });
  if (ok) Q.score++; else { btns[k].classList.add("wrong"); Q.wrong.push(w); }
  $("qFeedback").textContent = (ok ? "✓ ถูกต้อง" : `✗ ผิด · คำตอบคือ ${w[a]}`) + (w[2] ? `\n${w[2]}` : "");
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
  $("resWrong").replaceChildren(...Q.wrong.map(w => { const li = document.createElement("li"); li.textContent = `${w[0]} — ${w[1]}`; return li; }));
  show("retryWrong", Q.wrong.length > 0);
}

$("modeStudy").onclick = () => setMode("study");
$("modeQuiz").onclick = () => setMode("quiz");
$("quizStart").onclick = () => startQuiz(shuffled(catPool()).slice(0, +$("quizCount").value));
$("quizAgain").onclick = quizSetup;
$("retryWrong").onclick = () => startQuiz(shuffled(Q.wrong));
$("qNext").onclick = nextQuestion;
$("qSpeak").onclick = () => speakText(Q.cur[0]);

buildCategories(); buildDeck();
