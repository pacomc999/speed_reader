// reader.js
// The app: opens a book, flashes words, and handles pausing and keys.
// Uses loadEpub from epub.js and the word helpers from words.js.


// ---------- Page elements ----------

const el = {
  startScreen: document.getElementById("start-screen"),
  readerScreen: document.getElementById("reader-screen"),
  dropZone: document.getElementById("drop-zone"),
  fileInput: document.getElementById("file-input"),
  startMessage: document.getElementById("start-message"),
  bookTitle: document.getElementById("book-title"),
  chapterSelect: document.getElementById("chapter-select"),
  speedSlider: document.getElementById("speed-slider"),
  speedValue: document.getElementById("speed-value"),
  openAnother: document.getElementById("open-another"),
  stage: document.getElementById("stage"),
  wordView: document.getElementById("word-view"),
  wordBefore: document.getElementById("word-before"),
  wordFocus: document.getElementById("word-focus"),
  wordAfter: document.getElementById("word-after"),
  contextLeft: document.getElementById("context-left"),
  contextRight: document.getElementById("context-right"),
  contextToggle: document.getElementById("context-toggle"),
  timingSelect: document.getElementById("timing-select"),
  longWordControl: document.getElementById("long-word-control"),
  longWordSlider: document.getElementById("long-word-slider"),
  longWordValue: document.getElementById("long-word-value"),
  peekView: document.getElementById("peek-view"),
  peekText: document.getElementById("peek-text"),
  wordHint: document.getElementById("word-hint"),
  toolbar: document.getElementById("toolbar"),
  settingsToggle: document.getElementById("settings-toggle"),
  progressFill: document.getElementById("progress-fill"),
  status: document.getElementById("status"),
};


// ---------- Reading state ----------

const state = {
  book: null,          // { title, chapters }
  chapterIndex: 0,
  words: [],           // words of the current chapter
  index: 0,            // which word we are on
  wordsPerMinute: 300,
  playing: false,
  timer: null,
  showContext: false,  // show the previous and next word, dimmed
  timingMode: "custom", // "custom" or "flat" (see words.js)
  speedScale: 1,       // shrinks beats so the real speed matches the slider
};

const SPEED_STEP = 25;
const SAVE_EVERY = 20; // save progress every this many words


// ---------- Opening a book ----------

// Web pages and pasted text are kept as plain text files ending in .txt
// (see openText), so they can be saved and reopened just like a book
const TEXT_FILE_ENDING = ".txt";

async function openBook(file) {
  el.startMessage.textContent = "Opening " + file.name + "...";
  try {
    state.book = await readBookFile(file);
  } catch (error) {
    el.startMessage.textContent = error.message;
    return;
  }

  // Keep a copy so the book opens by itself next time.
  // If saving fails (for example storage is blocked), reading still works.
  saveLastBook(file).catch(() => {});

  el.startMessage.textContent = "";
  el.bookTitle.textContent = state.book.title;
  fillChapterList();

  // Pick up where we left off last time, if we have been here before
  // (chapter first, then speed, so saving never overwrites the old place)
  const saved = loadProgress();
  loadChapter(saved ? saved.chapterIndex : 0, saved ? saved.index : 0);
  setSpeed(saved ? saved.wordsPerMinute : state.wordsPerMinute);

  el.startScreen.hidden = true;
  el.readerScreen.hidden = false;
}

// Plain text becomes a one chapter book; anything else is read as an EPUB
async function readBookFile(file) {
  if (file.type === "text/plain") {
    const title = file.name.replace(/\.txt$/, "");
    return textToBook(title, await file.text());
  }
  return loadEpub(file);
}

// Wraps text in a file, so it goes through openBook like an EPUB
// (which also saves it for next time)
function openText(title, text) {
  const file = new File([text], title + TEXT_FILE_ENDING, { type: "text/plain" });
  return openBook(file);
}

// Fetches a web page's article and opens it
async function openWebPage(link) {
  const url = normaliseLink(link);
  el.startMessage.textContent = "Fetching the page...";
  try {
    const page = await loadWebPage(url);
    await openText(page.title, page.text);
  } catch (error) {
    el.startMessage.textContent = error.message;
  }
}

