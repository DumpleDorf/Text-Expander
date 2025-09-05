document.addEventListener('DOMContentLoaded', () => {
  const menuItems = document.querySelectorAll('.menu-item');
  const indicator = document.querySelector('.menu-indicator');

  function moveIndicator(el) {
    const menuBar = el.parentElement;   // ul inside menu-bar
    const barPadding = 12;              // same as CSS padding-left/right
    const itemWidth = el.offsetWidth;
    const leftOffset = el.offsetLeft + barPadding;  // add padding offset

    indicator.style.width = `${itemWidth}px`;
    indicator.style.transform = `translateX(${leftOffset}px)`;
}


  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      moveIndicator(item);

      // Show the correct section
      document.querySelectorAll('.about-section').forEach(sec => {
        sec.style.display = sec.id === item.dataset.section ? 'block' : 'none';
      });
    });
  });

  // Initialize
  const activeItem = document.querySelector('.menu-item.active');
  if (activeItem) moveIndicator(activeItem);

  window.addEventListener('resize', () => {
    const activeItem = document.querySelector('.menu-item.active');
    if (activeItem) moveIndicator(activeItem);
  });
});
