// SCA_AutoMessager/autoMessager.js
console.log("autoMessager.js loaded");

// -------------------------
// AutoMessager Core (temp.js style)
// -------------------------
async function runAutoMessager() {

  // Smart click helper
  function smartClick(el) {
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "center" });
    const opts = { bubbles: true, cancelable: true, view: window };
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type =>
      el.dispatchEvent(new MouseEvent(type, opts))
    );
    return true;
  }

  // Customer name
  function getCustomerName() {
    let t = (document.title || "").trim();
    if (!t) return "Customer";
    let c = t.replace(/\s*[\|\-–—•]\s*SCA\s*$/i, "").trim();
    if (c && c !== t) return c;
    c = t.replace(/^SCA\s*[\|\-–—•]\s*/i, "").trim();
    if (c && c !== t) return c;
    return t.split(/[\|\-–—•]/)[0].trim() || "Customer";
  }

  // Appointment details
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
        minute: "2-digit",
        hour12: true
      });
    } else {
      const m = txt.match(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/i);
      if (m) time = m[0];
    }

    return { day, time };
  }

  // Completion time
  function getCompletionTime() {
    const el = document.querySelector('input[placeholder="Estimated Completion Date"],input[data-placeholder="Estimated Completion Date"]');
    if (!el || !el.value) return "_____";
    const m = el.value.trim().match(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/i);
    return m ? m[0] : "_____";
  }

  // Service location
  function getLocation() {
    const locInput = document.querySelector('input[placeholder*="Select a location"],input[data-placeholder*="Select a location"]');
    return locInput?.value.trim() || "Tesla Service";
  }

  // Pre-scan for validation
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

  // Extra messages
  function getExtraMessage() {
    const waiterEl = [...document.querySelectorAll("div")].find(el => (el.textContent || "").trim().toLowerCase() === "waiter");
    const loanerEl = [...document.querySelectorAll("div")].find(el => (el.textContent || "").trim().toLowerCase() === "internal loaner");

    if (waiterEl) return "You're welcome to wait on site while we complete the work, we have a lounge with free coffee and wifi.";
    if (loanerEl) return "We have allocated you a loan vehicle for your service, please remember to bring your license.";
    return "";
  }

  const hasValidation = preScanForValidation();

  // -------------------------
  // Find Comm Log tab
  // -------------------------
  const COMM_LOG_ID = "mat-tab-label-2-4";
  let commLog = document.getElementById(COMM_LOG_ID) ||
    [...document.querySelectorAll('[role="tab"].mat-tab-label,.mat-tab-label[role="tab"],[role="tab"].mat-tab-label')]
      .find(el => /(^|\s)comm\s*log(\s|$)/i.test((el.textContent || "").trim()));

  if (!commLog) { alert('Could not find the "Comm Log" tab.'); return; }
  if (commLog.getAttribute("aria-disabled") === "true") { alert('"Comm Log" tab is disabled.'); return; }

  smartClick(commLog);

  // -------------------------
  // Wait for tab content + chat input
  // -------------------------
  setTimeout(() => {
    const chatLabel = [...document.querySelectorAll("label.switcher__label")]
      .find(el => /chat\s*with\s*customer/i.test((el.textContent || "").trim()));
    if (!chatLabel) { alert('Could not find "Chat With Customer".'); return; }

    smartClick(chatLabel);

    setTimeout(() => {
      const inputBox = document.querySelector("textarea") ||
        document.querySelector("input[type='text']") ||
        document.querySelector("[contenteditable='true']");
      const dateEl = document.querySelector("span.custom-date-component");
      if (!inputBox || !dateEl) { console.error("[AutoMessager] Required elements not found."); return; }

      const customerName = getCustomerName();
      const { day, time: appointmentTime } = getAppointmentDetails();
      const completionTime = getCompletionTime();
      const serviceLocation = getLocation();
      const validationMsg = hasValidation
        ? "Please allow up to 15 minutes before your appointment for a validation road test with a technician to verify your concern's."
        : "";
      const extraMsg = getExtraMessage();

      const message = `Hi ${customerName}, just a friendly reminder you have an upcoming appointment scheduled at ${serviceLocation} on ${day} at ${appointmentTime}. We will need the vehicle until ${completionTime}.
${validationMsg}
${extraMsg}
Please use https://maps.app.goo.gl/NmD9Cp5NqfNUAWvYA to navigate to the service centre and the entrance is just past the showroom at the back corner of the building, please drive into the Service Driveway.

If you have any questions or would like to add anything on to this visit please let us know ahead of time.

Kind regards  
Ronan - Tesla Service`;

      if (/^(TEXTAREA|INPUT)$/i.test(inputBox.tagName)) {
        inputBox.value = message;
        inputBox.dispatchEvent(new Event("input", { bubbles: true }));
        inputBox.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        inputBox.focus();
        inputBox.innerText = message;
        inputBox.dispatchEvent(new Event("input", { bubbles: true }));
      }

      console.log(`[AutoMessager] Message inserted. Location: ${serviceLocation}, Day: ${day}, Time: ${appointmentTime}, Validation: ${hasValidation}`);
    }, 1200); // wait for input box to render

  }, 4000); // wait for Comm Log tab content to render
}

// -------------------------
// Button Injection (direct run)
// -------------------------
function injectButton() {
  const toast = document.querySelector('[name="feedbackToastr"].padding-24');
  if (!toast || toast.querySelector('#autoMessagerBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'autoMessagerBtn';
  btn.innerText = 'Run AutoMessager';
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
  `;
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
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    console.log("[AutoMessager] Slider off, button not injected");
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "runAutoMessager") runAutoMessager();
});
