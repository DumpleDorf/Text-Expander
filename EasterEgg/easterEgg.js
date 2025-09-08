(() => {
  const maxNumber = 50;
  const initialSpawn = 5;
  const imageSize = 50;
  const speed = 3;
  const images = [];
  const frameIds = [];

  if (window.__teslaEasterEggActive) return;
  window.__teslaEasterEggActive = true;

  const centerX = window.innerWidth / 2 - imageSize / 2;
  const centerY = window.innerHeight / 2 - imageSize / 2;

  // Close popup if exists
  const popup = document.getElementById('popupWrapper');
  if (popup) popup.style.display = 'none';

  function spawnImage(x, y, vx = null, vy = null, rotationSpeed = null) {
    if (images.length >= maxNumber) return;

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
      rotationSpeed: rotationSpeed !== null ? rotationSpeed : (Math.random() - 0.5) * 0.1 // slower
    });
  }

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

      // LEFT wall
      if (obj.x <= 0) {
        obj.x = 0;
        obj.vx *= -1;
        if (obj.prevX > 0) bounced = true;
      }

      // RIGHT wall
      if (obj.x + imageSize >= window.innerWidth) {
        obj.x = window.innerWidth - imageSize;
        obj.vx *= -1;
        if (obj.prevX + imageSize < window.innerWidth) bounced = true;
      }

      // TOP wall
      if (obj.y <= 0) {
        obj.y = 0;
        obj.vy *= -1;
        if (obj.prevY > 0) bounced = true;
      }

      // BOTTOM wall
      if (obj.y + imageSize >= window.innerHeight) {
        obj.y = window.innerHeight - imageSize;
        obj.vy *= -1;
        if (obj.prevY + imageSize < window.innerHeight) bounced = true;
      }

      // On bounce, spawn a clone with slight random offset
      if (bounced && images.length < maxNumber) {
        const offsetAngle = (Math.random() - 0.5) * 0.5; // small random rotation
        const speedFactor = 0.8 + Math.random() * 0.4;   // random factor 0.8 - 1.2

        const newVx = (obj.vx * Math.cos(offsetAngle) - obj.vy * Math.sin(offsetAngle)) * speedFactor;
        const newVy = (obj.vx * Math.sin(offsetAngle) + obj.vy * Math.cos(offsetAngle)) * speedFactor;
        const newRotationSpeed = obj.rotationSpeed * (Math.random() * 1.2 + 0.8);

        spawnImage(obj.x, obj.y, newVx, newVy, newRotationSpeed);
      }
    }

    frameIds.push(requestAnimationFrame(animate));
  }

  // Spawn initial images randomly across the screen
  for (let i = 0; i < initialSpawn; i++) {
    const margin = 60;
    const spawnX = margin + Math.random() * (window.innerWidth - 2 * margin - imageSize);
    const spawnY = margin + Math.random() * (window.innerHeight - 2 * margin - imageSize);

    const angle = Math.random() * 2 * Math.PI;

    spawnImage(spawnX, spawnY, speed * Math.cos(angle), speed * Math.sin(angle));
  }

  animate();

  // Cleanup on click
  const cleanup = () => {
    frameIds.forEach(id => cancelAnimationFrame(id));
    images.forEach(obj => obj.el.remove());
    images.length = 0;
    document.removeEventListener('click', cleanup);
    window.__teslaEasterEggActive = false;
  };

  setTimeout(() => {
    document.addEventListener('click', cleanup, { once: true });
  }, 200);
})();
