document.addEventListener('DOMContentLoaded', () => {
  const landingPage = document.getElementById('landingPage');
  const tireQuoteSection = document.getElementById('tireQuoteSection');
  const backBtn = document.getElementById('backBtn');

  const towbookToggle = document.getElementById('towbookToggle');
  const towbookToggleWrapper = document.getElementById('towbookToggleWrapper');

  const teamsToggle = document.getElementById('teamsToggle');
  const teamsToggleWrapper = document.getElementById('teamsToggleWrapper');

  // Text Expander button
  document.getElementById('textExpanderBtn').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      window.open(chrome.runtime.getURL('TextExpander/expanderConfig.html'));
    }
  });

  // Tyre Quote button
  document.getElementById('tireQuoteBtn').addEventListener('click', () => {
    landingPage.style.display = 'none';
    tireQuoteSection.style.display = 'block';
  });

  // Back button for tire quote section
  backBtn.addEventListener('click', () => {
    tireQuoteSection.style.display = 'none';
    landingPage.style.display = 'flex';
  });

  // Load both toggles settings on popup open
  chrome.storage.sync.get(
    { towbookAudioNotifier: false, teamsFilter: false },
    (items) => {
      towbookToggle.checked = items.towbookAudioNotifier;
      towbookToggleWrapper.classList.add('visible');
      console.log(`Towbook Audio Notifier is ${items.towbookAudioNotifier ? 'enabled' : 'disabled'} on load.`);

      teamsToggle.checked = items.teamsFilter;
      teamsToggleWrapper.classList.add('visible');
      console.log(`Teams Filter is ${items.teamsFilter ? 'enabled' : 'disabled'} on load.`);
    }
  );

  // Save toggle changes immediately
  towbookToggle.addEventListener('change', () => {
    const enabled = towbookToggle.checked;
    console.log(`Towbook Audio Notifier ${enabled ? 'enabled' : 'disabled'}.`);
    chrome.storage.sync.set({ towbookAudioNotifier: enabled }, () => {
      console.log('Towbook Audio Notifier setting saved.');
    });
  });

  teamsToggle.addEventListener('change', () => {
    const enabled = teamsToggle.checked;
    console.log(`Teams Filter ${enabled ? 'enabled' : 'disabled'}.`);
    chrome.storage.sync.set({ teamsFilter: enabled }, () => {
      console.log('Teams Filter setting saved.');
    });
  });
});
