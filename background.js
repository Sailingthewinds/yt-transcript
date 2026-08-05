// Triggers the copy from outside the page.
//
// A keydown listener inside the page can be starved — macOS or another app can
// claim the combo, or focus can sit in DevTools or the address bar. These two
// paths (toolbar click, browser-registered shortcut) can't be.

async function grab(tab) {
  if (!tab?.id) {
    console.warn("[YT Transcript] no active tab");
    return;
  }
  console.log("[YT Transcript] triggered on tab", tab.id, tab.url || "(url hidden)");

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "grab" });
    return;
  } catch {
    // No content script yet — the tab predates the install or the last reload.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    await chrome.tabs.sendMessage(tab.id, { type: "grab" });
  } catch (e) {
    // Almost always "not a YouTube tab", which needs no user-facing noise.
    console.warn("[YT Transcript] could not reach this tab:", e.message);
  }
}

// Content scripts only auto-inject into pages loaded after an install or
// reload, which would leave every already-open YouTube tab without a button.
// Inject into all of them up front so nothing needs a manual refresh.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ["*://www.youtube.com/*", "*://m.youtube.com/*"] });
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch {
      // Discarded or otherwise unreachable tab — it'll inject on next load.
    }
  }
  console.log(`[YT Transcript] injected into ${tabs.length} open YouTube tab(s)`);
});

chrome.action.onClicked.addListener(grab);

chrome.commands.onCommand.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  grab(tab);
});
