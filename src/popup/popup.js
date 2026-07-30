const enabledInput = document.querySelector("#enabled");
const statusText = document.querySelector("#status");
const statusBadge = document.querySelector("#statusBadge");
const heroDescription = document.querySelector("#heroDescription");

function render(enabled) {
  enabledInput.checked = enabled;
  statusText.textContent = enabled ? "চালু আছে" : "বন্ধ আছে";
  statusBadge.textContent = enabled ? "সুরক্ষা চালু" : "সুরক্ষা বন্ধ";
  heroDescription.textContent = enabled
    ? "বিজ্ঞাপনগুলো স্বয়ংক্রিয়ভাবে hide ও skip হবে।"
    : "বিজ্ঞাপন বন্ধ করতে protection আবার চালু করুন।";
  document.body.classList.toggle("is-disabled", !enabled);
}

chrome.storage.local.get({ enabled: true }, ({ enabled }) => render(enabled));

enabledInput.addEventListener("change", () => {
  const enabled = enabledInput.checked;
  chrome.storage.local.set({ enabled });
  render(enabled);
});