// Puts every chapter into the dropdown
function fillChapterList() {
  el.chapterSelect.innerHTML = "";
  state.book.chapters.forEach((chapter, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = chapter.title;
    el.chapterSelect.appendChild(option);
  });
}

// Switches to a chapter and shows the paused view at a given word
function loadChapter(chapterIndex, wordIndex) {
  const chapters = state.book.chapters;
  state.chapterIndex = Math.min(Math.max(0, chapterIndex), chapters.length - 1);
  state.words = splitIntoWords(chapters[state.chapterIndex].paragraphs);
  state.index = Math.min(Math.max(0, wordIndex), state.words.length - 1);
  state.speedScale = chapterSpeedScale(state.words, state.timingMode);
  el.chapterSelect.value = state.chapterIndex;
  render();
}

function backToStart() {
  pause();
  state.book = null;
  el.fileInput.value = "";
  el.readerScreen.hidden = true;
  el.startScreen.hidden = false;
}


// ---------- Playing and pausing ----------

function play() {
  if (state.playing) return;
  state.playing = true;
  setSettingsOpen(false); // the phone settings panel closes when reading starts
  render();
  scheduleNextWord();
}

function pause() {
  state.playing = false;
  clearTimeout(state.timer);
  saveProgress();
  render();
}

function togglePlay() {
  if (state.playing) pause();
  else play();
}

// Length of one beat in milliseconds, after making the speed honest
function beatLength() {
  return (60000 / state.wordsPerMinute) * state.speedScale;
}

// Shows the current word for its beats, then (if the timing mode asks
// for it) a blank screen for a few beats, then moves to the next word
function scheduleNextWord() {
  const timing = wordTiming(state.words[state.index], state.timingMode);
  const beat = beatLength();

  state.timer = setTimeout(() => {
    if (timing.blank > 0) {
      showBlank();
      state.timer = setTimeout(nextWord, timing.blank * beat);
    } else {
      nextWord();
    }
  }, timing.show * beat);
}

// Empties the word area (the guide marks stay) for a short break
function showBlank() {
  for (const part of [el.contextLeft, el.wordBefore, el.wordFocus, el.wordAfter, el.contextRight]) {
    part.textContent = "";
  }
}

function nextWord() {
  state.index++;

  // End of chapter: move to the next one, or stop at the end of the book
  if (state.index >= state.words.length) {
    if (state.chapterIndex < state.book.chapters.length - 1) {
      loadChapter(state.chapterIndex + 1, 0);
    } else {
      state.index = state.words.length - 1;
      pause();
      el.wordHint.textContent = "The end. Well done!";
      return;
    }
  }

  if (state.index % SAVE_EVERY === 0) saveProgress();
  render();
  scheduleNextWord();
}


// ---------- Moving around ----------

// How far the arrow keys jump while reading (when paused it is one word)
const JUMP_WHILE_PLAYING = 5;

// Moves to a word. While reading, it keeps playing from there;
// while paused, it just moves the highlight.
function jumpTo(newIndex) {
  state.index = Math.min(Math.max(0, newIndex), state.words.length - 1);
  if (state.playing) {
    clearTimeout(state.timer);
    render();
    scheduleNextWord();
  } else {
    render();
  }
}

// Left and Right: a few words while reading, one word while paused
function stepWords(direction) {
  const size = state.playing ? JUMP_WHILE_PLAYING : 1;
  jumpTo(state.index + direction * size);
}

function backOneSentence() {
  jumpTo(previousSentenceStart(state.words, state.index));
}


// ---------- Touch: tap left or right of the word ----------
// While reading: back to the start of the sentence / on to the next one.
// While paused: one word back / forward.

function tapBack() {
  if (state.playing) backOneSentence();
  else jumpTo(state.index - 1);
}

function tapForward() {
  if (state.playing) jumpTo(nextSentenceStart(state.words, state.index));
  else jumpTo(state.index + 1);
}

// Extra room around the word that still counts as "on the word"
const WORD_TAP_MARGIN = 24;

// The outer part of the screen on each side is always back / forward,
// even when a very long word reaches into it
const EDGE_ZONE = 0.2; // 20% of the screen width on each side

