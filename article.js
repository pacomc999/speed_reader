// article.js
// Turns web pages and pasted text into a "book" the reader can play.
//
// Browsers do not let one website read another website's pages, so the
// page is fetched through Jina Reader (r.jina.ai), a free service that
// does allow it. It also strips menus and ads and sends back just the
// article, as Markdown text.


// ---------- Fetching a web page ----------

const READER_SERVICE = "https://r.jina.ai/";

// Asks Jina Reader for the article at this link.
// Gives back { title, text }, or throws an error with a friendly message.
async function loadWebPage(url) {
  let response;
  try {
    response = await fetch(READER_SERVICE + url, {
      headers: {
        Accept: "application/json",    // title and text as separate fields
        "X-Retain-Images": "none",     // no image links in the text
        "X-Md-Link-Style": "discarded", // keep link words, drop the addresses
      },
    });
  } catch (error) {
    throw new Error("Could not reach the page. Check your internet, or paste the text instead.");
  }

  if (response.status === 429) {
    throw new Error("Too many pages in a short time. Wait a minute and try again.");
  }
  if (!response.ok) {
    throw new Error("That page could not be loaded. Try copying its text and pasting it instead.");
  }

  const result = await response.json();
  return {
    title: result.data.title || new URL(url).hostname,
    text: result.data.content || "",
  };
}

// Adds "https://" when someone types just "example.com/story"
function normaliseLink(link) {
  const trimmed = link.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
}


// ---------- Text to book ----------

// Wraps text in the same shape loadEpub gives: one book, one chapter
function textToBook(title, text) {
  const paragraphs = textToParagraphs(text);
  if (paragraphs.length === 0) {
    throw new Error("No readable text found there.");
  }
  return { title, chapters: [{ title, paragraphs }] };
}

// A title for pasted text: its first few words
function titleFromText(text) {
  const words = text.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 50 ? words.slice(0, 50) + "..." : words + "...";
}

// Every line is its own paragraph (Jina and copied web text put one
// paragraph per line). Lines with no letters or digits are dropped.
function textToParagraphs(text) {
  return text
    .split("\n")
    .filter((line) => !isTableOrCode(line))
    .map(cleanLine)
    .filter((line) => /[\p{L}\p{N}]/u.test(line));
}

// Tables, code blocks and divider lines are not worth reading word by word
function isTableOrCode(line) {
  return /^\s*(\||```|---+\s*$|===+\s*$|\*\*\*+\s*$)/.test(line);
}

// Removes Markdown marks so only the words are left
function cleanLine(line) {
  return line
    .replace(/^\s*#{1,6}\s+/, "")              // heading marks: ## Title
    .replace(/^\s*>\s?/, "")                   // quote marks: > text
    .replace(/^\s*([-*+]|\d+\.)\s+/, "")       // list bullets: - item, 1. item
    .replace(/(\*\*|__)(.+?)\1/g, "$2")        // bold: **word**
    .replace(/\*(.+?)\*/g, "$1")               // italics: *word*
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, "$1$2") // italics: _word_
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // any leftover image
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // any leftover link: keep its words
    .replace(/\[(\d+|edit|citation needed)\]/gi, "") // Wikipedia marks: [1] [edit]
    .replace(/\s+/g, " ")
    .trim();
}
