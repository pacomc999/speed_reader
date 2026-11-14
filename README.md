# Speed Reader

Read EPUB books one word at a time. Each word flashes in the same spot with one letter in red, so your eyes never have to move.

**Try it:** https://pacomc999.github.io/speed_reader/

## Features

- Open any EPUB file (drag it onto the page or click to choose)
- Speed from 100 to 1000 words per minute, and the number is your real average speed
- Longer pauses on punctuation, and a "Long words" slider for extra time on long words
- Two timing styles to compare: our smooth timing, or the flat timing of OpenSpritz
- Optional context words (the previous and next word, dimmed)
- Remembers your book, your place and your settings in the browser

## Keys

| Key | Action |
|---|---|
| Space | Play or pause |
| Left / Right | Jump back or forward |
| Shift + Left | Back to the start of the sentence |
| Up / Down | Change speed |
| C | Context words on or off |
| T | Switch timing style |

When paused, the whole paragraph is shown and you can click any word to jump there.

## Files

- `index.html`, `style.css`: the page
- `reader.js`: playing, pausing, keys, saving your place
- `words.js`: focus letter and timing rules
- `epub.js`: reads EPUB files (with a tiny built in unzipper, no libraries)
- `storage.js`: keeps a copy of the last book in the browser

## OpenSpritz

The `openspritz` folder holds a copy of [OpenSpritz](https://github.com/Miserlou/OpenSpritz) by Rich Jones (MIT licence), used for comparison. `openspritz/local_demo.html` runs it on pasted text or an EPUB chapter.