// Says whether a tap at this x position was "left" of the word,
// "right" of it, or "on" it, measured from the word's real edges
function tapSide(x) {
  const firstPart = el.wordBefore.textContent ? el.wordBefore : el.wordFocus;
  const lastPart = el.wordAfter.textContent ? el.wordAfter : el.wordFocus;
  const screenWidth = window.innerWidth;

  const wordLeft = firstPart.getBoundingClientRect().left - WORD_TAP_MARGIN;
  const wordRight = lastPart.getBoundingClientRect().right + WORD_TAP_MARGIN;
  const left = Math.max(wordLeft, screenWidth * EDGE_ZONE);
  const right = Math.min(wordRight, screenWidth * (1 - EDGE_ZONE));

  if (x < left) return "left";
  if (x > right) return "right";
  return "on";
}

function setSpeed(wordsPerMinute) {
  state.wordsPerMinute = Math.min(1000, Math.max(100, wordsPerMinute));
  el.speedSlider.value = state.wordsPerMinute;
  el.speedValue.textContent = state.wordsPerMinute + " wpm";
  saveProgress();
  renderStatus();
}


// ---------- Drawing the screen ----------

// Touch screens have no Space key, so the hint says "tap" there
const IS_TOUCH_SCREEN = window.matchMedia("(hover: none)").matches;
const PAUSED_HINT = IS_TOUCH_SCREEN ? "‹ back · tap the word to play · forward ›" : "Paused · Space to continue";

// Reading: just the flashing word.
// Paused: the word stays frozen in place, and the chapter text
// appears underneath it (scrollable, current word highlighted).
function render() {
  el.readerScreen.classList.toggle("playing", state.playing);
  el.peekView.hidden = state.playing;

  renderWord();
  if (!state.playing) renderPeek();

  el.wordHint.textContent = state.playing ? "" : PAUSED_HINT;
  renderStatus();
}

// Shows the current word with its coloured focus letter
function renderWord() {
  const parts = splitAtFocus(state.words[state.index].text);
  el.wordBefore.textContent = parts.before;
  el.wordFocus.textContent = parts.focus;
  el.wordAfter.textContent = parts.after;

  el.contextLeft.textContent = state.showContext ? neighbourText(-1) : "";
  el.contextRight.textContent = state.showContext ? neighbourText(1) : "";
}

// The previous (-1) or next (+1) word, but only inside the same paragraph
function neighbourText(direction) {
  const current = state.words[state.index];
  const neighbour = state.words[state.index + direction];
  if (!neighbour || neighbour.paragraphIndex !== current.paragraphIndex) return "";
  return neighbour.text;
}

// The paused view shows the whole chapter as scrollable text.
// It is built once per chapter (that can be thousands of words);
// after that only the highlight moves.
const peek = {
  builtFor: null,    // the words list the text was built from
  spans: [],         // one <span> per word, same order as state.words
  highlighted: null, // the span that is currently highlighted
};

// Creates one <p> per paragraph and one <span> per word
function buildPeekText() {
  el.peekText.innerHTML = "";
  peek.spans = [];
  let paragraph = null;

  state.words.forEach((word, i) => {
    const startsParagraph = i === 0 || word.paragraphIndex !== state.words[i - 1].paragraphIndex;
    if (startsParagraph) {
      paragraph = document.createElement("p");
      el.peekText.appendChild(paragraph);
    }
    const span = document.createElement("span");
    span.textContent = word.text;
    span.dataset.index = i; // lets a click know which word it was
    paragraph.append(span, " ");
    peek.spans.push(span);
  });

  peek.builtFor = state.words;
  peek.highlighted = null;
}

// Highlights the current word and scrolls the text so it sits in the
// middle of the text box. Clicking any word jumps there.
function renderPeek() {
  if (peek.builtFor !== state.words) buildPeekText();

  if (peek.highlighted) peek.highlighted.classList.remove("current");
  peek.highlighted = peek.spans[state.index];
  peek.highlighted.classList.add("current");

  // Scroll only the text box. (The browser's scrollIntoView could also
  // nudge the rest of the screen, which would move the frozen word.)
  const box = el.peekText;
  box.scrollTop = peek.highlighted.offsetTop - box.clientHeight / 2;
}

