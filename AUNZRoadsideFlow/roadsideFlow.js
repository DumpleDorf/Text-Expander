/**
 * AUNZ Roadside Flow walkthrough (in-popup).
 * Data: AUNZRoadsideFlow/roadside-flow.json
 */

let flowState = null;

const TYPE_LABELS = {
  decision: "Decision",
  process: "Action",
  start: "Outcome",
  rejection: "Note",
};

const TYPE_BADGE_CLASS = {
  decision: "badge-decision",
  process: "badge-process",
  start: "badge-outcome",
  rejection: "badge-note",
};

function pathNote(node, choice) {
  if (!choice) return node.text;
  return `${node.text}: ${choice}`;
}

function formatCaseNotes(pathSteps) {
  return pathSteps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function findStart(data) {
  const incoming = new Set(data.edges.map((e) => e.to));
  return (
    data.nodes.find((n) => !incoming.has(n.id) && n.type === "start") ||
    data.nodes.find((n) => !incoming.has(n.id)) ||
    data.nodes[0]
  )?.id;
}

function buildGraph(data) {
  const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  const outEdges = {};
  for (const edge of data.edges) {
    (outEdges[edge.from] ||= []).push(edge);
  }
  return { byId, outEdges };
}

function nodeBadge(node, canEnd) {
  if (canEnd && !flowState?.ended) return { label: "Branch end", className: "badge-end" };
  return {
    label: TYPE_LABELS[node.type] || "Step",
    className: TYPE_BADGE_CLASS[node.type] || "badge-process",
  };
}

function updateProgress() {
  if (!flowState?.progressEl) return;
  const steps = flowState.path.length;
  const pct = flowState.ended ? 100 : Math.min(8 + steps * 7, 92);
  flowState.progressEl.style.width = `${pct}%`;
}

function updatePathPanel() {
  const { path, pathSection, pathListEl } = flowState;
  pathSection.classList.toggle("has-path", path.length > 0);
  pathListEl.innerHTML = path.length
    ? path.map((step) => `<li>${escapeHtml(step)}</li>`).join("")
    : '<li class="roadside-path-placeholder">Steps will appear here as you go…</li>';
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pulseCard() {
  const { cardEl } = flowState;
  if (!cardEl) return;
  cardEl.classList.remove("step-change");
  void cardEl.offsetWidth;
  cardEl.classList.add("step-change");
}

function showCopyNotice(el) {
  el.textContent = "Copied!";
  el.classList.add("show");
  setTimeout(() => {
    el.classList.remove("show");
    el.textContent = "";
  }, 1500);
}

function createActionButton(label, className, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function goBack() {
  if (!flowState || flowState.stack.length <= 1 || flowState.ended) return;
  flowState.stack.pop();
  flowState.path.pop();
  flowState.current = flowState.stack[flowState.stack.length - 1];
  flowState.ended = false;
  renderWalk();
}

function renderWalk() {
  if (!flowState) return;

  const {
    byId,
    outEdges,
    path,
    typeEl,
    textEl,
    actionsEl,
  } = flowState;

  actionsEl.innerHTML = "";
  updatePathPanel();
  updateProgress();
  pulseCard();

  if (flowState.ended) {
    typeEl.className = "roadside-badge badge-complete";
    typeEl.textContent = "Complete";
    textEl.textContent = "Flow ended. Copy your case notes below or restart.";
    actionsEl.appendChild(
      createActionButton("Copy", "roadside-btn-copy", async () => {
        await navigator.clipboard.writeText(formatCaseNotes(path));
        if (flowState.copyNotice) showCopyNotice(flowState.copyNotice);
      })
    );
    actionsEl.appendChild(
      createActionButton("Restart", "roadside-btn-secondary", () =>
        window.initRoadsideFlow()
      )
    );
    return;
  }

  const node = byId[flowState.current];
  if (!node) return;

  const edges = outEdges[flowState.current] || [];
  const yes = edges.find((e) => e.kind === "yes");
  const no = edges.find((e) => e.kind === "no");
  const flow = edges.filter((e) => e.kind === "flow");
  const optional = edges.filter((e) => e.kind === "optional");
  const canEnd = !yes && !no && !flow.length;

  const badge = nodeBadge(node, canEnd);
  typeEl.className = `roadside-badge ${badge.className}`;
  typeEl.textContent = badge.label;
  textEl.textContent = node.text;

  const go = (id, label) => {
    path.push(pathNote(node, label));
    flowState.stack.push(id);
    flowState.current = id;
    renderWalk();
  };

  const primary = document.createElement("div");
  primary.className = "roadside-actions-primary";
  const secondary = document.createElement("div");
  secondary.className = "roadside-actions-secondary";

  if (yes) {
    primary.appendChild(
      createActionButton("Yes", "roadside-btn-yes", () => go(yes.to, "Yes"))
    );
  }
  if (no) {
    primary.appendChild(
      createActionButton("No", "roadside-btn-no", () => go(no.to, "No"))
    );
  }
  for (const edge of flow) {
    primary.appendChild(
      createActionButton("Continue", "roadside-btn-continue", () =>
        go(edge.to, "Continue")
      )
    );
  }
  if (canEnd) {
    primary.appendChild(
      createActionButton("End Flow", "roadside-btn-end", () => {
        path.push(pathNote(node, "End Flow"));
        flowState.ended = true;
        renderWalk();
      })
    );
  }
  for (const edge of optional) {
    secondary.appendChild(
      createActionButton("Optional Follow-Up", "roadside-btn-optional", () =>
        go(edge.to, "Optional Follow-Up")
      )
    );
  }

  if (primary.childElementCount) actionsEl.appendChild(primary);
  if (secondary.childElementCount) actionsEl.appendChild(secondary);

  const utilities = document.createElement("div");
  utilities.className = "roadside-actions-utilities";

  if (flowState.stack.length > 1) {
    utilities.appendChild(
      createActionButton("← Previous step", "roadside-btn-ghost", goBack)
    );
  }
  utilities.appendChild(
    createActionButton("Restart flow", "roadside-btn-ghost", () =>
      window.initRoadsideFlow()
    )
  );
  actionsEl.appendChild(utilities);
}

async function loadFlowData() {
  const url = chrome.runtime.getURL("AUNZRoadsideFlow/roadside-flow.json");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load roadside flow (${response.status})`);
  }
  return response.json();
}

window.initRoadsideFlow = async function initRoadsideFlow() {
  const typeEl = document.getElementById("roadsideNodeType");
  const textEl = document.getElementById("roadsideNodeText");
  const actionsEl = document.getElementById("roadsideActions");
  const pathSection = document.getElementById("roadsidePathSection");
  const pathListEl = document.getElementById("roadsidePathList");
  const copyBtn = document.getElementById("copyRoadsidePath");
  const copyNotice = document.getElementById("copyNotificationRoadside");
  const progressEl = document.getElementById("roadsideProgressFill");
  const cardEl = document.getElementById("roadsideCard");

  if (!typeEl || !textEl || !actionsEl || !pathSection || !pathListEl) return;

  try {
    const data = await loadFlowData();
    const startId = findStart(data);
    const { byId, outEdges } = buildGraph(data);
    const path = [];

    flowState = {
      data,
      byId,
      outEdges,
      path,
      stack: [startId],
      current: startId,
      ended: false,
      typeEl,
      textEl,
      actionsEl,
      pathSection,
      pathListEl,
      progressEl,
      cardEl,
      copyNotice,
    };

    if (copyBtn) {
      copyBtn.onclick = async () => {
        if (!flowState) return;
        const notes = formatCaseNotes(flowState.path);
        await navigator.clipboard.writeText(notes);
        if (copyNotice) showCopyNotice(copyNotice);
      };
    }

    renderWalk();
  } catch (error) {
    console.error("[Roadside Flow]", error);
    typeEl.className = "roadside-badge badge-note";
    typeEl.textContent = "Error";
    textEl.textContent = "Could not load roadside flow data.";
    actionsEl.innerHTML = "";
  }
};
