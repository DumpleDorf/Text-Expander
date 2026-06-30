/**
 * Control which popup sections and tools are shown on the landing page.
 * Add section class names (e.g. "section-service") or tool element ids.
 */
const POPUP_VISIBILITY = {
  hiddenSections: [
    "section-service",
  ],
  hiddenTools: [
    "scAutoMessagerRow",
  ],
};

function applyPopupVisibility() {
  for (const sectionClass of POPUP_VISIBILITY.hiddenSections) {
    const el = document.querySelector(`.${sectionClass}`);
    if (el) el.style.display = "none";
  }

  for (const toolId of POPUP_VISIBILITY.hiddenTools) {
    const el = document.getElementById(toolId);
    if (el) el.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", applyPopupVisibility);
