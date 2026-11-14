// storage.js
// Keeps a copy of the last opened book inside the browser (IndexedDB),
// so the reader can open it again by itself next time.
// A web page cannot reopen a file from your disk on its own, which is
// why we store a copy instead of just remembering the file's location.
//
// IndexedDB is older than "async/await", so it reports results through
// onsuccess / onerror callbacks. Each helper wraps that in a Promise,
// which lets the rest of the code simply "await" it.

const DATABASE_NAME = "speed_reader";
const STORE_NAME = "books";
const LAST_BOOK_KEY = "last";

// Opens (or creates on first use) the database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Saves the book file, replacing the previous one
async function saveLastBook(file) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(file, LAST_BOOK_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Gives back the saved book file, or undefined if there is none
async function loadLastBook() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(LAST_BOOK_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
