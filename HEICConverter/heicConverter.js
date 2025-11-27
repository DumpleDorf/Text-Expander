import { heicTo, isHeic } from './heic-to.js';

/* ============================================================
   ELEMENTS
============================================================ */
const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const output = document.getElementById('output');
const pdfProgressContainer = document.getElementById('pdfProgressContainer');
const pdfProgressCircle = pdfProgressContainer.querySelector('.circle');
const pdfProgressText = document.getElementById('pdfProgressText');
const previewImg = document.getElementById('pdfPreviewImg');
const PDF_ICON = 'pdfIcon.png';

/* ============================================================
   PDF SIZE LIMIT CONFIG
============================================================ */
const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB
const START_QUALITY = 0.8;
const MIN_QUALITY = 0.35;
const START_WIDTH = 1400;
const MIN_WIDTH = 900;

/* ============================================================
   PDF PROGRESS HELPERS
============================================================ */
function initPdfProgress() {
  if (!pdfProgressCircle) return;
  const length = pdfProgressCircle.getTotalLength();
  pdfProgressCircle.style.strokeDasharray = length;
  pdfProgressCircle.style.strokeDashoffset = length;
}

function setProgress(percent) {
  if (!pdfProgressCircle) return;
  const length = pdfProgressCircle.getTotalLength();
  pdfProgressCircle.style.strokeDashoffset =
    length - (percent / 100) * length;
  if (pdfProgressText) pdfProgressText.innerText = `${Math.round(percent)}%`;
}

/* ============================================================
   ADAPTIVE IMAGE COMPRESSION
============================================================ */
async function compressImageAdaptive(file, maxWidth, quality) {
  return new Promise(async resolve => {
    let blob = file;

    if (await isHeic(file)) {
      blob = await heicTo({ blob: file, type: 'image/jpeg', quality });
    }

    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        b => resolve(b),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => resolve(blob);
    img.src = URL.createObjectURL(blob);
  });
}

/* ============================================================
   PDF CONVERT / MERGE (UNDER 5MB)
============================================================ */
convertBtn.addEventListener('click', async () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return alert('Please select some files first.');

  convertBtn.disabled = true;
  pdfProgressContainer.style.display = 'block';
  previewImg.style.display = 'none';
  output.style.display = 'none';
  output.innerHTML = '';

  initPdfProgress();
  setProgress(0);

  let firstImageBlob = null;

  try {
    let quality = START_QUALITY;
    let maxWidth = START_WIDTH;
    let pdfBlob;
    let pdfBytes;

    while (true) {
      const pdfDoc = await PDFLib.PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        /* ----- Existing PDFs ----- */
        if (file.type === 'application/pdf') {
          const existingPdf = await PDFLib.PDFDocument.load(await file.arrayBuffer());
          const pages = await pdfDoc.copyPages(
            existingPdf,
            existingPdf.getPageIndices()
          );
          pages.forEach(p => pdfDoc.addPage(p));
          continue;
        }

        /* ----- Images / HEIC ----- */
        if (!(file.type.startsWith('image/') || await isHeic(file))) continue;

        const imgBlob = await compressImageAdaptive(file, maxWidth, quality);
        if (!firstImageBlob) firstImageBlob = imgBlob;

        const imgBytes = await imgBlob.arrayBuffer();
        const image = await pdfDoc.embedJpg(imgBytes);
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });

        setProgress(((i + 1) / files.length) * 100);
        await new Promise(r => setTimeout(r, 25));
      }

      pdfBytes = await pdfDoc.save();
      pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (pdfBlob.size <= MAX_PDF_BYTES) break;

      quality -= 0.1;
      maxWidth -= 200;

      if (quality < MIN_QUALITY || maxWidth < MIN_WIDTH) break;
    }

    const sizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
    const url = URL.createObjectURL(pdfBlob);

    output.style.display = 'block';
    output.innerHTML = `
      <p>✅ PDF created (${sizeMB} MB)</p>
      <a href="${url}" download="combined.pdf">Download PDF</a>
    `;

    if (pdfBlob.size > MAX_PDF_BYTES) {
      output.innerHTML += `
        <p style="color:orange;">
          ⚠️ Could not compress under 5 MB. Try fewer images or lower resolution.
        </p>
      `;
    }

    previewImg.src = firstImageBlob
      ? URL.createObjectURL(firstImageBlob)
      : PDF_ICON;

  } catch (err) {
    console.error('[ERROR]', err);
    output.style.display = 'block';
    output.innerHTML = `<p style="color:red;">${err.message}</p>`;
    previewImg.src = PDF_ICON;
  } finally {
    pdfProgressContainer.style.display = 'none';
    previewImg.style.display = 'block';
    convertBtn.disabled = false;
  }
});

