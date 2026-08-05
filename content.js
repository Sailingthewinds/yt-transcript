// YT Transcript — copies the current video's transcript to your clipboard.
//
// Runs only on youtube.com. The player call below is same-origin, so this needs
// no host permissions.

(() => {
  // background.js re-injects this file into tabs that predate the install;
  // without this guard that would stack a second set of listeners.
  if (window.__ytTranscriptLoaded) return;
  window.__ytTranscriptLoaded = true;

  // YouTube's internal API is undocumented. If transcripts stop resolving,
  // bumping this to a current Android app version is the first thing to try.
  const CLIENT_VERSION = "20.10.38";
  const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

  function videoId() {
    const url = new URL(location.href);
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const m = url.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // The Android client is deliberate: caption URLs handed to the web client are
  // gated and come back as an empty 200.
  async function player(id) {
    const res = await fetch(`/youtubei/v1/player?key=${INNERTUBE_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Youtube-Client-Name": "3",
        "X-Youtube-Client-Version": CLIENT_VERSION,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: CLIENT_VERSION,
            androidSdkVersion: 30,
            hl: "en",
            gl: "US",
          },
        },
        videoId: id,
      }),
    });
    if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
    return res.json();
  }

  function pickTrack(tracks) {
    if (!tracks.length) throw new Error("No captions on this video");
    // Human-written English, then auto-generated English, then anything.
    return (
      tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ||
      tracks.find((t) => t.languageCode?.startsWith("en")) ||
      tracks[0]
    );
  }

  // Manual tracks are <p t d>text</p>. Auto-generated tracks put their words in
  // <s> children and interleave empty rolling-window <p> placeholders, so read
  // the full text of each <p> and drop the blanks.
  async function captionText(track) {
    const xml = await (await fetch(track.baseUrl)).text();
    if (!xml.trim()) throw new Error("Empty caption track");

    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const lines = [...doc.querySelectorAll("p")]
      .map((p) => p.textContent.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (!lines.length) throw new Error("Caption track was empty");
    return lines.join(" ").replace(/\s+/g, " ").trim();
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs document focus; this path covers the rest.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  let toastEl;
  function toast(msg, isError) {
    toastEl?.remove();
    toastEl = document.createElement("div");
    toastEl.textContent = msg;
    toastEl.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      z-index:2147483647;padding:12px 20px;border-radius:10px;
      background:${isError ? "#c0392b" : "#111"};color:#fff;
      font:500 14px/1.4 system-ui,-apple-system,sans-serif;
      box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none;
      max-width:70vw;text-align:center;white-space:pre-line;
      opacity:0;transition:opacity .15s`;
    document.body.appendChild(toastEl);
    requestAnimationFrame(() => (toastEl.style.opacity = "1"));
    const el = toastEl;
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 200);
    }, 2600);
  }

  let busy = false;
  async function run() {
    if (busy) return;
    busy = true;
    try {
      const id = videoId();
      if (!id) throw new Error("No video on this page");

      toast("Getting transcript…");
      const data = await player(id);

      const status = data.playabilityStatus?.status;
      if (status && status !== "OK") {
        throw new Error(data.playabilityStatus.reason || "Video unavailable");
      }

      const tracks =
        data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      const text = await captionText(pickTrack(tracks));
      await copy(text);

      const words = text.split(/\s+/).length.toLocaleString();
      toast(`Transcript copied\n${words} words`);
    } catch (e) {
      toast(e.message, true);
    } finally {
      busy = false;
    }
  }

  // Trigger 1: a button in YouTube's own action row, next to Share and Save.
  // Fewest steps of anything here — it's already where you're looking.
  const BTN_ID = "ytt-copy-button";

  function makeButton(floating) {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "Transcript";
    btn.title = "Copy transcript to clipboard";
    btn.style.cssText = floating
      ? `position:fixed;right:24px;bottom:24px;z-index:2147483646;height:40px;
         padding:0 20px;border:0;border-radius:20px;cursor:pointer;
         font:600 14px/1 system-ui,-apple-system,sans-serif;
         background:#cc0000;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.35)`
      : `height:36px;padding:0 16px;margin-left:8px;border:0;border-radius:18px;
         cursor:pointer;font:500 14px/1 "Roboto",system-ui,sans-serif;
         background:var(--yt-spec-badge-chip-background,rgba(0,0,0,.05));
         color:var(--yt-spec-text-primary,inherit);white-space:nowrap`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
    return btn;
  }

  // YouTube renames these containers regularly, so try the known ids first,
  // then fall back to locating the Share button and using whatever row holds it.
  function findActionRow() {
    const direct =
      document.querySelector("#top-level-buttons-computed") ||
      document.querySelector("ytd-watch-metadata #actions-inner") ||
      document.querySelector("ytd-watch-metadata #actions");
    if (direct) return direct;

    const share = [...document.querySelectorAll("[aria-label]")].find((el) =>
      /^share/i.test(el.getAttribute("aria-label") || "")
    );
    if (!share) return null;
    return share.closest("#top-level-buttons-computed") || share.parentElement;
  }

  function ensureButton(allowFloating) {
    if (document.getElementById(BTN_ID) || !videoId()) return;

    const row = findActionRow();
    if (row) {
      row.appendChild(makeButton(false));
      console.log("[YT Transcript] button added to the action row");
      return;
    }
    // Last resort, so there is always something clickable even if YouTube
    // reshuffles its markup again.
    if (allowFloating) {
      document.body.appendChild(makeButton(true));
      console.log("[YT Transcript] action row not found — using floating button");
    }
  }

  // YouTube is a single-page app: it swaps the whole watch page without a
  // reload, so the button has to be re-added after every navigation.
  let pending;
  function scheduleEnsure() {
    clearTimeout(pending);
    pending = setTimeout(() => ensureButton(false), 300);
  }

  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("yt-navigate-finish", scheduleEnsure);
  ensureButton(false);

  // Give YouTube a few seconds to render its own buttons before falling back.
  setTimeout(() => ensureButton(true), 4000);

  // Triggers 2 and 3: toolbar icon and the browser-registered shortcut, both
  // routed through background.js so page focus can't starve them.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "grab") run();
  });

  // Trigger 3: in-page keys, for when the page already has focus. Capture
  // phase, so YouTube's own key handling doesn't swallow them first.
  function isHotkey(e) {
    if (e.code !== "KeyY" || !e.shiftKey) return false;
    return e.metaKey || e.ctrlKey || e.altKey;
  }

  function onKey(e) {
    if (!isHotkey(e)) return;
    e.preventDefault();
    e.stopPropagation();
    run();
  }

  window.addEventListener("keydown", onKey, true);
  document.addEventListener("keydown", onKey, true);

  console.log(
    "%c[YT Transcript] ready — click the toolbar icon, or press Cmd+Shift+Y / Option+Shift+Y",
    "color:#0a0;font-weight:bold"
  );
})();
