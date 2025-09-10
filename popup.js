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

document.addEventListener('DOMContentLoaded', () => {
  const logo = document.getElementById('teslaLogo');
  let clickCount = 0;
  let clickTimer = null;

  // Easter Egg Settings
  const maxNumber = 50;   // maximum number of images on screen
  const images = [];
  const imageSpeed = 3;   // base speed in pixels per frame

  logo.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => clickCount = 0, 500); // reset if not fast enough

    if (clickCount === 5) {
      // send message to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["EasterEgg/easterEgg.js"]   // inject script into the page
        });
        window.close();
      });
      clickCount = 0;
    }

  });

  function triggerEasterEgg() {
    // close popup
    const popupWrapper = document.getElementById('popupWrapper');
    if (popupWrapper) popupWrapper.style.display = 'none';

    // spawn images continuously
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const animationFrameIds = [];

    function spawnImage(x, y, vx = null, vy = null, rotation = null) {
      if (images.length >= maxNumber) return;

      const img = document.createElement('img');
      img.src = chrome.runtime.getURL('EasterEgg/lol.png');
      img.style.position = 'fixed';
      img.style.left = `${x}px`;
      img.style.top = `${y}px`;
      img.style.width = '50px';
      img.style.height = '50px';
      img.style.pointerEvents = 'none';
      img.style.transformOrigin = 'center center';
      document.body.appendChild(img);

      // random direction if not provided
      const angle = Math.random() * 2 * Math.PI;
      const speedX = vx !== null ? vx : imageSpeed * Math.cos(angle);
      const speedY = vy !== null ? vy : imageSpeed * Math.sin(angle);
      const rotationSpeed = rotation !== null ? rotation : (Math.random() - 0.5) * 0.2;

      const obj = { el: img, x, y, vx: speedX, vy: speedY, rotation: 0, rotationSpeed };
      images.push(obj);
    }

    // animation loop
    function animate() {
      for (let i = images.length - 1; i >= 0; i--) {
        const obj = images[i];
        obj.x += obj.vx;
        obj.y += obj.vy;
        obj.rotation += obj.rotationSpeed;

        obj.el.style.left = `${obj.x}px`;
        obj.el.style.top = `${obj.y}px`;
        obj.el.style.transform = `rotate(${obj.rotation}rad)`;

        let bounced = false;

        // bounce on edges
        if (obj.x <= 0 || obj.x + 50 >= window.innerWidth) {
          obj.vx *= -1;
          bounced = true;
        }
        if (obj.y <= 0 || obj.y + 50 >= window.innerHeight) {
          obj.vy *= -1;
          bounced = true;
        }

        // on bounce, split if under maxNumber
        if (bounced && images.length < maxNumber) {
          spawnImage(obj.x, obj.y, obj.vx * -1, obj.vy, obj.rotationSpeed * -1);
        }
      }
      animationFrameIds.push(requestAnimationFrame(animate));
    }

    animate();

    // spawn initial batch
    for (let i = 0; i < 5; i++) {
      spawnImage(centerX, centerY);
    }

    // stop and clean up on click anywhere
    const cleanup = () => {
      animationFrameIds.forEach(id => cancelAnimationFrame(id));
      images.forEach(obj => obj.el.remove());
      images.length = 0;
      document.removeEventListener('click', cleanup);
    };

    setTimeout(() => {
      document.addEventListener('click', cleanup, { once: true });
    }, 50); // small delay to avoid instantly triggering on logo click
  }
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