/* ============================================================
   HEIC → JPEG TOOL
============================================================ */
const heicFileInput = document.getElementById('heicFileInput');
const heicConvertBtn = document.getElementById('heicConvertBtn');
const heicOutput = document.getElementById('heicOutput');
const heicPreviewImg = document.getElementById('heicPreviewImg');
const heicProgressContainer = document.getElementById('heicProgressContainer');
const heicProgressCircle = heicProgressContainer.querySelector('.circle');
const heicProgressText = document.getElementById('heicProgressText');

function setHeicProgress(percent) {
  if (!heicProgressCircle) return;
  const length = heicProgressCircle.getTotalLength();
  heicProgressCircle.style.strokeDashoffset =
    length - (percent / 100) * length;
  heicProgressText.innerText = `${Math.round(percent)}%`;
}

/* ============================================================
   HEIC CONVERT
============================================================ */
heicConvertBtn.addEventListener('click', async () => {
  const files = Array.from(heicFileInput.files);
  if (!files.length) return alert('Please select HEIC files.');

  heicConvertBtn.disabled = true;
  heicOutput.innerHTML = '<p>Processing files...</p>';
  heicOutput.style.display = 'block';
  heicPreviewImg.style.display = 'none';
  heicProgressContainer.style.display = 'block';
  setHeicProgress(0);

  const convertedBlobs = [];
  let firstBlob = null;
  let totalBytes = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (!(await isHeic(file))) {
      heicOutput.innerHTML += `<p style="color:orange;">${file.name} skipped</p>`;
      setHeicProgress(((i + 1) / files.length) * 100);
      continue;
    }

    try {
      const jpgBlob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
      const safeBlob = jpgBlob instanceof Blob
        ? jpgBlob
        : new Blob([jpgBlob], { type: 'image/jpeg' });

      convertedBlobs.push({
        blob: safeBlob,
        name: file.name.replace(/\.heic$/i, '.jpg')
      });

      if (!firstBlob) firstBlob = safeBlob;
      totalBytes += safeBlob.size;

      const sizeMB = (safeBlob.size / (1024 * 1024)).toFixed(2);
      const url = URL.createObjectURL(safeBlob);

      heicOutput.innerHTML += `
        <p>${file.name} → 
        <a href="${url}" download="${file.name.replace(/\.heic$/i, '.jpg')}">
          Download JPEG
        </a> (${sizeMB} MB)</p>`;
    } catch (err) {
      heicOutput.innerHTML += `<p style="color:red;">${file.name} failed</p>`;
    }

    setHeicProgress(((i + 1) / files.length) * 100);
    await new Promise(r => setTimeout(r, 25));
  }

  heicProgressContainer.style.display = 'none';

  if (firstBlob) {
    heicPreviewImg.src = URL.createObjectURL(firstBlob);
    heicPreviewImg.style.display = 'block';
  }

  if (convertedBlobs.length) {
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    heicOutput.innerHTML += `<p>✅ ${convertedBlobs.length} file(s) (${totalMB} MB)</p>`;

    const downloadAll = document.createElement('a');
    downloadAll.href = '#';
    downloadAll.textContent = 'Download All';
    downloadAll.onclick = e => {
      e.preventDefault();
      convertedBlobs.forEach(f => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(f.blob);
        a.download = f.name;
        a.click();
      });
    };

    heicOutput.appendChild(downloadAll);
  }

  heicConvertBtn.disabled = false;
});