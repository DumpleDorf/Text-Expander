// SCA_AutoMessager/autoMessager.js
if (window.__autoMessagerInjected) console.warn("AutoMessager already injected");
window.__autoMessagerInjected = true;

console.log("[AutoMessager] Script loaded");

// -------------------------
// Helpers
// -------------------------

// -------------------------
// Site detection
// -------------------------
function detectSite() {
  const host = location.hostname;
  const path = location.pathname;

  if (host === "repair.tesla.com" && path.startsWith("/collision/repair-orders")) {
    return "TESLA_BODY_PORTAL";
  }

  if (host.includes("serviceapp.tesla.com")) {
    return "SCA";
  }

  return null;
}

const CURRENT_SITE = detectSite();
console.log("[AutoMessager] Detected site:", CURRENT_SITE);

function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const visible = rect.width > 0 &&
                  rect.height > 0 &&
                  window.getComputedStyle(el).visibility !== "hidden" &&
                  window.getComputedStyle(el).display !== "none";
  console.log("[AutoMessager] Visibility check:", el, visible);
  return visible;
}

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
// Site adapters
// -------------------------
const SiteAdapters = {
  TESLA_BODY_PORTAL: {
    name: "Tesla Body Repair Portal",

    // Inject button AFTER the Select File(s) uploader
    getButtonAnchor() {
      const uploader = document.querySelector(
        'input#comm-log-upload'
      );
      return uploader?.closest(".tds-form-input") || null;
    },

    getChatInput() {
      return document.querySelector(
        'textarea[placeholder="Type message..."]'
      );
    },

    ensureChatWithCustomerSelected() {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const chatTab = tabs.find(t =>
        /chat\s*with\s*customer/i.test(t.textContent || "")
      );

      if (chatTab && chatTab.getAttribute("aria-selected") !== "true") {
        smartClick(chatTab);
        console.log("[AutoMessager] Switched to Chat with Customer");
      }
    },

    getCustomerFirstName() {
      const labelSpan = [...document.querySelectorAll("span")]
        .find(s => s.textContent?.trim() === "Name :");

      const nameSpan = labelSpan?.nextElementSibling;
      const fullName = nameSpan?.textContent?.trim();

      return fullName ? fullName.split(/\s+/)[0] : "Customer";
    },

    getServiceLocation() {
      const el = document.querySelector(
        'span.tds-site-app-title'
      );
      return el?.getAttribute("title") || el?.textContent?.trim() || "Tesla Body Repair";
    },

    getAssignedFirstName() {
      const el = document.querySelector(
        '.tes-header-username-display'
      );
      const fullName = el?.textContent?.trim();
      return fullName ? fullName.split(/\s+/)[0] : null;
    },

    getFileInput() {
      return document.querySelector('input#comm-log-upload[type="file"]');
    }
  }
};

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

  // =========================================================
  // TESLA BODY REPAIR PORTAL
  // =========================================================
  if (CURRENT_SITE === "TESLA_BODY_PORTAL") {
    const adapter = SiteAdapters.TESLA_BODY_PORTAL;

    // Ensure Chat with Customer tab is active
    adapter.ensureChatWithCustomerSelected();

    setTimeout(() => {
      const inputBox = adapter.getChatInput();
      if (!inputBox) return console.warn("[AutoMessager] Chat input not found");

      const customerFirstName = adapter.getCustomerFirstName();
      const assignedName = adapter.getAssignedFirstName();
      const serviceLocation = adapter.getServiceLocation();

      loadCSVConfig(
        "SCA_AutoMessager/brConfig.csv",
        ([center, link, cancelDays, image]) => ({
          key: center,
          value: { type: "body", link, cancelDays, image }
        }),
        bodyConfig => {
          const site = bodyConfig[serviceLocation];
          if (!site) return console.warn("[AutoMessager] No body repair config for", serviceLocation);

          const message = buildBodyRepairMessage({
            customerFirstName,
            br: site,
            assignedName
          });

          inputBox.value = message;
          inputBox.dispatchEvent(new Event("input", { bubbles: true }));

          console.log("[AutoMessager] Body repair message inserted");

          // Attach image (if configured)
          if (site.image) {
            const fileInput = adapter.getFileInput();
            if (!fileInput) return console.warn("[AutoMessager] File input not found");

            fetch(chrome.runtime.getURL(`SCA_AutoMessager/SC_Images/${site.image}`))
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], site.image, { type: blob.type });
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event("change", { bubbles: true }));
                console.log("[AutoMessager] Body repair image attached");
              })
              .catch(err => console.error("[AutoMessager] Image attach failed", err));
          }
        }
      );
    }, 300);

    return; // ⛔ DO NOT continue into SCA logic
  }

  // =========================================================
  // SCA (EXISTING BEHAVIOR – UNCHANGED)
  // =========================================================
  const hasValidation = preScanForValidation();

  const COMM_LOG_ID = "mat-tab-label-2-4";
  const commLog = document.getElementById(COMM_LOG_ID) ||
    [...document.querySelectorAll('[role="tab"].mat-tab-label,.mat-tab-label[role="tab"],[role="tab"].mat-tab-label')]
      .find(el => /(^|\s)comm\s*log(\s|$)/i.test((el.textContent || "").trim()));

  if (!commLog) return console.warn('Could not find "Comm Log" tab.');
  if (commLog.getAttribute("aria-disabled") === "true") return console.warn('"Comm Log" tab is disabled.');
  smartClick(commLog);

  setTimeout(() => {
    const chatLabel = [...document.querySelectorAll("label.switcher__label")]
      .find(el => /chat\s*with\s*customer/i.test((el.textContent || "").trim()));
    if (!chatLabel) return console.warn("[AutoMessager] 'Chat With Customer' label not found");

    const inputId = chatLabel.getAttribute("for");
    const chatInput = inputId ? document.getElementById(inputId) : null;
    if (!chatInput) return console.warn("[AutoMessager] Associated input not found");

    if (!chatInput.checked) smartClick(chatLabel);

    setTimeout(() => {
      const inputBox =
        document.querySelector("textarea") ||
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
        ([serviceCenter, link, instructions, image]) => ({
          key: serviceCenter,
          value: { type: "service", link, instructions, image }
        }),
        serviceConfig => {
          loadCSVConfig(
            "SCA_AutoMessager/brConfig.csv",
            ([center, link, cancelDays, image]) => ({
              key: center,
              value: { type: "body", link, cancelDays, image }
            }),
            bodyConfig => {
              const site = bodyConfig[serviceLocation] || serviceConfig[serviceLocation];
              if (!site) return console.warn("No site config found for", serviceLocation);

              const message = site.type === "body"
                ? buildBodyRepairMessage({ customerFirstName, br: site, assignedName })
                : buildServiceMessage({
                    customerFirstName,
                    serviceLocation,
                    day,
                    appointmentTime,
                    sc: site,
                    assignedName,
                    extraMsg,
                    validationMsg
                  });

              inputBox.value = message;
              inputBox.dispatchEvent(new Event("input", { bubbles: true }));

              if (site.image) {
                const fileInput = document.querySelector(
                  'file-uploader input[type="file"]:not([capture])'
                );
                if (!fileInput) return;

                fetch(chrome.runtime.getURL(`SCA_AutoMessager/SC_Images/${site.image}`))
                  .then(res => res.blob())
                  .then(blob => {
                    const file = new File([blob], site.image, { type: blob.type });
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    fileInput.files = dt.files;
                    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
                  });
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
  console.log("[AutoMessager] injectButton called");

  // TESLA BODY REPAIR PORTAL
  if (CURRENT_SITE === "TESLA_BODY_PORTAL") {
    const uploader = document.querySelector('#comm-log-upload');
    console.log("[AutoMessager] Body portal uploader found:", uploader);

    const anchor = uploader?.closest('.tds-form-item');
    console.log("[AutoMessager] Body portal anchor:", anchor);

    if (!anchor) {
      console.log("[AutoMessager] Anchor not found, skipping injection");
      return;
    }

    if (!isElementVisible(anchor)) {
      console.log("[AutoMessager] Anchor not visible yet, skipping injection");
      return;
    }

    if (anchor.querySelector("#autoMessagerBtn")) {
      console.log("[AutoMessager] Button already exists, skipping injection");
      return;
    }

    const btn = document.createElement("button");
    btn.id = "autoMessagerBtn";
    btn.innerText = "Create Pre-Arrival Message";
    btn.className = "tds-btn tds-btn--primary";
    btn.style.marginTop = "10px";

    btn.addEventListener("click", runAutoMessager);

    anchor.insertAdjacentElement("afterend", btn);
    console.log("[AutoMessager] Button injected successfully for Tesla Body Repair Portal");
    return;
  }

  // SCA (existing behavior)
  const toast = document.querySelector('[name="feedbackToastr"].padding-24');
  if (!toast) {
    console.log("[AutoMessager] SCA toast not found, skipping");
    return;
  }
  if (toast.querySelector('#autoMessagerBtn')) {
    console.log("[AutoMessager] SCA button already exists, skipping");
    return;
  }

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
  `;

  btn.addEventListener('click', runAutoMessager);

  toast.style.position = 'relative';
  toast.appendChild(btn);
  console.log("[AutoMessager] Button injected for SCA");
}

function setupClickWatcherForBodyPortal() {
  if (CURRENT_SITE !== "TESLA_BODY_PORTAL") return;

  console.log("[AutoMessager] Click watcher for body portal uploader attached");

  document.body.addEventListener("click", () => {
    const existingBtn = document.querySelector('#autoMessagerBtn');
    if (existingBtn && isElementVisible(existingBtn)) {
      console.log("[AutoMessager] Button already visible, skipping injection");
      return;
    }

    console.log("[AutoMessager] Click detected, starting periodic uploader check");

    let checks = 0;
    const maxChecks = 10; // every second for 10 seconds
    const intervalId = setInterval(() => {
      checks++;

      const uploaderInput = document.querySelector('#comm-log-upload');
      const container = uploaderInput?.closest('.tds-form-item');

      console.log(`[AutoMessager] Check #${checks}: uploaderInput =`, uploaderInput, "container =", container);

      if (container && isElementVisible(container)) {
        console.log("[AutoMessager] Uploader visible, injecting button");
        injectButton();
        clearInterval(intervalId); // stop further checks
        return;
      }

      if (checks >= maxChecks) {
        console.log("[AutoMessager] Max checks reached, stopping uploader watcher");
        clearInterval(intervalId);
      }
    }, 1000); // 1 second interval
  }, true); // capture phase
}

// -------------------------
// Init
// -------------------------
chrome.storage.sync.get('scAutoMessagerEnabled', data => {
  if (!data.scAutoMessagerEnabled) {
    console.log("[AutoMessager] Slider off, button not injected");
    return;
  }

  if (CURRENT_SITE === "TESLA_BODY_PORTAL") {
      setupClickWatcherForBodyPortal();
  } else {
    new MutationObserver(() => injectButton())
      .observe(document.body, { childList: true, subtree: true });
  }
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.action === "runAutoMessager") runAutoMessager();
});