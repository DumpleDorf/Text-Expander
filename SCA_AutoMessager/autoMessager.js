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
  const assigneeEl = document.querySelector('.assignee-list-item');
  if (!assigneeEl) return null;
  const fullName = (assigneeEl.textContent || "").trim();
  if (!fullName || fullName.toLowerCase() === "assign") return null; // <-- treat "Assign" as empty
  return fullName.split(/\s+/)[0];
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

// Not needed

// function getCompletionTime() {
//   const el = document.querySelector(
//     'input[placeholder="Estimated Completion Date"],input[data-placeholder="Estimated Completion Date"]'
//   );
//   if (!el || !el.value) return "_____";
//   const m = el.value.trim().match(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/i);
//   return m ? m[0] : "_____";
// }

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

function getSCConfig(callback) {
  try {
    fetch(chrome.runtime.getURL("SCA_AutoMessager/scConfig.csv"))
      .then(response => response.text())
      .then(csvText => {
        const lines = csvText.trim().split("\n");
        lines.shift(); // remove header
        const config = {};
        lines.forEach(line => {
          const [serviceCenter, link, instructions, image] = parseCSVLine(line);
          config[serviceCenter] = { 
            link: link || "", 
            instructions: instructions || "", 
            image: image || "" 
          };
        });
        callback(config);
      })
      .catch(err => {
        console.error("[AutoMessager] Error loading SC config CSV:", err);
        callback({});
      });
  } catch (e) {
    console.error("[AutoMessager] Exception in getSCConfig:", e);
    callback({});
  }
}

// -------------------------
// Core function
// -------------------------
function runAutoMessager() {
  console.log("[AutoMessager] runAutoMessager triggered");
  const hasValidation = preScanForValidation();

  // -------------------------
  // Find Comm Log tab
  // -------------------------
  const COMM_LOG_ID = "mat-tab-label-2-4";
  let commLog = document.getElementById(COMM_LOG_ID) ||
    [...document.querySelectorAll('[role="tab"].mat-tab-label,.mat-tab-label[role="tab"],[role="tab"].mat-tab-label')]
      .find(el => /(^|\s)comm\s*log(\s|$)/i.test((el.textContent || "").trim()));

  if (!commLog) return console.warn('Could not find "Comm Log" tab.');
  if (commLog.getAttribute("aria-disabled") === "true") return console.warn('"Comm Log" tab is disabled.');

  // Click Comm Log tab
  smartClick(commLog);

  setTimeout(() => {
    // -------------------------
    // Find Chat With Customer label
    // -------------------------
    const chatLabel = [...document.querySelectorAll("label.switcher__label")]
      .find(el => /chat\s*with\s*customer/i.test((el.textContent || "").trim()));

    // -------------------------
    // Check if Chat With Customer is already active
    // -------------------------
    const chatAlreadyActive =
      // Check for the special reminder text
      [...document.querySelectorAll("span, div, p, label")]
        .some(el => (el.textContent || "").includes("Owner Contact")) ||
      // Check for character count element ending with /1000
      [...document.querySelectorAll("label.characterCount")]
        .some(el => /\/1000\s*$/.test(el.textContent.trim()));

    if (!chatAlreadyActive && chatLabel) {
      smartClick(chatLabel);
    }

    // -------------------------
    // Insert message after chat is active
    // -------------------------
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

      getSCConfig(scConfig => {
        const scMsg = scConfig[serviceLocation] || { link: "", instructions: "", image: "" };
        const scLine = scMsg.link
          ? `Please use ${scMsg.link} to navigate to the service center.${scMsg.instructions ? " " + scMsg.instructions : "."}`
          : (scMsg.instructions ? scMsg.instructions : "");

        // Build closing lines
        let closingLines = assignedName
          ? `Regards,\n${assignedName}\nTesla Service`
          : `Regards,\nTesla Service`;

        // Build message
        const messageLines = [
          `Hi ${customerFirstName},`,
          `This is a courteous reminder of your upcoming appointment at ${serviceLocation} on ${day} at ${appointmentTime}. Please confirm with a 'YES' for your visit.`,
          "To facilitate a smooth check-in process, we kindly request that you approve your estimate before your appointment if you haven’t already done so. If the scheduled time is no longer convenient, you can easily reschedule through the Tesla App by selecting “Manage Appointment” and choosing from the available options.",
          extraMsg,
          validationMsg,
          scLine,
          "If you have any questions or would like to add anything on to this visit, please let us know ahead of time.",
          "",
          "We look forward to assisting you.",
          closingLines
        ].filter(Boolean).join("\n\n");

        // Insert message
        if (/^(TEXTAREA|INPUT)$/i.test(inputBox.tagName)) {
          inputBox.value = messageLines;
          inputBox.dispatchEvent(new Event("input", { bubbles: true }));
          inputBox.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          inputBox.focus();
          inputBox.innerText = messageLines;
          inputBox.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // Attach service center image
        if (scMsg.image) {
          const fileInput = document.querySelector('file-uploader input[type="file"]:not([capture])');
          if (fileInput) {
            fetch(chrome.runtime.getURL(`SCA_AutoMessager/SC_Images/${scMsg.image}`))
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], scMsg.image, { type: blob.type });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[AutoMessager] Image ${scMsg.image} attached automatically`);
              })
              .catch(err => console.error('[AutoMessager] Failed to load image:', err));
          } else {
            console.warn('[AutoMessager] File input not found');
          }
        }

        console.log(`[AutoMessager] Message inserted for ${customerFirstName} at ${serviceLocation}`);
      });
    }, 1200);
  }, 400);
}

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

  // Press effect
  const pressIn = () => {
    btn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
    btn.style.transform = 'scale(0.98)';
  };
  const release = () => {
    btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
    btn.style.transform = 'scale(1)';
  };

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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "runAutoMessager") runAutoMessager();
});
