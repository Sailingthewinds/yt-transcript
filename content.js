// YT Transcript — copies the current video's transcript to your clipboard.
//
// Runs only on youtube.com, and reads the transcript out of YouTube's own
// interface rather than requesting it. See "How it works" in the README.

(() => {
  // background.js re-injects this file into tabs that predate the install;
  // without this guard that would stack a second set of listeners.
  if (window.__ytTranscriptLoaded) return;
  window.__ytTranscriptLoaded = true;

  function videoId() {
    const url = new URL(location.href);
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const m = url.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // Earlier versions of this file forged the YouTube Android app client to get
  // caption URLs. That is now the thing that breaks: the real app ships an
  // attestation token with every request, a browser fetch cannot produce one,
  // and YouTube answers a forged client with "Sign in to confirm you're not a
  // bot" — a refusal, not a real sign-in prompt, so there is nothing to sign in
  // to. Whether it fires depends on how much the profile and IP are trusted,
  // which is why the same build worked on one machine and not another.
  //
  // So don't impersonate anything. The primary path is the transcript panel,
  // further down. What follows is the fallback for videos that have captions but
  // no panel: read the caption list the watch page already carries.

  // Reading `window.ytInitialPlayerResponse` directly is not an option: content
  // scripts run in an isolated world and cannot see page globals. Fetching the
  // watch document is same-origin and credentialed, so it returns the same HTML
  // this tab was built from.
  async function watchPageHtml(id) {
    const res = await fetch(`/watch?v=${id}`, { credentials: "include" });
    if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
    return res.text();
  }

  // The JSON blobs in the page are followed by minified script, so scanning to
  // the next `;` or `</script>` cuts them short. Match brackets instead.
  function jsonAfter(html, marker) {
    const at = html.indexOf(marker);
    if (at === -1) return null;

    const start = html.indexOf("{", at);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < html.length; i++) {
      const c = html[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  function tracksFrom(playerResponse) {
    return (
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
      []
    );
  }

  // The player response embedded in the watch page. Its caption URLs are signed
  // for this session, which the forged-client URLs never were.
  async function tracksFromPage(id, cache) {
    cache.html ??= await watchPageHtml(id);
    const pr = jsonAfter(cache.html, "ytInitialPlayerResponse");

    const status = pr?.playabilityStatus?.status;
    if (status && status !== "OK") {
      throw new Error(pr.playabilityStatus.reason || "Video unavailable");
    }
    return tracksFrom(pr);
  }

  // Most caption URLs now carry `exp=xpe`, which makes the timedtext endpoint
  // answer any programmatic fetch with an empty 200 — logged in or not. Clearing
  // it needs a `pot` proof-of-origin token minted by YouTube's own BotGuard
  // inside the page's JS, which an extension cannot mint and cannot borrow.
  // Videos without that flag still work, so it is worth trying; the panel below
  // covers everything else.
  function isGated(track) {
    const u = new URL(track.baseUrl, location.origin);
    return u.searchParams.get("exp") === "xpe" && !u.searchParams.get("pot");
  }

  // The transcript panel is the one component on the page guaranteed to have a
  // valid token, because YouTube fetched it for itself. Driving it means the
  // extension makes no gated request at all: if you can see a transcript, this
  // can read it. Nothing here can trip bot detection, and it works the same on a
  // brand-new profile that has never signed in.
  const PANEL_SEL =
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';
  const SEGMENT_SEL = "ytd-transcript-segment-renderer";

  function waitFor(check, timeout) {
    return new Promise((resolve) => {
      const started = performance.now();
      (function poll() {
        const value = check();
        if (value) return resolve(value);
        if (performance.now() - started > timeout) return resolve(null);
        setTimeout(poll, 100);
      })();
    });
  }

  // The README's warning that the panel returns only part of a long transcript
  // is about dragging a selection across it. Every segment is in the DOM; it is
  // the clipboard that was losing them.
  function readSegments(panel) {
    const nodes = panel.querySelectorAll(SEGMENT_SEL);
    if (!nodes.length) return null;

    return tidy(
      [...nodes].map((n) => {
        const body = n.querySelector(".segment-text");
        if (body) return body.textContent;
        // Fall back to the whole row minus its timestamp column.
        const stamp = n.querySelector(".segment-timestamp")?.textContent || "";
        return n.textContent.replace(stamp, "");
      })
    );
  }

  // "Show transcript" only exists once the description is expanded.
  function openerButton() {
    const self = document.getElementById(BTN_ID);
    return (
      [...document.querySelectorAll("button")].find((b) => {
        if (self && (b === self || self.contains(b))) return false;
        const label = b.getAttribute("aria-label") || b.textContent || "";
        return /transcript/i.test(label);
      }) || null
    );
  }

  async function transcriptFromPanel() {
    let panel = document.querySelector(PANEL_SEL);

    // Already open and populated — read it and leave the UI as it was.
    const ready = panel && readSegments(panel);
    if (ready) return ready;

    document.querySelector("#description-inline-expander #expand")?.click();

    const opener = await waitFor(openerButton, 2000);
    if (!opener) return null;
    opener.click();

    panel = await waitFor(() => {
      const p = document.querySelector(PANEL_SEL);
      return p?.querySelector(SEGMENT_SEL) ? p : null;
    }, 8000);
    if (!panel) return null;

    const text = readSegments(panel);

    // Put the page back the way it was found.
    panel
      .querySelector("#visibility-button button, #dismiss-button button")
      ?.click();

    return text;
  }

  function tidy(lines) {
    const text = lines
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  }

  // json3 hands back segments as data instead of markup, which sidesteps the
  // placeholder problem below entirely. Ask for it first.
  function parseJson3(body) {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return null;
    }
    const events = data?.events;
    if (!Array.isArray(events)) return null;

    return tidy(
      events.map((e) => (e.segs || []).map((s) => s.utf8 || "").join(""))
    );
  }

  // Manual tracks are <p t d>text</p>. Auto-generated tracks put their words in
  // <s> children and interleave empty rolling-window <p> placeholders, so read
  // the full text of each <p> and drop the blanks. <text> is the older shape,
  // still served for some tracks.
  function parseXml(body) {
    const doc = new DOMParser().parseFromString(body, "text/xml");
    if (doc.querySelector("parsererror")) return null;

    const nodes = [...doc.querySelectorAll("p, text")];
    if (!nodes.length) return null;

    const decode = (s) =>
      s.replace(/&amp;#(\d+);/g, (_, n) => String.fromCharCode(n));
    return tidy(nodes.map((n) => decode(n.textContent)));
  }

  async function fetchCaptions(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const body = await res.text();
    if (!body.trim()) return null;
    return parseJson3(body) || parseXml(body);
  }

  // A gated URL answers 200 with an empty body rather than an error, so treat
  // "empty" as "try the next candidate" instead of failing.
  async function captionText(tracks) {
    // Human-written English, then auto-generated English, then anything.
    const ordered = [
      ...tracks.filter(
        (t) => t.languageCode?.startsWith("en") && t.kind !== "asr"
      ),
      ...tracks.filter((t) => t.languageCode?.startsWith("en")),
      ...tracks,
    ];

    const seen = new Set();
    for (const track of ordered) {
      if (!track.baseUrl || seen.has(track.baseUrl) || isGated(track)) continue;
      seen.add(track.baseUrl);

      const base = track.baseUrl.replace(/&fmt=\w+/g, "");
      for (const url of [`${base}&fmt=json3`, base]) {
        const text = await fetchCaptions(url);
        if (text) return text;
      }
    }
    return null;
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

      // The panel first: it is the path that cannot be gated. The direct fetch
      // is quicker but only ungated videos answer it, so it runs as a fallback
      // for the cases the panel does not cover, such as videos whose transcript
      // panel YouTube does not offer.
      let text = await transcriptFromPanel();

      if (!text) {
        const tracks = await tracksFromPage(id, {});
        if (!tracks.length) throw new Error("No captions on this video");
        text = await captionText(tracks);
      }
      if (!text) throw new Error("Could not read this video's transcript");

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

  // YouTube is a single-page app: navigating to the next video swaps the whole
  // metadata section without a reload. `arrivedAt` is reset on each navigation
  // so the floating fallback gets a fresh grace period every time, rather than
  // only on the first page the script happened to load into.
  let arrivedAt = performance.now();

  function ensureButton() {
    if (!videoId()) return;

    const row = findActionRow();
    const existing = document.getElementById(BTN_ID);

    if (existing) {
      const floating = existing.dataset.floating === "1";
      // Still in the live row, or floating with no row to move into: leave it.
      if (!floating ? existing.parentElement === row : !row) return;
      // Otherwise it is stranded — YouTube replaced the row under it, or a row
      // finally appeared and the floating fallback can be upgraded.
      existing.remove();
    }

    if (row) {
      const btn = makeButton(false);
      row.appendChild(btn);
      console.log("[YT Transcript] button added to the action row");
      return;
    }
    // Last resort, so there is always something clickable even if YouTube
    // reshuffles its markup again.
    if (performance.now() - arrivedAt > 4000) {
      const btn = makeButton(true);
      btn.dataset.floating = "1";
      document.body.appendChild(btn);
      console.log("[YT Transcript] action row not found — using floating button");
    }
  }

  // A plain debounce was the bug behind "it needs a reload": YouTube mutates the
  // DOM more or less continuously, every mutation pushed the deadline out again,
  // and the callback could go a whole video without firing. Cap the wait so a
  // busy page still gets checked, and keep a slow interval underneath as a floor
  // for the navigations the observer and the event both miss. Both are cheap —
  // ensureButton returns immediately once the button is in place.
  let pending;
  let deadline = 0;
  function scheduleEnsure() {
    const now = performance.now();
    if (!deadline) deadline = now + 600;

    if (now >= deadline) {
      clearTimeout(pending);
      deadline = 0;
      ensureButton();
      return;
    }
    clearTimeout(pending);
    pending = setTimeout(() => {
      deadline = 0;
      ensureButton();
    }, 200);
  }

  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function onNavigate() {
    arrivedAt = performance.now();
    scheduleEnsure();
  }
  // YouTube fires this on document; the window listener only sees it because it
  // bubbles, which is not something to rely on. Listen to both.
  document.addEventListener("yt-navigate-finish", onNavigate);
  window.addEventListener("yt-navigate-finish", onNavigate);

  setInterval(ensureButton, 2000);
  ensureButton();

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
