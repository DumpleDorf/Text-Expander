import { heicTo, isHeic } from './heic-to.js';

const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const output = document.getElementById('output');
const pdfProgressContainer = document.getElementById('pdfProgressContainer');
const pdfProgressCircle = pdfProgressContainer.querySelector('.circle');
const pdfProgressText = document.getElementById('pdfProgressText');
const previewImg = document.getElementById('pdfPreviewImg');
const PDF_ICON = 'pdfIcon.png';

// Initialize SVG progress after making it visible
function initPdfProgress() {
  if (!pdfProgressCircle) return;
  const length = pdfProgressCircle.getTotalLength();
  pdfProgressCircle.style.strokeDasharray = length;
  pdfProgressCircle.style.strokeDashoffset = length;
}

// Set PDF progress
function setProgress(percent) {
  if (!pdfProgressCircle) return;
  const length = pdfProgressCircle.getTotalLength();
  pdfProgressCircle.style.strokeDasharray = length;
  pdfProgressCircle.style.strokeDashoffset = length - (percent / 100) * length;
  if (pdfProgressText) pdfProgressText.innerText = `${Math.round(percent)}%`;
}

// PDF Convert / Merge
convertBtn.addEventListener('click', async () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return alert('Please select some files first.');

  convertBtn.disabled = true;
  pdfProgressContainer.style.display = 'block';
  previewImg.style.display = 'none';
  output.style.display = 'none'; // hide initially
  output.innerHTML = '';

  initPdfProgress();
  setProgress(0);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  let firstImageBlob = null;
  let outputShown = false; // track when output box is first shown

  try {
    const pdfDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let dataBlob;

      if (await isHeic(file)) {
        dataBlob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.8 });
        if (!(dataBlob instanceof Blob)) dataBlob = new Blob([dataBlob], { type: 'image/jpeg' });
      } else if (file.type.startsWith('image/')) {
        dataBlob = await compressImage(file, 1200, 0.6);
      } else if (file.type === 'application/pdf') {
        const existingPdfBytes = await file.arrayBuffer();
        const existingPdf = await PDFLib.PDFDocument.load(existingPdfBytes);
        const copiedPages = await pdfDoc.copyPages(existingPdf, existingPdf.getPageIndices());
        copiedPages.forEach(page => pdfDoc.addPage(page));
        setProgress(((i+1)/files.length)*100);

        // Show output box for PDF files too
        if (!outputShown) {
          output.style.display = 'block';
          output.innerHTML = `<p>Processing files...</p>`;
          outputShown = true;
        }

        continue;
      } else {
        setProgress(((i+1)/files.length)*100);

        if (!outputShown) {
          output.style.display = 'block';
          output.innerHTML = `<p>Skipping unsupported file(s)...</p>`;
          outputShown = true;
        }

        continue;
      }

      if (!firstImageBlob) firstImageBlob = dataBlob;

      const imgBytes = await dataBlob.arrayBuffer();
      const image = dataBlob.type === 'image/png'
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes);

      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

      // Show output box once we have the first processed file
      if (!outputShown) {
        output.style.display = 'block';
        output.innerHTML = `<p>Processing files...</p>`;
        outputShown = true;
      }

      setProgress(((i+1)/files.length)*100);
      await new Promise(r => setTimeout(r, 50)); // optional small delay for UI update
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfSizeMB = (pdfBlob.size / (1024*1024)).toFixed(2);
    const url = URL.createObjectURL(pdfBlob);

    output.innerHTML += `<p>✅ PDF created successfully! (${pdfSizeMB} MB)</p>
                         <a href="${url}" download="combined.pdf">Download PDF</a>`;

    if (firstImageBlob) previewImg.src = URL.createObjectURL(firstImageBlob);
    else previewImg.src = PDF_ICON;

  } catch (err) {
    console.error('[ERROR]', err);
    if (!outputShown) output.style.display = 'block';
    output.innerHTML += `<p style="color:red;">Error: ${err.message}</p>`;
    previewImg.src = PDF_ICON;
  } finally {
    pdfProgressContainer.style.display = 'none';
    previewImg.style.display = 'block';
    convertBtn.disabled = false;
  }
});


// Compress images
async function compressImage(file, maxWidth=2000, quality=0.9) {
  return new Promise(async resolve => {
    let blob = file;
    if (file.type === 'image/heic') blob = await heicTo({ blob: file, type: 'image/jpeg', quality });

    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth/img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width*scale;
      canvas.height = img.height*scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(blob);
  });
}

