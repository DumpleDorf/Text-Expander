// SCA_AutoMessager/autoMessager.js
if (window.__autoMessagerInjected) console.warn("AutoMessager already injected");
window.__autoMessagerInjected = true;

console.log("[AutoMessager] Script loaded");

// -------------------------
// Helpers
// -------------------------
function smartClick(el) {
  if (!el) return false;
  el.scrollIntoView({ block: "center", inline: "center" });
  const opts = { bubbles: true, cancelable: true, view: window };
  ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type =>
    el.dispatchEvent(new MouseEvent(type, opts))
  );
  return true;
}

function getCustomerFirstName() {
  let t = (document.title || "").trim();
  if (!t) return "Customer";
  t = t.replace(/\s*[\|\-–—•]\s*SCA\s*$/i, "").replace(/^SCA\s*[\|\-–—•]\s*/i, "").trim();
  let name = t.split(/[\|\-–—•]/)[0].trim();
  if (!name) return "Customer";
  return name.split(/\s+/)[0];
}

function getAssignedFirstName() {
  const assigneeEls = document.querySelectorAll('.assignee-list-item');
  for (const el of assigneeEls) {
    const innerSpan = el.querySelector('span.ng-star-inserted');
    if (!innerSpan) continue;
    const fullName = (innerSpan.textContent || "").trim();
    if (!fullName || fullName.toLowerCase() === "assign") continue;
    console.log(`[AutoMessager] Assigned full name detected: ${fullName}`);
    return fullName.split(/\s+/)[0]; // Return first name
  }
  console.warn("[AutoMessager] No assigned name found");
  return null;
}

function getAppointmentDetails() {
  const el = document.querySelector("span.custom-date-component");
  if (!el) return { day: "____day", time: "____am" };
  const txt = (el.textContent || "").trim();
  const appointmentDate = new Date(txt);

  let day = "____day";
  let time = "____am";

  if (!isNaN(appointmentDate)) {
    day = appointmentDate.toLocaleDateString("en-US", { weekday: "long" });
    time = appointmentDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    });
  } else {
    const m = txt.match(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/i);
    if (m) time = m[0];
  }
  return { day, time };
}

function getLocation() {
  const locInput = document.querySelector('input[placeholder*="Select a location"],input[data-placeholder*="Select a location"]');
  return locInput?.value.trim() || "Tesla Service";
}

function preScanForValidation() {
  const patterns = [
    "perform post-repair validation test drive - test/adjust",
    "perform post-repair validation"
  ];
  return [...document.querySelectorAll("span,div,p,td,li")].some(el => {
    const t = (el.textContent || "").trim().toLowerCase();
    return patterns.some(p => t.includes(p));
  });
}

function getExtraMessage() {
  const waiterEl = [...document.querySelectorAll("div")].find(el => (el.textContent || "").trim().toLowerCase() === "waiter");
  const loanerEl = [...document.querySelectorAll("div")].find(el => (el.textContent || "").trim().toLowerCase() === "internal loaner");
  if (waiterEl) return "You're welcome to wait on site while we complete the work. We have a lounge with free coffee and Wi-Fi.";
  if (loanerEl) return "We have allocated you a loan vehicle for your service, please remember to bring your license.";
  return "";
}

// -------------------------
// CSV parsing (handles commas inside quotes)
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

function loadCSVConfig(csvPath, mapFn, callback) {
  fetch(chrome.runtime.getURL(csvPath))
    .then(res => res.text())
    .then(csvText => {
      const lines = csvText.trim().split("\n");
      lines.shift();
      const config = {};
      lines.forEach(line => {
        const cols = parseCSVLine(line);
        const { key, value } = mapFn(cols);
        if (key) config[key] = value;
      });
      callback(config);
    })
    .catch(err => {
      console.error(`[AutoMessager] Error loading ${csvPath}:`, err);
      callback({});
    });
}

