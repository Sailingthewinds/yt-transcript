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

The straightforward approach — reading the caption URL from the watch page HTML and
fetching it — no longer works. That request now returns HTTP 200 with an empty body, so
tools built this way appear to succeed while returning nothing. This is why many
existing transcript scripts and extensions are broken.

Instead, this extension requests the caption track from YouTube's internal player
endpoint using an Android client context, which is not restricted in the same way.

Parsing has one non-obvious requirement. In auto-generated caption XML, roughly half the
`<p>` elements are empty placeholders used for the rolling-caption effect, and the text
of the remaining elements is held in `<s>` child nodes rather than directly. Reading
`textContent` per element and discarding blanks handles both cases; reading the elements
directly returns an empty transcript.

## Files

```
manifest.json    30 lines   permissions and configuration
content.js      245 lines   fetch, parse, copy, on-page button
background.js    56 lines   toolbar icon and keyboard shortcut
```

No build step and no dependencies. The extension has access to a site you are signed
into, so the source is kept short enough to audit directly.

## If it stops working

This depends on an undocumented internal API and will eventually break. When transcripts
stop resolving, update `CLIENT_VERSION` at the top of `content.js` to a current YouTube
Android app version. That is usually the only change needed.

## License

MIT
