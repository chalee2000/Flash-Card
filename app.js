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
const speak = () => {
  if (!deck.length || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(deck[idx][0]);
  u.lang = "en-US"; u.rate = 0.9;
  const voices = speechSynthesis.getVoices().filter(v => /^en[-_]US$/i.test(v.lang));
  const v = voices.find(v => /google us|samantha|aria|jenny|zira|alex/i.test(v.name)) || voices[0];
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
};
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
$("category").onchange = () => buildDeck();
$("hideKnown").onchange = () => buildDeck();
$("reset").onclick = () => { if (confirm("ล้างความคืบหน้าทั้งหมด?")) { known.clear(); save(KEY_KNOWN, []); buildDeck(); } };
$("addForm").onsubmit = e => {
  e.preventDefault();
  custom.push([$("newEn").value.trim(), $("newTh").value.trim(), $("newEx").value.trim()]);
  save(KEY_CUSTOM, custom); e.target.reset(); buildCategories(); buildDeck();
};
document.addEventListener("keydown", e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === " ") { e.preventDefault(); flip(); }
  else if (e.key === "ArrowRight") move(1);
  else if (e.key === "ArrowLeft") move(-1);
  else if (e.key.toLowerCase() === "k") mark(true);
});

buildCategories(); buildDeck();