// -------------------------
// Message builders
// -------------------------
function buildServiceMessage(ctx) {
  const { customerFirstName, serviceLocation, day, appointmentTime, sc, assignedName, extraMsg, validationMsg } = ctx;
  const scLine = sc.link
    ? `Please use ${sc.link} to navigate to the service center.${sc.instructions ? " " + sc.instructions : ""}`
    : sc.instructions || "";
  return [
    `Hi ${customerFirstName},`,
    `This is a courteous reminder of your upcoming appointment at ${serviceLocation} on ${day} at ${appointmentTime}. Please confirm with a 'YES' for your visit.`,
    "To facilitate a smooth check-in process, we kindly request that you approve your estimate before your appointment if you haven’t already done so.",
    extraMsg,
    validationMsg,
    scLine,
    "If you have any questions or would like to add anything on to this visit, please let us know ahead of time.",
    "We look forward to assisting you.",
    assignedName ? `Regards,\n${assignedName}\nTesla Service` : "Regards,\nTesla Service"
  ].filter(Boolean).join("\n\n");
}

function buildBodyRepairMessage(ctx) {
  const { customerFirstName, br, assignedName } = ctx;
  const cancelDaysText = `within ${br.cancelDays} days`;
  return [
    `Hi ${customerFirstName},`,
    `Thank you for submitting your vehicle repair request. We conduct our assessments digitally, and to proceed with an accurate repair estimation, we require the following images to be taken in clear light and submitted ${cancelDaysText}:`,
    "",
    "1. All four corners of the vehicle, captured from a distance to show the entire car, damages, and registration plate in good lighting.",
    "2. A clear photo of the odometer reading.",
    "3. A photo of the white VIN label, located in the driver-side door opening, looking downwards to the left.",
    "",
    "These images are essential for compiling a precise estimate and ensuring a swift repair process for your Tesla. Failure to provide the requested images within the specified timeframe will result in the cancellation of your request.",
    "",
    "Please see the photos below for reference.",
    "",
    `Kind Regards,${assignedName ? `\n${assignedName}` : ""}\nTesla Body Repair`
  ].filter(Boolean).join("\n\n");
}

