const status = document.getElementById('status');

chrome.storage.sync.get(DEFAULTS, (opts) => {
  for (const [key, value] of Object.entries(opts)) {
    const el = document.getElementById(key);
    el[el.type === 'checkbox' ? 'checked' : 'value'] = value;
    // Auto-save on every change; no Save button needed.
    el.addEventListener(el.type === 'text' ? 'input' : 'change', () => {
      chrome.storage.sync.set({ [key]: el.type === 'checkbox' ? el.checked : el.value }, () => {
        status.textContent = 'Saved';
        setTimeout(() => (status.textContent = ''), 1000);
      });
    });
  }
});

// chrome:// links can't be opened from a normal <a>.
document.getElementById('shortcuts').onclick = (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
};
