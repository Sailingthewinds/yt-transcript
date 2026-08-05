# Chrome Web Store listing

Copy-paste reference for the developer console. Not part of the extension.

## Product details

**Category:** Productivity
**Language:** English (United States)

Title and Summary come from `manifest.json` automatically.

### Description

```
YT Transcript adds a Transcript button to YouTube's action row, next to Share and
Save. Clicking it copies the video's full transcript to your clipboard as clean text.

The built-in alternative is to open the description, click "Show transcript", scroll
the panel, select the text, copy it, and remove the timestamps by hand. On long videos
that selection is also unreliable, because YouTube keeps only part of the transcript
list in the page at a time, so selecting all of it can return a fraction of the text.

HOW TO USE

Any of these copies the transcript:
- Click Transcript in the row with Share and Save
- Press Cmd+Shift+Y or Option+Shift+Y (Ctrl instead of Cmd on Windows and Linux)
- Click the extension's toolbar icon
- Assign your own shortcut at chrome://extensions/shortcuts

A short confirmation appears with the word count.

WHAT IT SUPPORTS

Standard videos, Shorts, and live replays. Uses human-written captions when they
exist and auto-generated captions otherwise. Output contains no timestamps or speaker
markers, so it can be pasted directly into notes or a language model.

PERMISSIONS

- youtube.com: required to read the caption track. The extension has no access to any
  other site.
- clipboardWrite: required to copy the text to your clipboard.

PRIVACY

No account, no configuration, no analytics. Nothing runs in the background; code
executes only when you click. The single network request goes to YouTube. No data is
collected, stored, or transmitted anywhere.

LIMITATIONS

Private, members-only, and age-restricted videos cannot be read. Videos with captions
disabled have no transcript to fetch. Both cases show an explanatory message instead
of copying nothing.

OPEN SOURCE

Three files, 331 lines, no build step and no dependencies. The full source is
available for review:
https://github.com/Sailingthewinds/yt-transcript
```

## Graphic assets

| Store field | File |
|---|---|
| Store icon (128×128) | `icons/icon128.png` |
| Screenshot (1280×800) | `store/screenshot-1280x800.jpg` |
| Small promo tile (440×280) | `store/promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `store/promo-marquee-1400x560.png` |

Promo tiles are optional; they are only used if the item is featured.

## Additional fields

**Homepage URL:** `https://github.com/Sailingthewinds/yt-transcript`
**Support URL:** `https://github.com/Sailingthewinds/yt-transcript/issues`
**Mature content:** No

## Privacy tab

**Single purpose**

```
Copies the caption track of the YouTube video the user is currently viewing to their
clipboard.
```

**Permission justifications**

`host_permissions` (youtube.com)
```
Required to read the caption track for the video the user is viewing. The extension
operates only on youtube.com and has no access to any other site.
```

`scripting`
```
Required to insert the Transcript button into the YouTube page, and to inject the
content script into YouTube tabs that were already open when the extension was
installed or updated.
```

`clipboardWrite`
```
Required to place the transcript text on the user's clipboard, which is the
extension's only output.
```

**Data usage:** select **does not collect user data**, and check all three
certification boxes (no sale to third parties, no use unrelated to the single purpose,
no use for creditworthiness or lending).