// Progress bar and "time left" line
function renderStatus() {
  if (!state.book) return;
  const fraction = state.words.length > 1 ? state.index / (state.words.length - 1) : 1;
  el.progressFill.style.width = (fraction * 100).toFixed(1) + "%";

  // Add up how long the remaining words will take at this speed
  let beats = 0;
  for (let i = state.index; i < state.words.length; i++) {
    beats += totalBeats(state.words[i], state.timingMode);
  }
  const milliseconds = beats * beatLength();
  const minutes = Math.ceil(milliseconds / 60000);

  const chapterTitle = state.book.chapters[state.chapterIndex].title;
  el.status.textContent = chapterTitle + " · about " + minutes + " min left in this chapter";
}


// ---------- Remembering your place ----------
// Saved in this browser only. Wrapped in try/catch because storage
// can be blocked (private windows, strict settings) and that is fine.

function progressKey() {
  return "speed_reader:" + state.book.title;
}

function saveProgress() {
  if (!state.book) return;
  try {
    localStorage.setItem(progressKey(), JSON.stringify({
      chapterIndex: state.chapterIndex,
      index: state.index,
      wordsPerMinute: state.wordsPerMinute,
    }));
  } catch (error) {
    // Ignore: reading still works without saving
  }
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(progressKey()));
  } catch (error) {
    return null;
  }
}


// ---------- Mouse and file events ----------

el.fileInput.addEventListener("change", () => {
  if (el.fileInput.files[0]) openBook(el.fileInput.files[0]);
});

// Drag and drop onto the dashed box
el.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  el.dropZone.classList.add("dragging");
});
el.dropZone.addEventListener("dragleave", () => el.dropZone.classList.remove("dragging"));
el.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  el.dropZone.classList.remove("dragging");
  const file = event.dataTransfer.files[0];
  if (file) openBook(file);
});

// Clicking the stage plays or pauses; clicking a paragraph word jumps there
el.stage.addEventListener("click", (event) => {
  const index = event.target.dataset && event.target.dataset.index;
  if (index !== undefined) {
    state.index = Number(index);
    render();
    return;
  }
  // Clicks on the text between words do nothing, so scrolling
  // and clicking around never starts reading by accident
  if (el.peekText.contains(event.target)) return;

  // On touch screens, tapping beside the word moves back or forward
  if (IS_TOUCH_SCREEN) {
    const side = tapSide(event.clientX);
    if (side === "left") return tapBack();
    if (side === "right") return tapForward();
  }
  togglePlay();
});

// Web page link: the form's Read button (or the keyboard's Go key)
document.getElementById("link-form").addEventListener("submit", (event) => {
  event.preventDefault(); // stay on this page instead of sending the form
  openWebPage(document.getElementById("link-input").value);
});

// Pasted text
document.getElementById("paste-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = document.getElementById("paste-input").value;
  openText(titleFromText(text), text);
});

el.chapterSelect.addEventListener("change", () => {
  pause();
  loadChapter(Number(el.chapterSelect.value), 0);
  el.chapterSelect.blur(); // give the arrow keys back to the reader
});

el.speedSlider.addEventListener("input", () => setSpeed(Number(el.speedSlider.value)));
el.speedSlider.addEventListener("change", () => el.speedSlider.blur());

el.openAnother.addEventListener("click", backToStart);


// ---------- Context words toggle ----------

const CONTEXT_SETTING_KEY = "speed_reader:showContext";

function setShowContext(isOn) {
  state.showContext = isOn;
  el.contextToggle.textContent = "Context: " + (isOn ? "on" : "off");
  el.contextToggle.setAttribute("aria-pressed", isOn);
  try {
    localStorage.setItem(CONTEXT_SETTING_KEY, isOn ? "on" : "off");
  } catch (error) {
    // Ignore: the toggle still works for this visit
  }
  if (state.book) render();
}

function loadShowContext() {
  try {
    return localStorage.getItem(CONTEXT_SETTING_KEY) === "on";
  } catch (error) {
    return false;
  }
}

el.contextToggle.addEventListener("click", () => {
  setShowContext(!state.showContext);
  el.contextToggle.blur(); // so Space goes back to play and pause
});

setShowContext(loadShowContext());


// ---------- Timing mode switch ----------

