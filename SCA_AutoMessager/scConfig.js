document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#scConfigTable tbody');
  const searchInput = document.querySelector('#searchInput');
  let tableData = [];

  // -------------------------
  // CSV parser (handles commas in quotes)
  // -------------------------
  function parseCSVLine(line) {
    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    const result = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      let value = match[1];
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      result.push(value.trim());
    }
    return result;
  }

  // -------------------------
  // Load CSV
  // -------------------------
  fetch('scConfig.csv')
    .then(res => res.text())
    .then(csvText => {
      const lines = csvText.trim().split('\n');
      lines.forEach((line, i) => {
        if (i === 0) return; // skip header
        const [serviceCenter, link, instructions, image] = parseCSVLine(line);
        tableData.push({ serviceCenter, link, instructions, image });
      });
      renderTable(tableData);
    })
    .catch(err => console.error('Error loading SC config CSV:', err));

  function renderTable(data){
    tableBody.innerHTML = '';
    data.forEach(row => {
      const imgHTML = row.image
      ? `<img src="${chrome.runtime.getURL('SCA_AutoMessager/SC_Images/' + row.image)}">`
      : '';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.serviceCenter || ''}</td>
        <td>${row.link ? `<a href="${row.link}" target="_blank">${row.link}</a>` : ''}</td>
        <td>${row.instructions || ''}</td>
        <td>${imgHTML}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    renderTable(query ? tableData.filter(r => r.serviceCenter.toLowerCase().includes(query)) : tableData);
  });

  // -------------------------
  // Menu switching with dynamic slider
  // -------------------------
  const menuItems = document.querySelectorAll('.menu-item');
  const indicator = document.querySelector('.menu-indicator');
  const aboutSectionWrapper = document.getElementById('aboutSectionWrapper');
  const configSection = document.getElementById('configSection');

  function moveIndicator(element) {
      const itemWidth = element.offsetWidth;
      const menuBar = document.querySelector('.menu-bar');
      const leftOffset = element.getBoundingClientRect().left - menuBar.getBoundingClientRect().left;
      indicator.style.width = `${itemWidth}px`;
      indicator.style.transform = `translateX(${leftOffset}px)`;
  }

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      moveIndicator(item);
      aboutSectionWrapper.style.display = item.dataset.section === 'about' ? 'block' : 'none';
      configSection.style.display = item.dataset.section === 'config' ? 'block' : 'none';
    });
  });

  const activeItem = document.querySelector('.menu-item.active');
  if (activeItem) moveIndicator(activeItem);

  window.addEventListener('resize', () => {
    const activeItem = document.querySelector('.menu-item.active');
    if (activeItem) moveIndicator(activeItem);
  });
});
