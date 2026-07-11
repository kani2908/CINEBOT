/* ============================================================
   Reel Help — a small rule-based "AI" chatbot.
   No external API: it scores the visitor's message against
   queries.json (question + answer + category) using keyword
   overlap, then replies with the best match — or a fallback
   if nothing scores highly enough.
   ============================================================ */

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","am","be","been","being",
  "do","does","did","how","what","when","where","why","which","who",
  "i","you","he","she","it","we","they","my","your","his","her","its",
  "our","their","to","of","in","on","for","and","or","but","with",
  "can","could","should","would","will","shall","have","has","had",
  "get","got","this","that","these","those","if","so","not","no",
  "at","by","from","up","about","into","than","then","there","just","me"
]);

const GREETING_RE = /^\s*(hi|hey|hello|yo|sup|hola)\b/i;
const THANKS_RE = /\b(thanks|thank you|thx|cheers)\b/i;

let knowledgeBase = [];
let scoredCache = null;

const chatWindow = document.getElementById("chatWindow");
const composer = document.getElementById("composer");
const userInput = document.getElementById("userInput");
const quickChips = document.getElementById("quickChips");

init();

async function init() {
  try {
    const res = await fetch("queries.json");
    knowledgeBase = await res.json();
  } catch (err) {
    knowledgeBase = [];
  }

  // Pre-tokenize the knowledge base once for faster matching.
  scoredCache = knowledgeBase.map(entry => ({
    ...entry,
    qTokens: tokenize(entry.question),
    aTokens: tokenize(entry.answer),
    cTokens: tokenize(entry.category)
  }));

  addBotMessage(
    knowledgeBase.length
      ? "Welcome to the ticket desk. Ask me anything about booking, seats, refunds, payments, or events — I'll pull up the answer."
      : "Welcome to the ticket desk. I couldn't load the knowledge base (queries.json) — if you opened this file directly, run a local server (e.g. `python3 -m http.server`) and reload from there."
  );

  renderQuickChips();

  composer.addEventListener("submit", handleSubmit);
}

function renderQuickChips() {
  if (!knowledgeBase.length) { quickChips.innerHTML = ""; return; }

  // Feature one question per category, capped at 5 chips.
  const seen = new Set();
  const picks = [];
  for (const entry of knowledgeBase) {
    if (!seen.has(entry.category)) {
      seen.add(entry.category);
      picks.push(entry);
    }
    if (picks.length === 5) break;
  }

  quickChips.innerHTML = picks
    .map(p => `<button type="button" class="chip" data-q="${escapeAttr(p.question)}">${escapeHtml(p.question)}</button>`)
    .join("");

  quickChips.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      userInput.value = chip.dataset.q;
      composer.requestSubmit();
    });
  });
}

function handleSubmit(e) {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addUserMessage(text);
  userInput.value = "";
  userInput.focus();

  showTyping();
  const delay = 380 + Math.random() * 380;
  setTimeout(() => {
    removeTyping();
    addBotMessage(generateReply(text));
  }, delay);
}

function generateReply(text) {
  if (GREETING_RE.test(text)) {
    return "Hey there! Ask me about booking, seat selection, payments, cancellations, food & beverages, or events.";
  }
  if (THANKS_RE.test(text)) {
    return "Anytime — enjoy the show.";
  }

  const best = findBestMatch(text);
  if (best && best.score >= 2) {
    return best.answer;
  }

  const near = findBestMatch(text, true);
  if (near) {
    return `I'm not fully sure on that one. Closest thing I've got is about "${near.question}" — ${near.answer}`;
  }

  return "I don't have that one on file yet. Try asking about booking, seats, payments, cancellations, or food & beverages — or rephrase with a keyword like \"refund\" or \"seat\".";
}

function findBestMatch(text) {
  if (!scoredCache || !scoredCache.length) return null;

  const tokens = tokenize(text);
  if (!tokens.length) return null;

  let best = null;
  for (const entry of scoredCache) {
    let score = 0;
    for (const tok of tokens) {
      if (entry.qTokens.includes(tok)) score += 3;
      else if (entry.cTokens.includes(tok)) score += 2;
      else if (entry.aTokens.includes(tok)) score += 1;
    }
    if (!best || score > best.score) {
      best = { question: entry.question, answer: entry.answer, score };
    }
  }
  return best && best.score > 0 ? best : null;
}

function tokenize(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w));
}

/* ===== Rendering helpers ===== */

function addUserMessage(text) {
  const row = document.createElement("div");
  row.className = "msg-row user";
  row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chatWindow.appendChild(row);
  scrollToBottom();
}

function addBotMessage(text) {
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.innerHTML = `
    <div class="bubble">
      <p class="msg-meta">Ticket Desk</p>
      ${escapeHtml(text)}
    </div>`;
  chatWindow.appendChild(row);
  scrollToBottom();
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "msg-row bot typing";
  row.id = "typingRow";
  row.innerHTML = `
    <div class="bubble">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>`;
  chatWindow.appendChild(row);
  scrollToBottom();
}

function removeTyping() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
