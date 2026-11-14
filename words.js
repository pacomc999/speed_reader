// words.js
// Pure helpers about words: splitting text, picking the focus letter,
// and deciding how long each word stays on screen.


// Turns a chapter's paragraphs into one long list of words.
// Each word remembers which paragraph it came from (for the paused view).
function splitIntoWords(paragraphs) {
  const words = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const parts = paragraph.split(" ").filter((part) => part.length > 0);
    parts.forEach((text, i) => {
      words.push({
        text,
        paragraphIndex,
        endsParagraph: i === parts.length - 1,
      });
    });
  });
  return words;
}


// Counts only letters and digits, so "running," counts as 7, not 8
function letterCount(text) {
  return (text.match(/[\p{L}\p{N}]/gu) || []).length;
}


// Finds which letter of a word gets the colour.
// It sits a little left of the middle, where the eye naturally lands.
function focusIndex(word) {
  // Skip opening punctuation like quotes or brackets
  const firstLetter = word.search(/[\p{L}\p{N}]/u);
  const start = firstLetter === -1 ? 0 : firstLetter;
  const length = letterCount(word); // ignore punctuation when measuring

  let offset;
  if (length <= 1) offset = 0;
  else if (length <= 5) offset = 1;
  else if (length <= 9) offset = 2;
  else if (length <= 13) offset = 3;
  else offset = 4;

  return start + offset;
}


// Splits a word into the part before, the focus letter, and the part after.
function splitAtFocus(word) {
  // Array.from keeps accented letters and emoji in one piece
  const letters = Array.from(word);
  const index = Math.min(focusIndex(word), letters.length - 1);
  return {
    before: letters.slice(0, index).join(""),
    focus: letters[index] || "",
    after: letters.slice(index + 1).join(""),
  };
}


// ---------- Timing ----------
// Each timing mode says, for one word, how many "beats" it is shown
// and how many beats the screen stays blank afterwards.
// One beat = 60000 / wpm milliseconds (scaled later so the real
// average speed matches the slider; see chapterSpeedScale).

const TIMING_MODES = {
  custom: customTiming,
  flat: flatTiming,
};

function wordTiming(word, mode) {
  return TIMING_MODES[mode](word);
}

// "Custom": a little extra per letter for long words (set by the
// Long words slider), times an extra for punctuation. Both can apply at once.
function customTiming(word) {
  return { show: lengthMultiplier(word.text) * punctuationMultiplier(word), blank: 0 };
}

// "Flat": OpenSpritz's method, copied from its spritz.js.
// Long words (over 8 characters) or words with , : - ( are shown 3 beats
// (unless they contain a full stop), and after . ! ? : ; ) the screen
// goes blank for 3 beats
function flatTiming(word) {
  const text = word.text;
  let show = 1;
  let blank = 0;
  if ((/[,:\-(]/.test(text) || text.length > 8) && !text.includes(".")) show = 3;
  if (/[.!?:;)]/.test(text)) blank = 3;
  return { show, blank };
}

// Total beats a word takes, shown plus blank
function totalBeats(word, mode) {
  const timing = wordTiming(word, mode);
  return timing.show + timing.blank;
}

// Makes the slider honest: shrinks every beat so that the whole chapter
// takes exactly as long as plain words at the chosen speed would.
// So "300 wpm" really means 300 words per minute in every mode.
function chapterSpeedScale(words, mode) {
  if (words.length === 0) return 1;
  const beats = words.reduce((sum, word) => sum + totalBeats(word, mode), 0);
  return words.length / beats;
}

// Long words get a little more time for every letter past 5,
// growing smoothly instead of jumping at one length.
// The reader changes extraPerLetter from the "Long words" slider.
const timingSettings = {
  extraPerLetter: 0.12, // 12% more time per letter past 5
};
const MAX_LENGTH_MULTIPLIER = 2.5;

function lengthMultiplier(text) {
  const extraLetters = Math.max(0, letterCount(text) - 5);
  const multiplier = 1 + extraLetters * timingSettings.extraPerLetter;
  return Math.min(MAX_LENGTH_MULTIPLIER, multiplier);
}

// Pauses at the end of paragraphs, sentences and clauses,
// where readers naturally take a moment to "wrap up" the meaning
function punctuationMultiplier(word) {
  if (word.endsParagraph) return 2.5;
  if (/[.!?]["'”’)\]]*$/.test(word.text)) return 2.2; // end of sentence
  if (/[,;:]["'”’)\]]*$/.test(word.text)) return 1.5; // comma and friends
  return 1;
}


// Finds where the current sentence starts, so we can jump back to it.
// If we are already at a sentence start, goes to the previous one.
function previousSentenceStart(words, index) {
  const currentStart = sentenceStart(words, index);
  if (currentStart < index) return currentStart; // middle of a sentence
  if (index === 0) return 0;
  return sentenceStart(words, index - 1); // already at a start, go one back
}

// Walks backwards until the word before ends a sentence
function sentenceStart(words, index) {
  let i = index;
  while (i > 0 && !endsSentence(words[i - 1])) i--;
  return i;
}

// True if a word ends a sentence or a paragraph
function endsSentence(word) {
  return word.endsParagraph || /[.!?]["'”’)\]]*$/.test(word.text);
}
