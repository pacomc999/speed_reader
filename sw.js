// sw.js (the "service worker")
// A small helper the browser runs in the background. It keeps a copy of
// the app's files on the device, so the app still opens without internet.
//
// Strategy: "network first". When online, always fetch the newest files
// (so updates show up straight away) and refresh the saved copy.
// When offline, use the saved copy instead.

const CACHE_NAME = "speed-reader-v2";

// Everything the app needs to start
const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "epub.js",
  "article.js",
  "words.js",
  "storage.js",
  "reader.js",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

// First install: save all the app files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting(); // start working straight away
});

// When a new version takes over, delete saved copies from old versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim();
});

// Every file request: try the internet first, fall back to the saved copy
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Only the app's own files. Web pages fetched through Jina Reader are
  // left alone (the open article is already saved with the last book).
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Keep the saved copy up to date (only for good answers)
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
