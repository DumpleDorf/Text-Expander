window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const openHeic = urlParams.get('openHeic') === 'true';

  // Sections
  const pdfSection = document.getElementById('converterSection');
  const aboutSection = document.getElementById('aboutSection');
  const heicSection = document.getElementById('heicToJpgSection');
  const menuItems = document.querySelectorAll('.menu-item');
  const indicator = document.querySelector('.menu-indicator');
  const mainH1 = document.querySelector('h1');

  // Hide all sections initially
  if (pdfSection) pdfSection.style.display = 'none';
  if (heicSection) heicSection.style.display = 'none';
  if (aboutSection) aboutSection.style.display = 'none';

  // Determine which section to show first
  let initialSection = 'converter'; // default
  if (openHeic) initialSection = 'heic-to-jpg';

  // Function to show section and update menu/title
  function showSection(sectionName) {
    pdfSection.style.display = 'none';
    heicSection.style.display = 'none';
    aboutSection.style.display = 'none';

    if (sectionName === 'converter') {
      pdfSection.style.display = 'flex';
      mainH1.innerText = "PDF Document Generator";
      document.title = "PDF Document Generator";
    } else if (sectionName === 'heic-to-jpg') {
      heicSection.style.display = 'flex';
      mainH1.innerText = "HEIC to JPEG Converter";
      document.title = "HEIC to JPEG Converter";
    } else if (sectionName === 'about') {
      aboutSection.style.display = 'block';
      mainH1.innerText = "About this tool";
      document.title = "About PDF & HEIC Tool";
    }
  }

  // Move indicator
  function moveIndicator(element) {
    const menuBar = document.querySelector('.menu-bar');
    const itemWidth = element.offsetWidth;
    const leftOffset = element.getBoundingClientRect().left - menuBar.getBoundingClientRect().left;
    indicator.style.width = `${itemWidth}px`;
    indicator.style.transform = `translateX(${leftOffset}px)`;
  }

  // Initialize menu active state
  menuItems.forEach(item => item.classList.remove('active'));
  if (initialSection === 'heic-to-jpg') {
    const heicItem = document.querySelector('.menu-item[data-section="heic-to-jpg"]');
    if (heicItem) heicItem.classList.add('active');
  } else if (initialSection === 'converter') {
    const converterItem = document.querySelector('.menu-item[data-section="converter"]');
    if (converterItem) converterItem.classList.add('active');
  }

  // Show initial section
  showSection(initialSection);

  // Move indicator to active
  const activeItem = document.querySelector('.menu-item.active');
  if (activeItem) moveIndicator(activeItem);

  // Handle menu clicks
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      moveIndicator(item);
      showSection(item.dataset.section);
    });
  });

  // Adjust indicator on resize
  window.addEventListener('resize', () => {
    const activeItem = document.querySelector('.menu-item.active');
    if (activeItem) moveIndicator(activeItem);
  });
});
