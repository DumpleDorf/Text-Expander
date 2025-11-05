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
  const rsDashboardAUBtn = document.getElementById('auFilterText');

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
  const auFilterToggle = document.getElementById('auFilterToggle');
  const oceanaToggle = document.getElementById('oceanaToggle');

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
      landingPage.classList.add('slide-left');      // move landing page left
      tyreQuoteSection.classList.add('slide-in');   // slide tyre quote in
    });
  }

  if (backBtn && landingPage && tyreQuoteSection) {
    backBtn.addEventListener('click', () => {
      landingPage.classList.remove('slide-left');   // bring landing page back
      tyreQuoteSection.classList.remove('slide-in'); // move tyre quote back out
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

  if (rsDashboardAUBtn) {
    rsDashboardAUBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('RoadsideDashboardFilter/dashboardFilter.html'));
    });
  }

  // -------------------------
  // Easter Egg (Logo Click 5x → run in active tab)
  // -------------------------
  const teslaLogoWrapper = document.getElementById("teslaLogoWrapper");
  let logoClickCount = 0;
  let logoClickTimer = null;

  if (teslaLogoWrapper) {
    teslaLogoWrapper.addEventListener("click", () => {
      logoClickCount++;

      // Reset animation if mid-bounce
      teslaLogoWrapper.classList.remove("bounce");
      void teslaLogoWrapper.offsetWidth; // force reflow
      teslaLogoWrapper.classList.add("bounce");

      // Increase bounce intensity with clicks (but cap it)
      const intensity = Math.min(1 + logoClickCount * 0.05, 1.4);
      teslaLogoWrapper.style.setProperty("--bounce-min", (0.92 / intensity).toFixed(2));
      teslaLogoWrapper.style.setProperty("--bounce-max", (1.08 * intensity).toFixed(2));

      // Easter Egg trigger (5 clicks)
      if (logoClickCount === 5) {
        console.log("[Easter Egg] Activated!");
        logoClickCount = 0;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ["EasterEgg/easterEgg.js"]
            }, () => {
              if (chrome.runtime.lastError) {
                console.error("Easter Egg injection failed:", chrome.runtime.lastError);
              } else {
                console.log("[Easter Egg] Script injected!");
                window.close();
              }
            });
          }
        });
      }

      // Reset click intensity after 2s
      clearTimeout(logoClickTimer);
      logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);
    });
  }

  // -------------------------
  // Load toggle states from storage
  // -------------------------
  chrome.storage.sync.get({
    towbookAudioNotifier: false,
    teamsFilter: false,
    scAutoMessagerEnabled: false,
    auFilterEnabled: false,
    oceanaNotifierEnabled: false    // <-- new
  }, (items) => {
    if (towbookToggle) towbookToggle.checked = items.towbookAudioNotifier;
    if (teamsToggle) teamsToggle.checked = items.teamsFilter;
    if (scAutoMessagerToggle) scAutoMessagerToggle.checked = items.scAutoMessagerEnabled;
    if (auFilterToggle) auFilterToggle.checked = items.auFilterEnabled;
    if (oceanaToggle) oceanaToggle.checked = items.oceanaNotifierEnabled;
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

  if (auFilterToggle) {
    auFilterToggle.addEventListener('change', () => {
      const enabled = auFilterToggle.checked;
      chrome.storage.sync.set({ auFilterEnabled: enabled }, () => {
        console.log(`[AU Filter] Toggle changed to ${enabled ? 'ON' : 'OFF'}`);
      });
    });
  }

  if (oceanaToggle) {
    oceanaToggle.addEventListener('change', () => {
      const enabled = oceanaToggle.checked;
      chrome.storage.sync.set({ oceanaNotifierEnabled: enabled }, () => {
        console.log(`[Oceana Notifier] Toggle changed to ${enabled ? 'ON' : 'OFF'}`);
      });
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

const pdfGeneratorBtn = document.getElementById('pdfGeneratorBtn');

if (pdfGeneratorBtn) {
  pdfGeneratorBtn.addEventListener('click', () => {
    window.open(chrome.runtime.getURL('HEICConverter/heicConverter.html'));
  });
}

document.getElementById('openHeicPageBtn').addEventListener('click', () => {
  const heicPageUrl = chrome.runtime.getURL('HEICConverter/heicConverter.html?openHeic=true');
  window.open(heicPageUrl, '_blank');
});