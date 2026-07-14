(function paceTransferPickerBootstrap() {
  const href = window.location.href;
  const onPacePage = /^https:\/\/os\.tesla\.com\/en-AU\/pace(\/|$|\?)/i.test(href);
  if (!onPacePage) return;

  if (window.__paceTransferPickerLoaded) return;
  window.__paceTransferPickerLoaded = true;
  console.log("[PACE QOL] Transfer picker loaded on PACE page:", href);
  injectStyles();

  const DEPARTMENT_LABELS = {
    SalesDelivery: "Virtual Sales/Delivery",
    Energy: "Energy Transfer",
    CSAU: "CSAU Transfer"
  };

  const MOTORS_CHANNEL_OPTIONS = [
    { id: "Sales", label: "Virtual Sales" },
    { id: "Delivery", label: "Delivery" }
  ];

  const CSAU_OPTIONS = [
    { id: "rs", label: "Roadside", group: "AP-AU-Vehicle-CustomerSupport-RS:Voice" },
    { id: "vs", label: "Vehicle Support", group: "AP-AU-Vehicle-CustomerSupport-VS:Voice" },
    { id: "sc", label: "Service Center", group: "AP-AU-Vehicle-CustomerSupport-ServiceCenter:Voice" },
    { id: "hc", label: "Home Charging", group: "AP-AU-Vehicle-CustomerSupport-HomeCharging:Voice" },
    { id: "bs", label: "Body Shop", group: "AP-AU-Vehicle-CustomerSupport-BodyShop:Voice" }
  ];

  const ENERGY_TEAM_MAP = {
    customer: {
      wallconnector: "AP-AU-Energy-CS-WallConnector:Voice",
      powerwall: "AP-AU-Energy-CS-Powerwall:Voice"
    },
    installer: {
      wallconnector: {
        install: "AP-AU-Energy-CI-DayOfInstall-WallConnector:Voice",
        onsite: "AP-AU-Energy-CI-OSM-WallConnector:Voice",
        general: "AP-AU-Energy-CI-NotOnSite-WallConnector:Voice"
      },
      powerwall: {
        install: "AP-AU-Energy-CI-DayOfInstall-Powerwall:Voice",
        onsite: "AP-AU-Energy-CI-OSM-Powerwall:Voice",
        general: "AP-AU-Energy-CI-NotOnSite-Powerwall:Voice"
      }
    }
  };

  const ENERGY_FLOW = {
    audience: [
      { id: "customer", label: "Customer Facing" },
      { id: "installer", label: "Installer Facing" }
    ],
    product: {
      customer: [
        { id: "wallconnector", label: "Wall Connector Support" },
        { id: "powerwall", label: "Powerwall Support" }
      ],
      installer: [
        { id: "wallconnector", label: "Wall Connector" },
        { id: "powerwall", label: "Powerwall" }
      ]
    },
    support: {
      wallconnector: [
        { id: "install", label: "Onsite Installation Support" },
        { id: "onsite", label: "Onsite Maintenance or Warranty Works" },
        { id: "general", label: "(Not Onsite) General Support" }
      ],
      powerwall: [
        { id: "install", label: "Onsite Installation Support" },
        { id: "onsite", label: "Onsite Maintenance or Warranty Works" },
        { id: "general", label: "(Not Onsite) General Support" }
      ]
    }
  };

  const STATE_ORDER = ["NSW", "VIC", "SA", "QLD", "WA", "ACT", "TAS", "NT"];

  let transferData = [];
  let selectedDepartment = null;
  let selectedMotorsChannel = null;
  let selectedStateGroup = null;
  let selectedEnergyAudience = null;
  let selectedEnergyProduct = null;
  let selectedEnergySupportType = null;
  let activeDialog = null;
  let wasModalOpen = false;
  let wasTeamSearchVisible = false;
  let checkTimer = null;

  function injectStyles() {
    const existing = document.getElementById("pace-transfer-picker-styles");
    const href = chrome.runtime.getURL("PACEImprovements/transferPicker.css");
    if (existing) {
      if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
      return;
    }
    const link = document.createElement("link");
    link.id = "pace-transfer-picker-styles";
    link.rel = "stylesheet";
    link.href = href;
    (document.head || document.documentElement).appendChild(link);
  }

  function parseRgb(value) {
    if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") return null;
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }

  function luminance({ r, g, b }) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  // Mirror TDS label colour instead of guessing the site theme.
  // Default stays light text (dark mode). Only switches when the nearby
  // "Select Team" label is clearly dark (light mode).
  function syncPickerColors(dialog) {
    const picker = dialog?.querySelector("#pace-transfer-picker");
    if (!picker) return;

    const label = dialog.querySelector('label.tds-form-label[for="search-team"]')
      || dialog.querySelector("label.tds-form-label");
    const labelColor = label ? window.getComputedStyle(label).color : null;
    const rgb = parseRgb(labelColor);

    if (!rgb || luminance(rgb) >= 0.55) {
      picker.style.removeProperty("--pace-transfer-btn-color");
      picker.style.removeProperty("--pace-transfer-btn-border");
      picker.style.removeProperty("--pace-transfer-btn-border-hover");
      picker.style.removeProperty("--pace-transfer-btn-hover-bg");
      return;
    }

    picker.style.setProperty("--pace-transfer-btn-color", labelColor);
    picker.style.setProperty("--pace-transfer-btn-border", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
    picker.style.setProperty("--pace-transfer-btn-border-hover", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`);
    picker.style.setProperty("--pace-transfer-btn-hover-bg", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
  }

  function isPaceQolEnabled(callback) {
    chrome.storage.sync.get({ paceQolEnabled: true }, (items) => {
      callback(items.paceQolEnabled !== false);
    });
  }

  function parseCsv(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).filter(Boolean).map(line => {
      const values = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((header, i) => { row[header] = values[i] || ""; });
      return row;
    });
  }

  async function loadTransferData() {
    if (transferData.length) return transferData;
    const text = await fetch(chrome.runtime.getURL("PACEImprovements/transferTeams.csv")).then(r => r.text());
    transferData = parseCsv(text);
    return transferData;
  }

  function isTeamSearchVisible(dialog) {
    const label = dialog.querySelector('label.tds-form-label[for="search-team"]');
    const input = dialog.querySelector("#search-team");
    if (!label || !input) return false;

    const style = window.getComputedStyle(label);
    if (style.display === "none" || style.visibility === "hidden") return false;

    const rect = label.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isDialogOpen(dialog) {
    return dialog && (dialog.open || dialog.hasAttribute("open"));
  }

  function findOpenModal() {
    for (const dialog of document.querySelectorAll("dialog.tds-modal")) {
      if (!isDialogOpen(dialog)) continue;
      const modalContent = dialog.querySelector("section.tds-modal-content");
      if (modalContent) return { dialog, modalContent };
    }
    return null;
  }

  function resetSelectionState() {
    selectedDepartment = null;
    selectedMotorsChannel = null;
    selectedStateGroup = null;
    selectedEnergyAudience = null;
    selectedEnergyProduct = null;
    selectedEnergySupportType = null;
  }

  function resetEnergySelectionState() {
    selectedEnergyAudience = null;
    selectedEnergyProduct = null;
    selectedEnergySupportType = null;
  }

  function resetMotorsSelectionState() {
    selectedMotorsChannel = null;
    selectedStateGroup = null;
  }

  function getEnergyGroupName() {
    if (!selectedEnergyAudience || !selectedEnergyProduct) return null;

    if (selectedEnergyAudience === "customer") {
      return ENERGY_TEAM_MAP.customer[selectedEnergyProduct] || null;
    }

    if (!selectedEnergySupportType) return null;
    return ENERGY_TEAM_MAP.installer[selectedEnergyProduct]?.[selectedEnergySupportType] || null;
  }

  function createTransferButton(label, isSelected, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pace-transfer-btn";
    btn.textContent = label;
    if (isSelected) btn.classList.add("selected");
    btn.addEventListener("click", onClick);
    return btn;
  }

  function setRowVisibility(row, visible) {
    if (!row) return;
    row.classList.toggle("pace-transfer-row--hidden", !visible);
  }

  function renderButtonRow(row, options, selectedId, onSelect) {
    row.innerHTML = "";
    options.forEach(option => {
      row.appendChild(createTransferButton(
        option.label,
        selectedId === option.id,
        () => onSelect(option.id)
      ));
    });
  }

  function resetPickerState() {
    resetSelectionState();
    activeDialog = null;
    wasModalOpen = false;
    wasTeamSearchVisible = false;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
  }

  function dispatchInputEvents(input) {
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function clearTeamSelection(dialog) {
    const input = dialog.querySelector("#search-team");
    if (!input) return;
    if (input.value) {
      const clearBtn = input.closest(".tds-form-input")?.querySelector(".tds-form-input-search-clear button");
      if (clearBtn) clearBtn.click();
    }
    setInputValue(input, "");
    dispatchInputEvents(input);
  }

  function renderPicker(dialog) {
    const picker = dialog.querySelector("#pace-transfer-picker");
    if (!picker) return;

    const deptRow = picker.querySelector('[data-level="department"]');
    const motorsChannelRow = picker.querySelector('[data-level="motors-channel"]');
    const stateRow = picker.querySelector('[data-level="state"]');
    const csauRow = picker.querySelector('[data-level="csau"]');
    const audienceRow = picker.querySelector('[data-level="energy-audience"]');
    const productRow = picker.querySelector('[data-level="energy-product"]');
    const supportRow = picker.querySelector('[data-level="energy-support"]');
    if (!deptRow || !motorsChannelRow || !stateRow || !csauRow || !audienceRow || !productRow || !supportRow) return;

    deptRow.innerHTML = "";
    Object.entries(DEPARTMENT_LABELS).forEach(([department, label]) => {
      deptRow.appendChild(createTransferButton(
        label,
        selectedDepartment === department,
        () => {
          if (selectedDepartment === department) {
            selectedDepartment = null;
            resetMotorsSelectionState();
            resetEnergySelectionState();
            clearTeamSelection(dialog);
          } else {
            selectedDepartment = department;
            resetMotorsSelectionState();
            resetEnergySelectionState();
            clearTeamSelection(dialog);
          }
          renderPicker(dialog);
        }
      ));
    });

    const isEnergy = selectedDepartment === "Energy";
    const isMotors = selectedDepartment === "SalesDelivery";
    const isCsau = selectedDepartment === "CSAU";

    setRowVisibility(motorsChannelRow, isMotors);
    setRowVisibility(stateRow, isMotors && !!selectedMotorsChannel);
    setRowVisibility(csauRow, isCsau);
    setRowVisibility(audienceRow, isEnergy);
    setRowVisibility(productRow, isEnergy && !!selectedEnergyAudience);
    setRowVisibility(
      supportRow,
      isEnergy && selectedEnergyAudience === "installer" && !!selectedEnergyProduct
    );

    motorsChannelRow.innerHTML = "";
    if (isMotors) {
      renderButtonRow(motorsChannelRow, MOTORS_CHANNEL_OPTIONS, selectedMotorsChannel, (channelId) => {
        if (selectedMotorsChannel === channelId) {
          selectedMotorsChannel = null;
          selectedStateGroup = null;
          clearTeamSelection(dialog);
          renderPicker(dialog);
          return;
        }
        selectedMotorsChannel = channelId;
        selectedStateGroup = null;
        clearTeamSelection(dialog);
        renderPicker(dialog);
      });
    }

    stateRow.innerHTML = "";
    if (isMotors && selectedMotorsChannel) {
      transferData
        .filter(entry => entry.Department === selectedMotorsChannel)
        .sort((a, b) => STATE_ORDER.indexOf(a.State) - STATE_ORDER.indexOf(b.State))
        .forEach(entry => {
          const groupName = entry["Group Name"];
          stateRow.appendChild(createTransferButton(
            entry.Button,
            selectedStateGroup === groupName,
            () => {
              if (selectedStateGroup === groupName) {
                selectedStateGroup = null;
                clearTeamSelection(dialog);
                renderPicker(dialog);
                return;
              }
              selectedStateGroup = groupName;
              renderPicker(dialog);
              selectTeamInDropdown(groupName, dialog);
            }
          ));
        });
    }

    csauRow.innerHTML = "";
    if (isCsau) {
      CSAU_OPTIONS.forEach(option => {
        csauRow.appendChild(createTransferButton(
          option.label,
          selectedStateGroup === option.group,
          () => {
            if (selectedStateGroup === option.group) {
              selectedStateGroup = null;
              clearTeamSelection(dialog);
              renderPicker(dialog);
              return;
            }
            selectedStateGroup = option.group;
            renderPicker(dialog);
            selectTeamInDropdown(option.group, dialog);
          }
        ));
      });
    }

    if (isEnergy) {
      renderButtonRow(audienceRow, ENERGY_FLOW.audience, selectedEnergyAudience, (audienceId) => {
        if (selectedEnergyAudience === audienceId) {
          selectedEnergyAudience = null;
          selectedEnergyProduct = null;
          selectedEnergySupportType = null;
          clearTeamSelection(dialog);
          renderPicker(dialog);
          return;
        }

        selectedEnergyAudience = audienceId;
        selectedEnergyProduct = null;
        selectedEnergySupportType = null;
        clearTeamSelection(dialog);
        renderPicker(dialog);
      });

      if (selectedEnergyAudience) {
        renderButtonRow(
          productRow,
          ENERGY_FLOW.product[selectedEnergyAudience],
          selectedEnergyProduct,
          (productId) => {
            if (selectedEnergyProduct === productId) {
              selectedEnergyProduct = null;
              selectedEnergySupportType = null;
              clearTeamSelection(dialog);
              renderPicker(dialog);
              return;
            }

            selectedEnergyProduct = productId;
            selectedEnergySupportType = null;

            if (selectedEnergyAudience === "customer") {
              selectedStateGroup = null;
              renderPicker(dialog);
              selectTeamInDropdown(getEnergyGroupName(), dialog);
              return;
            }

            clearTeamSelection(dialog);
            renderPicker(dialog);
          }
        );
      } else {
        productRow.innerHTML = "";
      }

      if (selectedEnergyAudience === "installer" && selectedEnergyProduct) {
        renderButtonRow(
          supportRow,
          ENERGY_FLOW.support[selectedEnergyProduct],
          selectedEnergySupportType,
          (supportId) => {
            if (selectedEnergySupportType === supportId) {
              selectedEnergySupportType = null;
              clearTeamSelection(dialog);
              renderPicker(dialog);
              return;
            }

            selectedEnergySupportType = supportId;
            renderPicker(dialog);
            selectTeamInDropdown(getEnergyGroupName(), dialog);
          }
        );
      } else {
        supportRow.innerHTML = "";
      }
    } else {
      audienceRow.innerHTML = "";
      productRow.innerHTML = "";
      supportRow.innerHTML = "";
    }
  }

  async function selectTeamInDropdown(groupName, dialog) {
    const input = dialog.querySelector("#search-team");
    if (!input) return;

    if (input.value) {
      const clearBtn = input.closest(".tds-form-input")?.querySelector(".tds-form-input-search-clear button");
      if (clearBtn) clearBtn.click();
    }

    input.focus();
    setInputValue(input, groupName);
    dispatchInputEvents(input);

    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(r => setTimeout(r, 100));
      const listbox = dialog.querySelector("ul.tds-listbox");
      if (!listbox) continue;

      const option = listbox.querySelector(`li.tds-listbox-option[data-tds-label="${CSS.escape(groupName)}"]`)
        || [...listbox.querySelectorAll("li.tds-listbox-option")].find(li => {
          const label = li.getAttribute("data-tds-label") || li.textContent.trim();
          return label === groupName;
        });

      if (option && option.getAttribute("aria-disabled") !== "true") {
        option.click();
        return;
      }
    }
  }

  function createPickerElement() {
    const picker = document.createElement("div");
    picker.id = "pace-transfer-picker";

    const deptRow = document.createElement("div");
    deptRow.className = "pace-transfer-row pace-transfer-row--department";
    deptRow.dataset.level = "department";

    const body = document.createElement("div");
    body.className = "pace-transfer-picker-body";

    const stateRow = document.createElement("div");
    stateRow.className = "pace-transfer-row pace-transfer-row--state pace-transfer-row--hidden";
    stateRow.dataset.level = "state";

    const motorsChannelRow = document.createElement("div");
    motorsChannelRow.className = "pace-transfer-row pace-transfer-row--motors-channel pace-transfer-row--hidden";
    motorsChannelRow.dataset.level = "motors-channel";

    const csauRow = document.createElement("div");
    csauRow.className = "pace-transfer-row pace-transfer-row--csau pace-transfer-row--hidden";
    csauRow.dataset.level = "csau";

    const audienceRow = document.createElement("div");
    audienceRow.className = "pace-transfer-row pace-transfer-row--energy pace-transfer-row--hidden";
    audienceRow.dataset.level = "energy-audience";

    const productRow = document.createElement("div");
    productRow.className = "pace-transfer-row pace-transfer-row--energy pace-transfer-row--hidden";
    productRow.dataset.level = "energy-product";

    const supportRow = document.createElement("div");
    supportRow.className = "pace-transfer-row pace-transfer-row--energy pace-transfer-row--energy-support pace-transfer-row--hidden";
    supportRow.dataset.level = "energy-support";

    body.appendChild(motorsChannelRow);
    body.appendChild(stateRow);
    body.appendChild(csauRow);
    body.appendChild(audienceRow);
    body.appendChild(productRow);
    body.appendChild(supportRow);

    picker.appendChild(deptRow);
    picker.appendChild(body);
    return picker;
  }

  function removePicker(modalContent) {
    modalContent.classList.remove("pace-transfer-modal-active");
    modalContent.querySelector(".pace-transfer-quick-section")?.remove();
  }

  function syncPicker(modal) {
    const { dialog, modalContent } = modal;
    const teamVisible = isTeamSearchVisible(dialog);
    const dropdown = modalContent.querySelector(".control-bar-transfer-consult-modal-dropdown");
    const existing = modalContent.querySelector(".pace-transfer-quick-section");

    if (!teamVisible) {
      if (existing) {
        resetSelectionState();
        clearTeamSelection(dialog);
        removePicker(modalContent);
      }
      return;
    }

    if (!dropdown) return;

    modalContent.classList.add("pace-transfer-modal-active");

    if (existing) {
      renderPicker(dialog);
      syncPickerColors(dialog);
      alignPickerLabels(dialog);
      return;
    }

    const section = document.createElement("div");
    section.className = "pace-transfer-quick-section";

    const title = document.createElement("div");
    title.className = "tds-form-label pace-transfer-picker-title";
    title.textContent = "Quick Transfer";

    section.appendChild(title);
    section.appendChild(createPickerElement());
    dropdown.insertAdjacentElement("afterend", section);
    renderPicker(dialog);
    syncPickerColors(dialog);
    alignPickerLabels(dialog);
  }

  function alignPickerLabels(dialog) {
    requestAnimationFrame(() => {
      const teamLabel = dialog.querySelector('label.tds-form-label[for="search-team"]');
      const quickTitle = dialog.querySelector(".pace-transfer-picker-title");
      if (!teamLabel || !quickTitle) return;

      quickTitle.style.marginTop = "0px";
      const offset = teamLabel.getBoundingClientRect().top - quickTitle.getBoundingClientRect().top;
      if (Math.abs(offset) > 0.5) {
        quickTitle.style.marginTop = `${offset}px`;
      }
    });
  }

  function handleTeamSearchOpened(dialog) {
    resetSelectionState();
    clearTeamSelection(dialog);
    renderPicker(dialog);
    syncPickerColors(dialog);
    alignPickerLabels(dialog);
  }

  function handleDialogClosed(modalContent) {
    if (modalContent) removePicker(modalContent);
    resetPickerState();
  }

  function checkModal() {
    isPaceQolEnabled(async (enabled) => {
      const modal = findOpenModal();

      if (!enabled) {
        if (activeDialog) {
          handleDialogClosed(activeDialog.querySelector("section.tds-modal-content"));
        } else {
          resetPickerState();
        }
        return;
      }

      if (!modal) {
        if (activeDialog) {
          handleDialogClosed(activeDialog.querySelector("section.tds-modal-content"));
        } else {
          resetPickerState();
        }
        return;
      }

      const teamVisible = isTeamSearchVisible(modal.dialog);
      const dialogJustOpened = !wasModalOpen;
      const teamSearchJustOpened = teamVisible && !wasTeamSearchVisible;

      wasModalOpen = true;
      wasTeamSearchVisible = teamVisible;
      activeDialog = modal.dialog;

      await loadTransferData();

      if (dialogJustOpened && teamVisible) {
        handleTeamSearchOpened(modal.dialog);
      } else if (teamSearchJustOpened) {
        handleTeamSearchOpened(modal.dialog);
      }

      syncPicker(modal);
    });
  }

  function scheduleModalChecks() {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkModal, 50);
    [200, 600, 1200].forEach(delay => setTimeout(checkModal, delay));
  }

  document.addEventListener("click", (e) => {
    const tab = e.target.closest('.tds-tab-list [role="tab"]');
    if (tab) scheduleModalChecks();
  }, true);

  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    let shouldClose = false;

    for (const mutation of mutations) {
      const target = mutation.target;

      if (target instanceof Element && target.matches("dialog.tds-modal") && mutation.attributeName === "open") {
        if (target.hasAttribute("open")) shouldCheck = true;
        else shouldClose = true;
      }

      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.("dialog.tds-modal[open]") || node.querySelector?.("dialog.tds-modal[open]")) {
            shouldCheck = true;
          }
          if (node.matches?.('label[for="search-team"]') || node.querySelector?.('label[for="search-team"]')) {
            shouldCheck = true;
          }
          if (node.id === "search-team" || node.querySelector?.("#search-team")) {
            shouldCheck = true;
          }
        }

        for (const node of mutation.removedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.id === "search-team" || node.querySelector?.("#search-team")) {
            shouldCheck = true;
          }
        }
      }
    }

    if (shouldClose) {
      const content = activeDialog?.querySelector("section.tds-modal-content");
      handleDialogClosed(content);
    } else if (shouldCheck) {
      scheduleModalChecks();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open"]
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && "paceQolEnabled" in changes) {
      scheduleModalChecks();
    }
  });

  scheduleModalChecks();
})();
