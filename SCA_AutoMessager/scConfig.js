document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#scConfigTable tbody');
  const searchInput = document.querySelector('#searchInput');
  let tableData = [];

  // Load CSV
  fetch('scConfig.csv')
    .then(res => res.text())
    .then(csvText => {
      const lines = csvText.trim().split('\n');
      lines.forEach((line, i) => {
        if (i === 0) return; // skip header
        const [serviceCenter, link, instructions] = line.split(',').map(f =>
            f ? f.trim().replace(/^"|"$/g, '') : ''
        );
        tableData.push({ serviceCenter, link, instructions });
        });
      renderTable(tableData);
    })
    .catch(err => console.error('Error loading SC config CSV:', err));

  // Render table rows
  function renderTable(data) {
    tableBody.innerHTML = '';
    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.serviceCenter || ''}</td>
        <td>${row.link ? `<a href="${row.link}" target="_blank">${row.link}</a>` : ''}</td>
        <td>${row.instructions || ''}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Filter table on search
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return renderTable(tableData);
    const filtered = tableData.filter(row =>
      row.serviceCenter.toLowerCase().includes(query)
    );
    renderTable(filtered);
  });
});