// -------------------------
// Core function
// -------------------------
function runAutoMessager() {
  console.log("[AutoMessager] runAutoMessager triggered");

  const hasValidation = preScanForValidation();

  // Comm Log tab
  const COMM_LOG_ID = "mat-tab-label-2-4";
  const commLog = document.getElementById(COMM_LOG_ID) ||
    [...document.querySelectorAll('[role="tab"].mat-tab-label,.mat-tab-label[role="tab"],[role="tab"].mat-tab-label')]
      .find(el => /(^|\s)comm\s*log(\s|$)/i.test((el.textContent || "").trim()));

  if (!commLog) return console.warn('Could not find "Comm Log" tab.');
  if (commLog.getAttribute("aria-disabled") === "true") return console.warn('"Comm Log" tab is disabled.');
  smartClick(commLog);

  // Chat With Customer
  setTimeout(() => {
    const chatLabel = [...document.querySelectorAll("label.switcher__label")]
      .find(el => /chat\s*with\s*customer/i.test((el.textContent || "").trim()));
    if (!chatLabel) return console.warn("[AutoMessager] 'Chat With Customer' label not found");

    const inputId = chatLabel.getAttribute("for");
    const chatInput = inputId ? document.getElementById(inputId) : null;
    if (!chatInput) return console.warn("[AutoMessager] Associated input not found for 'Chat With Customer'");

    if (!chatInput.checked) {
      smartClick(chatLabel);
      console.log("[AutoMessager] Switched to 'Chat With Customer'");
    } else {
      console.log("[AutoMessager] 'Chat With Customer' already active");
    }

    setTimeout(() => {
      const inputBox = document.querySelector("textarea") ||
        document.querySelector("input[type='text']") ||
        document.querySelector("[contenteditable='true']");
      if (!inputBox) return console.warn("Could not find a chat input box.");

      const customerFirstName = getCustomerFirstName();
      const assignedName = getAssignedFirstName();
      const { day, time: appointmentTime } = getAppointmentDetails();
      const serviceLocation = getLocation();
      const validationMsg = hasValidation
        ? "Please allow up to 15 minutes before your appointment for a validation road test with a technician to verify your concern."
        : "";
      const extraMsg = getExtraMessage();

      loadCSVConfig(
        "SCA_AutoMessager/scConfig.csv",
        ([serviceCenter, link, instructions, image]) => ({ key: serviceCenter, value: { type: "service", link, instructions, image } }),
        serviceConfig => {
          loadCSVConfig(
            "SCA_AutoMessager/brConfig.csv",
            ([center, link, cancelDays, image]) => ({ key: center, value: { type: "body", link, cancelDays, image } }),
            bodyConfig => {

              const site = bodyConfig[serviceLocation] || serviceConfig[serviceLocation];
              if (!site) return console.warn("No site config found for", serviceLocation);

              const message = site.type === "body"
                ? buildBodyRepairMessage({ customerFirstName, serviceLocation, day, appointmentTime, br: site, assignedName })
                : buildServiceMessage({ customerFirstName, serviceLocation, day, appointmentTime, sc: site, assignedName, extraMsg, validationMsg });

              if (/^(TEXTAREA|INPUT)$/i.test(inputBox.tagName)) {
                inputBox.value = message;
                inputBox.dispatchEvent(new Event("input", { bubbles: true }));
              } else {
                inputBox.innerText = message;
                inputBox.dispatchEvent(new Event("input", { bubbles: true }));
              }

              console.log(`[AutoMessager] Message inserted for ${customerFirstName} at ${serviceLocation}`);

              // Attach images
              if (site.image) {
                // Both service and body repair use the same logic now
                const fileInput = document.querySelector('file-uploader input[type="file"]:not([capture]'), 
                      siteType = site.type;

                if (fileInput) {
                  console.log(`[AutoMessager] Attempting to attach ${siteType} image: ${site.image}`);
                  fetch(chrome.runtime.getURL(`SCA_AutoMessager/SC_Images/${site.image}`))
                    .then(res => res.blob())
                    .then(blob => {
                      const file = new File([blob], site.image, { type: blob.type });
                      const dataTransfer = new DataTransfer();
                      dataTransfer.items.add(file);
                      fileInput.files = dataTransfer.files;
                      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                      console.log(`[AutoMessager] ${siteType} image ${site.image} attached automatically`);
                    })
                    .catch(err => console.error(`[AutoMessager] Failed to attach ${siteType} image:`, err));
                } else {
                  console.warn(`[AutoMessager] File input not found for ${siteType} image`);
                }
              }

            }
          );
        }
      );

    }, 600);
  }, 400);
}

// -------------------------
// Button injection
// -------------------------
function injectButton() {
  const toast = document.querySelector('[name="feedbackToastr"].padding-24');
  if (!toast || toast.querySelector('#autoMessagerBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'autoMessagerBtn';
  btn.innerText = 'Create Pre-Arrival Message';
  btn.style.cssText = `
    position: absolute;
    right: 10px;
    top: 10px;
    padding: 6px 12px;
    background: #007aff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    transition: box-shadow 0.1s, transform 0.1s;
  `;

  const pressIn = () => { btn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)'; btn.style.transform='scale(0.98)'; };
  const release = () => { btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)'; btn.style.transform='scale(1)'; };
  btn.addEventListener('mousedown', pressIn);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);

  btn.addEventListener('click', runAutoMessager);

  toast.style.position = 'relative';
  toast.appendChild(btn);
  console.log("[AutoMessager] Button injected (runs directly)");
}

// -------------------------
// Init
// -------------------------
chrome.storage.sync.get('scAutoMessagerEnabled', data => {
  if (data.scAutoMessagerEnabled) {
    injectButton();
    new MutationObserver(() => injectButton()).observe(document.body, { childList: true, subtree: true });
  } else {
    console.log("[AutoMessager] Slider off, button not injected");
  }
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.action === "runAutoMessager") runAutoMessager();
});