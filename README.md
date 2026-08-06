# YT Transcript

A Chrome/Brave extension that adds a **Transcript** button to YouTube's action row,
next to Share and Save. Clicking it copies the full transcript to your clipboard as
clean text.

The built-in alternative is to open the description, click "Show transcript", scroll the
panel, select the text, copy it, and remove the timestamps by hand. On long videos that
selection is also unreliable, because YouTube only keeps part of the transcript list in
the page at a time, so selecting all of it can return a fraction of the text.

## Install

1. Download this repo: **Code ▸ Download ZIP**, then unzip. Or clone it.
2. Open `chrome://extensions` or `brave://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the folder.

## Usage

Any of these copies the transcript. A short confirmation appears with the word count.

- Click **Transcript** in the row with Share and Save.
- Press **Cmd+Shift+Y** or **Option+Shift+Y** while the video page has focus
  (Ctrl instead of Cmd on Windows and Linux).
- Click the extension's toolbar icon.

macOS assigns Cmd+Shift+Y to a built-in service, and some dictation and clipboard
utilities claim it as well. If it does nothing, use Option+Shift+Y, or assign your own
key at `chrome://extensions/shortcuts`. A key assigned there is registered by the
browser rather than the page, so it also works when focus is elsewhere.

Supports standard videos, Shorts, and live replays. Uses human-written captions when
they exist and auto-generated ones otherwise. Output has no timestamps or speaker
markers, so it can be pasted directly into notes or a language model.

## Permissions

- `youtube.com` — required to read the caption track. The extension has no access to
  any other site.
- `clipboardWrite` — required to copy the text.

There is no account, no configuration, and no analytics. Nothing runs in the background;
code executes only when you click. The single network request goes to YouTube.

## Limitations

Private, members-only, and age-restricted videos cannot be read. Videos with captions
disabled have no transcript to fetch. Both cases show an explanatory message instead of
copying nothing.

## How it works

Reading the caption URL out of the page and fetching it directly mostly does not work
any more. Those URLs now carry an `exp=xpe` flag, and when it is set the timedtext
endpoint answers every programmatic request with HTTP 200 and an empty body — including
requests carrying the cookies of a signed-in browser. Clearing it requires a `pot`
proof-of-origin token, minted by YouTube's BotGuard inside the page's own JavaScript.
An extension can neither mint one nor borrow one.

Impersonating the YouTube Android app used to route around this, and earlier versions of
this extension did exactly that. It is now the thing that breaks first: the real app
ships an attestation token, a browser `fetch` cannot produce one, and YouTube answers a
forged client with "Sign in to confirm you're not a bot." That message is a refusal, not
a prompt — there is nothing to sign in to, and signing in does not clear it. Whether it
fires depends on how much the profile and IP are trusted, which is why the same build
could work on one machine and fail on another.

So the extension does not make a gated request at all. It drives YouTube's own transcript
panel — the one behind "Show transcript" — and reads the rendered segments out of the
page, then restores the panel to how it was found. YouTube fetched that data for itself,
with its own token, so the rule is simply: if you can see a transcript, this can copy it.
There is nothing for bot detection to flag, and it behaves the same on a profile that has
never signed in.

The panel is worth using for a second reason. Dragging a selection across it returns only
a fraction of a long transcript, which is the limitation this extension was written to
avoid — but that is a clipboard limitation, not a rendering one. Every segment is present
in the DOM and can be read.

Videos with captions but no transcript panel fall back to the direct caption fetch, which
still succeeds where the `exp=xpe` flag is absent. That path has one non-obvious parsing
requirement: in auto-generated caption XML, roughly half the `<p>` elements are empty
placeholders used for the rolling-caption effect, and the text of the remaining elements
is held in `<s>` child nodes rather than directly. Reading `textContent` per element and
discarding blanks handles both cases.

## Files

```
manifest.json    40 lines   permissions and configuration
content.js      480 lines   read, parse, copy, on-page button
background.js    56 lines   toolbar icon and keyboard shortcut
```

No build step and no dependencies. The extension has access to a site you are signed
into, so the source is kept short enough to audit directly.

## If it stops working

This reads YouTube's own markup, so it breaks when that markup is renamed rather than
when an API changes. The selectors to check are `PANEL_SEL` and `SEGMENT_SEL` in
`content.js`; open the transcript panel yourself, inspect a line, and update them to
match.

If the transcript panel has stopped opening for you in plain YouTube too, the extension
cannot help — it has no path that YouTube itself does not have.

## License

MIT
