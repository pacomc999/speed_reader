// epub.js
// Turns an EPUB file into a list of chapters, each with paragraphs of plain text.
// An EPUB is a ZIP file full of web pages, so first we unzip it, then we read
// the "table of contents" files to find the chapters in reading order.


// ---------- Part 1: a tiny ZIP reader ----------

// Reads the list of files inside a ZIP and returns a Map:
// file name -> function that gives back that file's bytes.
function readZip(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const nameDecoder = new TextDecoder("utf-8");

  // The "end of central directory" record sits near the end of every ZIP.
  // It tells us where the list of files starts. We search backwards for it.
  let endRecord = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      endRecord = i;
      break;
    }
  }
  if (endRecord === -1) {
    throw new Error("This file does not look like an EPUB (no ZIP data found).");
  }

  const fileCount = view.getUint16(endRecord + 10, true);
  let position = view.getUint32(endRecord + 16, true);
  const files = new Map();

  // Walk through the central directory, one entry per file
  for (let i = 0; i < fileCount; i++) {
    const method = view.getUint16(position + 10, true);
    const compressedSize = view.getUint32(position + 20, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const localHeader = view.getUint32(position + 42, true);
    const name = nameDecoder.decode(bytes.subarray(position + 46, position + 46 + nameLength));

    files.set(name, () => readZipEntry(view, bytes, localHeader, method, compressedSize));
    position += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

// Gets the bytes of one file inside the ZIP, unpacking them if needed.
async function readZipEntry(view, bytes, localHeader, method, compressedSize) {
  // The local header has its own name and extra fields before the data
  const nameLength = view.getUint16(localHeader + 26, true);
  const extraLength = view.getUint16(localHeader + 28, true);
  const start = localHeader + 30 + nameLength + extraLength;
  const data = bytes.subarray(start, start + compressedSize);

  if (method === 0) return data; // stored, not compressed
  if (method !== 8) throw new Error("Unsupported compression in this EPUB.");

  // Method 8 is "deflate", which the browser can unpack for us
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}


// ---------- Part 2: small helpers ----------

// Reads a file from the ZIP as text
async function readText(files, path) {
  const getBytes = files.get(path);
  if (!getBytes) throw new Error("Missing file inside the EPUB: " + path);
  return new TextDecoder("utf-8").decode(await getBytes());
}

// Joins a folder and a relative link, handling "../" parts
function joinPath(folder, link) {
  const parts = (folder + decodeURIComponent(link.split("#")[0])).split("/");
  const clean = [];
  for (const part of parts) {
    if (part === "..") clean.pop();
    else if (part !== "." && part !== "") clean.push(part);
  }
  return clean.join("/");
}

// Finds elements by tag name, ignoring XML namespace prefixes like "opf:"
function byTag(doc, tagName) {
  return Array.from(doc.getElementsByTagNameNS("*", tagName));
}


// ---------- Part 3: from chapter web page to paragraphs ----------

// Tags that hold a block of readable text
const BLOCK_TAGS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, dt, dd";

// Pulls clean paragraphs of text out of one chapter's HTML
function extractParagraphs(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.body.querySelectorAll(BLOCK_TAGS));

  // Skip blocks that contain other blocks, so text is not counted twice
  const innermost = blocks.filter((block) => !block.querySelector(BLOCK_TAGS));

  // Fall back to the whole page if the book uses only plain divs
  const sources = innermost.length > 0 ? innermost : [doc.body];

  return sources
    .map((block) => block.textContent.replace(/\s+/g, " ").trim())
    .filter((text) => text.length > 0);
}

// Picks a chapter title: the first visible heading, or "Section N".
// (The hidden <title> tag is skipped: many books put the book name there.)
function findTitle(html, number) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const heading = doc.body.querySelector("h1, h2, h3");
  const text = heading ? heading.textContent.replace(/\s+/g, " ").trim() : "";
  return text.length > 0 && text.length < 80 ? text : "Section " + number;
}


// ---------- Part 4: the main function ----------

// Takes the EPUB file the user picked and returns
// { title, chapters: [{ title, paragraphs: [string] }] }
async function loadEpub(file) {
  const files = readZip(await file.arrayBuffer());

  // container.xml points to the "package" file (.opf) that lists everything
  const containerXml = await readText(files, "META-INF/container.xml");
  const container = new DOMParser().parseFromString(containerXml, "application/xml");
  const opfPath = byTag(container, "rootfile")[0].getAttribute("full-path");
  const opfFolder = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const opfXml = await readText(files, opfPath);
  const opf = new DOMParser().parseFromString(opfXml, "application/xml");

  // Book title from the metadata, or the file name as a backup
  const titleTag = byTag(opf, "title")[0];
  const bookTitle = titleTag ? titleTag.textContent.trim() : file.name.replace(/\.epub$/i, "");

  // The manifest maps ids to file paths
  const manifest = new Map();
  for (const item of byTag(opf, "item")) {
    manifest.set(item.getAttribute("id"), joinPath(opfFolder, item.getAttribute("href")));
  }

  // The spine lists the chapters in reading order
  const chapters = [];
  for (const itemref of byTag(opf, "itemref")) {
    const path = manifest.get(itemref.getAttribute("idref"));
    if (!path || !files.has(path)) continue;

    const html = await readText(files, path);
    const paragraphs = extractParagraphs(html);
    if (paragraphs.length === 0) continue; // skip covers and blank pages

    chapters.push({ title: findTitle(html, chapters.length + 1), paragraphs });
  }

  if (chapters.length === 0) throw new Error("No readable text found in this EPUB.");
  return { title: bookTitle, chapters };
}
