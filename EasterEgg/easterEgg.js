(() => {
  const initialMax = 50;
  const initialSpawn = 5;
  const imageSize = 50;
  const speed = 3;
  const images = [];
  const frameIds = [];

  if (window.__teslaEasterEggActive) return;
  window.__teslaEasterEggActive = true;

  let maxNumber = initialMax;
  let alwaysOn = false;
  let unlimited = false;

  // =========================
  // Control panel (button sliders)
  // =========================
  const controls = document.createElement("div");
  controls.style = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(255,255,255,0.95);
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 12px;
    color: #111;
    z-index: 1000000;
    display: flex;
    gap: 12px;
    align-items: center;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
  `;

  controls.innerHTML = `
    <div style="display:flex;align-items:center;gap:4px;position:relative;">
      <span>Always On</span>
      <button id="alwaysOnBtn" style="
        width:50px;
        height:20px;
        background:#ddd;
        border-radius:10px;
        cursor:pointer;
        position:relative;
      ">
        <span id="alwaysOnIndicator" style="
          position:absolute;
          left:2px;
          top:2px;
          width:16px;
          height:16px;
          background:#555;
          border-radius:50%;
          transition:left 0.2s;
        "></span>
      </button>
      <span id="alwaysTooltip" style="
        display:none;
        position:absolute;
        top:-28px;
        left:50%;
        transform:translateX(-50%);
        background:#333;
        color:#fff;
        padding:2px 6px;
        border-radius:4px;
        font-size:10px;
        white-space:nowrap;
        z-index:1000001;
      ">Prevent disable on button click</span>
    </div>
    <div style="display:flex;align-items:center;gap:4px;position:relative;">
      <span>Unlimited Mode</span>
      <button id="unlimitedBtn" style="
        width:50px;
        height:20px;
        background:#ddd;
        border-radius:10px;
        cursor:pointer;
        position:relative;
      ">
        <span id="unlimitedIndicator" style="
          position:absolute;
          left:2px;
          top:2px;
          width:16px;
          height:16px;
          background:#555;
          border-radius:50%;
          transition:left 0.2s;
        "></span>
      </button>
      <span id="tooltip" style="
        display:none;
        position:absolute;
        top:-28px;
        left:50%;
        transform:translateX(-50%);
        background:#333;
        color:#fff;
        padding:2px 6px;
        border-radius:4px;
        font-size:10px;
        white-space:nowrap;
        z-index:1000001;
      ">⚠️ Warning: May crash your window</span>
    </div>
  `;

  document.body.appendChild(controls);


  const alwaysBtn = document.getElementById("alwaysOnBtn");
  const alwaysInd = document.getElementById("alwaysOnIndicator");
  const unlimitedBtn = document.getElementById("unlimitedBtn");
  const unlimitedInd = document.getElementById("unlimitedIndicator");
  const tooltip = document.getElementById("tooltip");
  const alwaysTooltip = document.getElementById("alwaysTooltip");

  alwaysBtn.addEventListener("click", () => {
    alwaysOn = !alwaysOn;
    alwaysInd.style.left = alwaysOn ? "32px" : "2px";
  });
  alwaysBtn.addEventListener("mouseenter", () => alwaysTooltip.style.display = "block");
  alwaysBtn.addEventListener("mouseleave", () => alwaysTooltip.style.display = "none");

  unlimitedBtn.addEventListener("click", () => {
    unlimited = !unlimited;
    unlimitedInd.style.left = unlimited ? "32px" : "2px";

    if (!unlimited && images.length > initialMax) {
      const extras = images.splice(initialMax);
      extras.forEach(obj => obj.el.remove());
    }
  })
  unlimitedBtn.addEventListener("mouseenter", () => tooltip.style.display = "block");
  unlimitedBtn.addEventListener("mouseleave", () => tooltip.style.display = "none");

  // =========================
  // Close popup if exists
  // =========================
  const popup = document.getElementById('popupWrapper');
  if (popup) popup.style.display = 'none';

  // =========================
  // Spawn image
  // =========================
  function spawnImage(x, y, vx = null, vy = null, rotationSpeed = null) {
  if (!unlimited && images.length >= initialMax) return;

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('EasterEgg/lol.png');
    img.style.position = 'fixed';
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    img.style.width = `${imageSize}px`;
    img.style.height = 'auto';
    img.style.pointerEvents = 'none';
    img.style.zIndex = 999999;
    img.style.transformOrigin = 'center center';
    document.body.appendChild(img);

    const angle = vx === null || vy === null ? Math.random() * 2 * Math.PI : null;

    images.push({
      el: img,
      x,
      y,
      prevX: x,
      prevY: y,
      vx: vx !== null ? vx : speed * Math.cos(angle),
      vy: vy !== null ? vy : speed * Math.sin(angle),
      rotation: 0,
      rotationSpeed: rotationSpeed !== null ? rotationSpeed : (Math.random() - 0.5) * 0.05
    });
  }

  // =========================
  // Animate
  // =========================
  let lastLog = 0;
  const logInterval = 1000;

  function animate() {
    for (let i = images.length - 1; i >= 0; i--) {
      const obj = images[i];
      obj.prevX = obj.x;
      obj.prevY = obj.y;
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.rotation += obj.rotationSpeed;

      obj.el.style.left = `${obj.x}px`;
      obj.el.style.top = `${obj.y}px`;
      obj.el.style.transform = `rotate(${obj.rotation}rad)`;

      let bounced = false;

      // Check walls and bounce
      if (obj.x <= 0) { obj.x = 0; obj.vx *= -1; if (obj.prevX > 0) bounced = true; }
      if (obj.x + imageSize >= window.innerWidth) { obj.x = window.innerWidth - imageSize; obj.vx *= -1; if (obj.prevX + imageSize < window.innerWidth) bounced = true; }
      if (obj.y <= 0) { obj.y = 0; obj.vy *= -1; if (obj.prevY > 0) bounced = true; }
      if (obj.y + imageSize >= window.innerHeight) { obj.y = window.innerHeight - imageSize; obj.vy *= -1; if (obj.prevY + imageSize < window.innerHeight) bounced = true; }

      // Spawn clone on bounce
      if (bounced) {
        const offsetAngle = (Math.random() - 0.5) * 0.5;
        const speedFactor = 0.8 + Math.random() * 0.4;
        const newVx = (obj.vx * Math.cos(offsetAngle) - obj.vy * Math.sin(offsetAngle)) * speedFactor;
        const newVy = (obj.vx * Math.sin(offsetAngle) + obj.vy * Math.cos(offsetAngle)) * speedFactor;
        const newRotationSpeed = obj.rotationSpeed * (Math.random() * 1.2 + 0.8);

        // Only spawn if not exceeding limit (unless unlimited)
        if (unlimited || images.length < initialMax) {
          spawnImage(obj.x, obj.y, newVx, newVy, newRotationSpeed);
        }
      }
    }

    // Throttle console logging
    const now = performance.now();
    if (now - lastLog > logInterval) {
      console.log("Images on screen:", images.length);
      lastLog = now;
    }

    frameIds.push(requestAnimationFrame(animate));
  }

  // =========================
  // Initial spawn
  // =========================
  const margin = 60;
  for (let i = 0; i < initialSpawn; i++) {
    const spawnX = margin + Math.random() * (window.innerWidth - 2 * margin - imageSize);
    const spawnY = margin + Math.random() * (window.innerHeight - 2 * margin - imageSize);
    const angle = Math.random() * 2 * Math.PI;
    spawnImage(spawnX, spawnY, speed * Math.cos(angle), speed * Math.sin(angle));
  }

  animate();

  // =========================
  // Cleanup (respects alwaysOn & ignores clicks on control panel)
  // =========================
  const cleanup = (e) => {
    if (alwaysOn) return; // do nothing if Always On is active
    if (controls.contains(e.target)) return; // ignore clicks on control panel

    frameIds.forEach(id => cancelAnimationFrame(id));
    images.forEach(obj => obj.el.remove());
    images.length = 0;
    controls.remove();
    window.__teslaEasterEggActive = false;
    document.removeEventListener('click', cleanup);
  };

  document.addEventListener('click', cleanup);

})();
