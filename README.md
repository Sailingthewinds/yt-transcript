# YT Transcript

**A Transcript button, right where Share and Save already are. One click, and the
whole thing is on your clipboard.**

---

You know the dance. Open the description. Find "Show transcript." Scroll the panel.
Drag-select a thousand lines while the page fights you. Paste it somewhere, then spend
a minute picking timestamps out by hand.

Worse, on a long video that select-all quietly lies to you — YouTube only keeps a
window of rows in the DOM, so you copy a fraction and don't find out until the text is
already in your notes.

This replaces all of it with one click and clean prose.

## Install

1. Download this repo — **Code ▸ Download ZIP**, then unzip. Or clone it.
2. Open `chrome://extensions` (or `brave://extensions`).
3. Turn on **Developer mode**, top right.
4. **Load unpacked**, and pick the folder.

Open any video. The **Transcript** button is sitting next to Share.

## Using it

Click it. A toast confirms the copy and the word count. Paste.

There's also a toolbar icon, and you can bind a key at `chrome://extensions/shortcuts`
if you'd rather never touch the mouse. Both do the same thing.

It works on regular videos, Shorts, and live replays. It prefers human-written captions
and falls back to auto-generated ones. Output is clean prose — no timestamps, no
`[Music]`, nothing to strip before pasting into an LLM.

## Why this one works

Most transcript scripts and extensions are quietly broken, and they all break the same
way. The obvious approach — read the caption URL out of the watch page, then fetch it —
now returns **HTTP 200 with an empty body**. Not an error. An empty success. So the tool
reports nothing wrong and hands you nothing.

This one asks YouTube's internal player endpoint for the caption track using an Android
client context, which isn't gated the same way.

There's a second trap underneath it. Auto-generated captions don't hold their text where
you'd expect: half the elements are empty placeholders for the rolling-caption effect,
and the actual words live in child nodes. Read them the natural way and you get a
transcript that is confidently, silently empty.

Both were found by testing against real videos, not by reading documentation. There
isn't any — this is an internal API.

## What it costs you

Two permissions, both narrow:

- **youtube.com** — so it can read the caption track. It cannot see any other tab.
- **clipboard** — so it can hand you the text.

No account. No settings. No telemetry. No background process — nothing runs until you
click. The only network request it makes is to YouTube, the same one your browser was
already going to make.

## What it won't do

Private, members-only, and age-restricted videos are out of reach. Videos with captions
genuinely disabled have nothing to fetch. In both cases you get a clear message rather
than an empty clipboard.

## The whole thing

Four files. Around 250 lines. No build step, no dependencies, no bundler, no framework.
You can read all of it in two minutes, which is the point — you're granting it access to
a site you're signed into, and you should be able to check what it does.

```
manifest.json   permissions and wiring
content.js      fetch, parse, copy, the on-page button
background.js   toolbar icon and keyboard shortcut
```

## If it ever breaks

It depends on an undocumented internal API, so one day it will. When transcripts stop
resolving, open `content.js` and bump `CLIENT_VERSION` at the top to a current YouTube
Android app version. That's almost always the entire fix.

## License

MIT — use it, change it, ship it in something else. Just keep the copyright line.
