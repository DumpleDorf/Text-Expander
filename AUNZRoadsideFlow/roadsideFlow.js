/**
 * AUNZ Roadside Flow walkthrough (in-popup).
 * Data: AUNZRoadsideFlow/roadside-flow.json
 */

let flowState = null;

function pathNote(node, choice) {
  if (!choice) return node.text;
  return `${node.text}: ${choice}`;
}

function formatCaseNotes(title, pathSteps) {
  const lines = [title, ""];
  pathSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  return lines.join("\n").trim();
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

function updatePathDisplay(pathEl, pathSteps) {
  pathEl.textContent = pathSteps.length
    ? pathSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")
    : "No steps yet.";
}

function showCopyNotice(el) {
  el.textContent = "Copied!";
  el.classList.add("show");
  setTimeout(() => {
    el.classList.remove("show");
    el.textContent = "";
  }, 1500);
}

function renderWalk() {
  if (!flowState) return;

  const {
    data,
    byId,
    outEdges,
    path,
    typeEl,
    textEl,
    actionsEl,
    pathEl,
    pathSection,
  } = flowState;

  actionsEl.innerHTML = "";
  pathSection.style.display = path.length ? "block" : "none";
  updatePathDisplay(pathEl, path);

  if (flowState.ended) {
    typeEl.textContent = "END";
    textEl.textContent = "End Flow";
    const restart = document.createElement("button");
    restart.textContent = "Restart";
    restart.addEventListener("click", () => window.initRoadsideFlow());
    actionsEl.appendChild(restart);
    return;
  }

  const node = byId[flowState.current];
  if (!node) return;

  typeEl.textContent = node.type.toUpperCase();
  textEl.textContent = node.text;

  const edges = outEdges[flowState.current] || [];
  const yes = edges.find((e) => e.kind === "yes");
  const no = edges.find((e) => e.kind === "no");
  const flow = edges.filter((e) => e.kind === "flow");
  const optional = edges.filter((e) => e.kind === "optional");
  const canEnd = !yes && !no && !flow.length;

  const go = (id, label) => {
    path.push(pathNote(node, label));
    flowState.current = id;
    renderWalk();
  };

  if (yes) {
    const btn = document.createElement("button");
    btn.className = "roadside-btn-yes";
    btn.textContent = "Yes";
    btn.addEventListener("click", () => go(yes.to, "Yes"));
    actionsEl.appendChild(btn);
  }

  if (no) {
    const btn = document.createElement("button");
    btn.className = "roadside-btn-no";
    btn.textContent = "No";
    btn.addEventListener("click", () => go(no.to, "No"));
    actionsEl.appendChild(btn);
  }

  for (const edge of flow) {
    const btn = document.createElement("button");
    btn.textContent = "Continue";
    btn.addEventListener("click", () => go(edge.to, "Continue"));
    actionsEl.appendChild(btn);
  }

  if (canEnd) {
    const endBtn = document.createElement("button");
    endBtn.className = "roadside-btn-end";
    endBtn.textContent = "End Flow";
    endBtn.addEventListener("click", () => {
      path.push(pathNote(node, "End Flow"));
      flowState.ended = true;
      renderWalk();
    });
    actionsEl.appendChild(endBtn);
  }

  for (const edge of optional) {
    const btn = document.createElement("button");
    btn.className = "roadside-btn-optional";
    btn.textContent = "Optional Follow-Up";
    btn.addEventListener("click", () => go(edge.to, "Optional Follow-Up"));
    actionsEl.appendChild(btn);
  }

  const restart = document.createElement("button");
  restart.className = "roadside-btn-secondary";
  restart.textContent = "Restart";
  restart.addEventListener("click", () => window.initRoadsideFlow());
  actionsEl.appendChild(restart);
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
  const pathEl = document.getElementById("roadsidePathText");
  const pathSection = document.getElementById("roadsidePathSection");
  const copyBtn = document.getElementById("copyRoadsidePath");
  const copyNotice = document.getElementById("copyNotificationRoadside");

  if (!typeEl || !textEl || !actionsEl || !pathEl || !pathSection) return;

  try {
    const data = await loadFlowData();
    const { byId, outEdges } = buildGraph(data);
    const path = [];

    flowState = {
      data,
      byId,
      outEdges,
      path,
      current: findStart(data),
      ended: false,
      typeEl,
      textEl,
      actionsEl,
      pathEl,
      pathSection,
    };

    if (copyBtn) {
      copyBtn.onclick = async () => {
        if (!flowState) return;
        const notes = formatCaseNotes(flowState.data.title, flowState.path);
        await navigator.clipboard.writeText(notes);
        if (copyNotice) showCopyNotice(copyNotice);
      };
    }

    renderWalk();
  } catch (error) {
    console.error("[Roadside Flow]", error);
    typeEl.textContent = "ERROR";
    textEl.textContent = "Could not load roadside flow data.";
    actionsEl.innerHTML = "";
  }
};
