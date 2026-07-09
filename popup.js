document.addEventListener('DOMContentLoaded', () => {
  // -------------------------
  // Buttons
  // -------------------------
  const textExpanderBtn = document.getElementById('textExpanderBtn');
  const tyreQuoteBtn = document.getElementById('tyreQuoteBtn');
  const backBtn = document.getElementById('backBtn');
  const aboutBtn = document.getElementById('aboutBtn');
  const tccQolBtn = document.getElementById('tccQolBtn');
  const paceQolBtn = document.getElementById('paceQolBtn');
  const scAutoMessagerBtn = document.getElementById('scAutoMessagerBtn');

  // -------------------------
  // Sections
  // -------------------------
  const landingPage = document.getElementById('landingPage');
  const tyreQuoteSection = document.getElementById('tyreQuoteSection');
  const roadsideFlowSection = document.getElementById('roadsideFlowSection');
  const roadsideFlowBtn = document.getElementById('roadsideFlowBtn');
  const roadsideBackBtn = document.getElementById('roadsideBackBtn');

  function showLanding() {
    document.body.classList.remove("roadside-flow-open");
    if (landingPage) landingPage.style.display = 'flex';
    if (tyreQuoteSection) tyreQuoteSection.style.display = 'none';
    if (roadsideFlowSection) roadsideFlowSection.style.display = 'none';
  }

  function showTyreQuote() {
    document.body.classList.remove("roadside-flow-open");
    if (landingPage) landingPage.style.display = 'none';
    if (tyreQuoteSection) tyreQuoteSection.style.display = 'block';
    if (roadsideFlowSection) roadsideFlowSection.style.display = 'none';
  }

  function showRoadsideFlow() {
    document.body.classList.add("roadside-flow-open");
    if (landingPage) landingPage.style.display = 'none';
    if (tyreQuoteSection) tyreQuoteSection.style.display = 'none';
    if (roadsideFlowSection) roadsideFlowSection.style.display = 'block';
    if (window.initRoadsideFlow) window.initRoadsideFlow();
  }

  // -------------------------
  // Toggles
  // -------------------------
  const towbookToggle = document.getElementById('towbookToggle');
  const tccQolToggle = document.getElementById('tccQolToggle');
  const paceQolToggle = document.getElementById('paceQolToggle');
  const scAutoMessagerToggle = document.getElementById('scAutoMessagerToggle');
  const oceanaToggle = document.getElementById('oceanaToggle');

  function setTccQolEnabled(enabled) {
    chrome.storage.sync.set({
      tccQolEnabled: enabled,
      teamsFilter: enabled,
      auFilterEnabled: enabled
    }, () => {
      console.log(`[TCC QOL] Toggle changed to ${enabled ? 'ON' : 'OFF'}`);
    });
  }

  // -------------------------
  // Button Handlers
  // -------------------------
  if (textExpanderBtn) {
    textExpanderBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('TextExpander/expanderConfig.html'));
    });
  }

  if (tyreQuoteBtn) {
    tyreQuoteBtn.addEventListener('click', () => {
      showTyreQuote();
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      showLanding();
    });
  }

  if (roadsideFlowBtn) {
    roadsideFlowBtn.addEventListener('click', () => {
      showRoadsideFlow();
    });
  }

  if (roadsideBackBtn) {
    roadsideBackBtn.addEventListener('click', () => {
      showLanding();
    });
  }

  if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('About/about.html'));
    });
  }

  if (tccQolBtn) {
    tccQolBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('TCCImprovements/tccImprovements.html'));
    });
  }

  if (paceQolBtn) {
    paceQolBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('PACEImprovements/paceImprovements.html'));
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
    tccQolEnabled: true,
    paceQolEnabled: true,
    teamsFilter: true,
    scAutoMessagerEnabled: false,
    auFilterEnabled: true,
    oceanaNotifierEnabled: false
  }, (items) => {
    let tccQolEnabled = items.tccQolEnabled;
    if (tccQolEnabled === null || tccQolEnabled === undefined) {
      tccQolEnabled = true;
      setTccQolEnabled(true);
    }

    if (towbookToggle) towbookToggle.checked = items.towbookAudioNotifier;
    if (tccQolToggle) tccQolToggle.checked = !!tccQolEnabled;
    if (paceQolToggle) paceQolToggle.checked = items.paceQolEnabled !== false;
    if (scAutoMessagerToggle) scAutoMessagerToggle.checked = items.scAutoMessagerEnabled;
    if (oceanaToggle) oceanaToggle.checked = items.oceanaNotifierEnabled;
  });

  // -------------------------
  // Easter Egg (Logo Click 5x → run in active tab)
  // -------------------------
  const teslaLogoWrapper = document.getElementById("teslaLogoWrapper");
  let logoClickCount = 0;
  let logoClickTimer = null;

  if (teslaLogoWrapper) {
    teslaLogoWrapper.addEventListener("click", () => {
      logoClickCount++;

      teslaLogoWrapper.classList.remove("bounce");
      void teslaLogoWrapper.offsetWidth;
      teslaLogoWrapper.classList.add("bounce");

      const intensity = Math.min(1 + logoClickCount * 0.05, 1.4);
      teslaLogoWrapper.style.setProperty("--bounce-min", (0.92 / intensity).toFixed(2));
      teslaLogoWrapper.style.setProperty("--bounce-max", (1.08 * intensity).toFixed(2));

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

      clearTimeout(logoClickTimer);
      logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);
    });
  }

  // -------------------------
  // Save toggle changes to storage
  // -------------------------
  if (towbookToggle) {
    towbookToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ towbookAudioNotifier: towbookToggle.checked });
    });
  }

  if (tccQolToggle) {
    tccQolToggle.addEventListener('change', () => {
      setTccQolEnabled(tccQolToggle.checked);
    });
  }

  if (paceQolToggle) {
    paceQolToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ paceQolEnabled: paceQolToggle.checked }, () => {
        console.log(`[PACE QOL] Toggle changed to ${paceQolToggle.checked ? 'ON' : 'OFF'}`);
      });
    });
  }

  if (scAutoMessagerToggle) {
    scAutoMessagerToggle.addEventListener('change', () => {
      chrome.storage.sync.set({ scAutoMessagerEnabled: scAutoMessagerToggle.checked });
      console.log(`SC AutoMessager toggle is now ${scAutoMessagerToggle.checked ? 'ON' : 'OFF'}`);
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