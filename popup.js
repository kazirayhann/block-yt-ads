const DEFAULTS = {
  enabled: true,
  hidePromotedContent: true,
  autoSkip: true,
  fastForwardVideoAds: true
};

const controls = Object.fromEntries(
  Object.keys(DEFAULTS).map((key) => [key, document.getElementById(key)])
);
const options = document.getElementById("options");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

function updateStatus(enabled) {
  options.classList.toggle("disabled", !enabled);
  statusDot.classList.toggle("active", enabled);
  statusText.textContent = enabled ? "YouTube protection active" : "Protection paused";
}

chrome.storage.sync.get(DEFAULTS, (settings) => {
  for (const [key, control] of Object.entries(controls)) {
    control.checked = settings[key];
  }
  updateStatus(settings.enabled);
});

for (const [key, control] of Object.entries(controls)) {
  control.addEventListener("change", () => {
    chrome.storage.sync.set({ [key]: control.checked });
    if (key === "enabled") updateStatus(control.checked);
  });
}