const TIMING_SETTING_KEY = "speed_reader:timingMode";

// Earlier versions saved the modes under other names
const OLD_TIMING_NAMES = { ours: "custom", openspritz: "flat" };

function setTimingMode(mode) {
  mode = OLD_TIMING_NAMES[mode] || mode;
  if (!TIMING_MODES[mode]) mode = "custom"; // ignore unknown saved values
  state.timingMode = mode;
  el.timingSelect.value = mode;
  el.longWordControl.hidden = mode !== "custom"; // the slider only matters for Custom
  try {
    localStorage.setItem(TIMING_SETTING_KEY, mode);
  } catch (error) {
    // Ignore: the switch still works for this visit
  }
  // The pauses are spread differently, so recalculate the honest speed
  if (state.book) {
    state.speedScale = chapterSpeedScale(state.words, state.timingMode);
    renderStatus();
  }
}

function loadTimingMode() {
  try {
    return localStorage.getItem(TIMING_SETTING_KEY) || "custom";
  } catch (error) {
    return "custom";
  }
}

el.timingSelect.addEventListener("change", () => {
  setTimingMode(el.timingSelect.value);
  el.timingSelect.blur(); // give the keys back to the reader
});

setTimingMode(loadTimingMode());


// ---------- Long words slider ----------
// Extra time per letter past 5, in percent (only used by "Custom" timing)

const LONG_WORD_SETTING_KEY = "speed_reader:longWordPercent";
const DEFAULT_LONG_WORD_PERCENT = 12;

function setLongWordPercent(percent) {
  timingSettings.extraPerLetter = percent / 100;
  el.longWordSlider.value = percent;
  el.longWordValue.textContent = "+" + percent + "%";
  try {
    localStorage.setItem(LONG_WORD_SETTING_KEY, percent);
  } catch (error) {
    // Ignore: the slider still works for this visit
  }
  // Time moves between long and short words, so recalculate the honest speed
  if (state.book) {
    state.speedScale = chapterSpeedScale(state.words, state.timingMode);
    renderStatus();
  }
}

function loadLongWordPercent() {
  try {
    const raw = localStorage.getItem(LONG_WORD_SETTING_KEY);
    const saved = Number(raw);
    const isValid = raw !== null && saved >= 0 && saved <= 30;
    return isValid ? saved : DEFAULT_LONG_WORD_PERCENT;
  } catch (error) {
    return DEFAULT_LONG_WORD_PERCENT;
  }
}

el.longWordSlider.addEventListener("input", () => setLongWordPercent(Number(el.longWordSlider.value)));
el.longWordSlider.addEventListener("change", () => el.longWordSlider.blur());

setLongWordPercent(loadLongWordPercent());


// ---------- Settings button (phones only, see style.css) ----------

function setSettingsOpen(isOpen) {
  el.toolbar.classList.toggle("settings-open", isOpen);
  el.settingsToggle.setAttribute("aria-expanded", isOpen);
}

el.settingsToggle.addEventListener("click", () => {
  const isOpen = el.toolbar.classList.contains("settings-open");
  if (!isOpen) pause(); // no reading while changing settings
  setSettingsOpen(!isOpen);
  el.settingsToggle.blur();
});


// ---------- Offline support (web app) ----------
// Registers sw.js, which keeps a copy of the app on the device.
// Only works on a real web address, not when opening the file directly.

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Not fatal: the app still works, just not offline
  });
}


// ---------- On page load: reopen the last book ----------

async function reopenLastBook() {
  try {
    const file = await loadLastBook();
    if (file) await openBook(file);
  } catch (error) {
    // No saved book or storage blocked: just show the start screen
  }
}

reopenLastBook();


// ---------- Keyboard ----------

document.addEventListener("keydown", (event) => {
  if (el.readerScreen.hidden) return;

  if (event.code === "Space") {
    event.preventDefault(); // stop the page scrolling or buttons clicking
    togglePlay();
  } else if (event.key === "ArrowLeft" && event.shiftKey) {
    event.preventDefault();
    backOneSentence();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    stepWords(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    stepWords(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setSpeed(state.wordsPerMinute + SPEED_STEP);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    setSpeed(state.wordsPerMinute - SPEED_STEP);
  }
});
