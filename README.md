# Speed Reader

Read EPUB books one word at a time. Each word flashes in the same spot with one letter in red, so your eyes never have to move.

**Try it:** https://pacomc999.github.io/speed_reader/

## Install on iPhone

1. Open the link above in **Safari**
2. Tap the **Share** button, then **Add to Home Screen**
3. Open it from the home screen: it runs full screen and works offline

Books are chosen from the Files app (iCloud Drive, downloads, etc.). Books bought in Apple Books are locked and cannot be opened. The installed app has its own memory, separate from Safari.

## Features

- Open any EPUB file (drag it onto the page or click to choose)
- Speed from 100 to 1000 words per minute, and the number is your real average speed
- Two timing styles:
  - **Custom**: longer pauses on punctuation, plus a "Long words" slider for extra time on long words
  - **Flat**: the timing of OpenSpritz (long words and commas 3 beats, a blank screen after sentences)
- Optional context words (the previous and next word, dimmed)
- Remembers your book, your place and your settings in the browser

## Keys

| Key | Action |
|---|---|
| Space | Play or pause |
| Left / Right | Jump back or forward |
| Shift + Left | Back to the start of the sentence |
| Up / Down | Change speed |

When paused, the word stays frozen and the chapter text appears below it. Click (or tap) any word there to jump to it. On a phone, tap the word to play or pause, and the controls are behind the **Settings** button.

## Files

- `index.html`, `style.css`: the page
- `reader.js`: playing, pausing, keys, saving your place
- `words.js`: focus letter and timing rules
- `epub.js`: reads EPUB files (with a tiny built in unzipper, no libraries)
- `storage.js`: keeps a copy of the last book in the browser
- `manifest.webmanifest`, `icons/`: web app name and icons (for Add to Home Screen)
- `sw.js`: service worker, keeps the app on the device so it works offline
- `tools/make_icons.py`: draws the icons (`python tools/make_icons.py`)

## OpenSpritz

The `openspritz` folder holds a copy of [OpenSpritz](https://github.com/Miserlou/OpenSpritz) by Rich Jones (MIT licence), used for comparison. `openspritz/local_demo.html` runs it on pasted text or an EPUB chapter.