// HEIC → JPEG
const heicFileInput = document.getElementById('heicFileInput');
const heicConvertBtn = document.getElementById('heicConvertBtn');
const heicOutput = document.getElementById('heicOutput');
const heicPreviewImg = document.getElementById('heicPreviewImg');
const heicProgressContainer = document.getElementById('heicProgressContainer');
const heicProgressCircle = heicProgressContainer.querySelector('.circle');
const heicProgressText = document.getElementById('heicProgressText');

// function initHeicProgress() {
//   if (!heicProgressCircle) return;
//   const length = heicProgressCircle.getTotalLength();
//   heicProgressCircle.style.strokeDasharray = length;
//   heicProgressCircle.style.strokeDashoffset = length;
// }

function setHeicProgress(percent) {
  if (!heicProgressCircle) return;
  const length = heicProgressCircle.getTotalLength();
  heicProgressCircle.style.strokeDasharray = length;
  heicProgressCircle.style.strokeDashoffset = length - (percent / 100) * length;
  heicProgressText.innerText = `${Math.round(percent)}%`;
}

// HEIC Convert
heicConvertBtn.addEventListener('click', async () => {
  const files = Array.from(heicFileInput.files);
  if (!files.length) return alert('Please select HEIC files.');

  heicConvertBtn.disabled = true;
  heicOutput.innerHTML = '';
  heicOutput.style.display = 'block';
  heicOutput.innerHTML = `<p>Processing files...</p>`;
  heicPreviewImg.style.display = 'none';
  heicProgressContainer.style.display = 'block';
  setHeicProgress(0);

  const convertedBlobs = [];
  let firstBlob = null;
  let totalBytes = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (!(await isHeic(file))) {
      console.warn(file.name, 'is not a HEIC file. Skipping.');
      heicOutput.innerHTML += `<p style="color:orange;">${file.name} is not a HEIC file. Skipped.</p>`;
      setHeicProgress(((i + 1) / files.length) * 100);
      continue;
    }

    try {
      const jpgBlob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
      const safeBlob = jpgBlob instanceof Blob ? jpgBlob : new Blob([jpgBlob], { type: 'image/jpeg' });
      convertedBlobs.push({ blob: safeBlob, name: file.name.replace(/\.heic$/i, '.jpg') });

      if (!firstBlob) firstBlob = safeBlob;
      totalBytes += safeBlob.size;

      // Show converted file as link with size
      const sizeMB = (safeBlob.size / (1024*1024)).toFixed(2);
      const url = URL.createObjectURL(safeBlob);
      heicOutput.innerHTML += `<p>${file.name} → <a href="${url}" download="${file.name.replace(/\.heic$/i, '.jpg')}">Download JPEG</a> (${sizeMB} MB)</p>`;

    } catch (err) {
      console.error('[ERROR]', file.name, err);
      heicOutput.innerHTML += `<p style="color:red;">Failed to convert ${file.name}: ${err.message}</p>`;
    }

    setHeicProgress(((i + 1) / files.length) * 100);
    await new Promise(r => setTimeout(r, 50)); // small delay for UI
  }

  heicProgressContainer.style.display = 'none';
  if (firstBlob) {
    heicPreviewImg.src = URL.createObjectURL(firstBlob);
    heicPreviewImg.style.display = 'block';
  }

  // Show total summary + clickable "Download All" link
  if (convertedBlobs.length) {
    const totalSizeMB = (totalBytes / (1024*1024)).toFixed(2);
    const combinedText = `<p>✅ Converted ${convertedBlobs.length} file(s) (${totalSizeMB} MB)</p>`;
    heicOutput.innerHTML += combinedText;

    const downloadAllLink = document.createElement('a');
    downloadAllLink.href = '#';
    downloadAllLink.textContent = 'Download All';
    downloadAllLink.classList.add('download-all-link'); // optional class for additional styling

    downloadAllLink.addEventListener('click', e => {
      e.preventDefault();
      convertedBlobs.forEach(item => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(item.blob);
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    });

    heicOutput.appendChild(downloadAllLink);
    heicOutput.style.display = 'block'; // ensure box is visible
  } 

  heicConvertBtn.disabled = false;
});
