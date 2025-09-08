document.addEventListener('DOMContentLoaded', () => {
  // -------------------------
  // Buttons
  // -------------------------
  const textExpanderBtn = document.getElementById('textExpanderBtn');
  const tyreQuoteBtn = document.getElementById('tyreQuoteBtn');
  const backBtn = document.getElementById('backBtn');
  const aboutBtn = document.getElementById('aboutBtn');
  const teamsFilterBtn = document.getElementById('teamsFilterBtn');
  const scAutoMessagerBtn = document.getElementById('scAutoMessagerBtn');

  // -------------------------
  // Sections
  // -------------------------
  const landingPage = document.getElementById('landingPage');
  const tyreQuoteSection = document.getElementById('tyreQuoteSection');

  // -------------------------
  // Toggles
  // -------------------------
  const towbookToggle = document.getElementById('towbookToggle');
  const teamsToggle = document.getElementById('teamsToggle');
  const scAutoMessagerToggle = document.getElementById('scAutoMessagerToggle');

  // -------------------------
  // Button Handlers
  // -------------------------
  if (textExpanderBtn) {
    textExpanderBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('TextExpander/expanderConfig.html'));
    });
  }

  if (tyreQuoteBtn && landingPage && tyreQuoteSection) {
    tyreQuoteBtn.addEventListener('click', () => {
      // Show Tyre Quote Section
      landingPage.style.display = 'none';
      tyreQuoteSection.style.display = 'block';
    });
  }

  if (backBtn && landingPage && tyreQuoteSection) {
    backBtn.addEventListener('click', () => {
      // Hide Tyre Quote Section
      tyreQuoteSection.style.display = 'none';
      // Show landing page instantly
      landingPage.style.display = 'flex';
      // Do NOT re-add the 'open' class — keeps sections visible
    });
  }

  if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('About/about.html'));
    });
  }

  if (teamsFilterBtn) {
    teamsFilterBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('TeamsDropdownFilter/teamsFilter.html'));
    });
  }

  if (scAutoMessagerBtn) {
    scAutoMessagerBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('SCA_AutoMessager/scConfig.html'));
    });
  }

  // -------------------------
  // Load toggle states from storage
  // -------------------------
  chrome.storage.sync.get({
    towbookAudioNotifier: false,
    teamsFilter: false,
    scAutoMessagerEnabled: false
  }, (items) => {
    if (towbookToggle) towbookToggle.checked = items.towbookAudioNotifier;
    if (teamsToggle) teamsToggle.checked = items.teamsFilter;
    if (scAutoMessagerToggle) scAutoMessagerToggle.checked = items.scAutoMessagerEnabled;
  });

  // -------------------------
  // Save toggle changes to storage
  // -------------------------
  if (towbookToggle) {
    towbookToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ towbookAudioNotifier: towbookToggle.checked });
    });
  }

  if (teamsToggle) {
    teamsToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ teamsFilter: teamsToggle.checked });
    });
  }

  if (scAutoMessagerToggle) {
    scAutoMessagerToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ scAutoMessagerEnabled: scAutoMessagerToggle.checked });
      console.log(`SC AutoMessager toggle is now ${scAutoMessagerToggle.checked ? 'ON' : 'OFF'}`);
    });
  }

  // -------------------------
  // Landing page animation
  // -------------------------
  // Play animation only once when popup opens
  setTimeout(() => {
    landingPage.classList.add('open');
  }, 50);
});
