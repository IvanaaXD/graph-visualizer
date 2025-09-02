// ================= Theme & Accent =================
(function () {
  const root = document.documentElement;
  const THEME_KEY = "gv-theme";
  const ACCENT_KEY = "gv-accent";

  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
  root.setAttribute("data-theme", initialTheme);

  const savedAccent = localStorage.getItem(ACCENT_KEY) || "blue";
  root.setAttribute("data-accent", savedAccent);

  const toggleBtn = document.getElementById("theme-toggle");
  const accentSelect = document.getElementById("accent-select");

  function updateToggleIcon() {
    const t = root.getAttribute("data-theme");
    if (toggleBtn) {
      if (t === "dark") {
        toggleBtn.textContent = "☀️";
        toggleBtn.title = "Light mode";
        toggleBtn.setAttribute("aria-label", "Switch to light");
      } else {
        toggleBtn.textContent = "🌙";
        toggleBtn.title = "Dark mode";
        toggleBtn.setAttribute("aria-label", "Switch to dark");
      }
    }
  }
  function setTheme(t) {
    root.setAttribute("data-theme", t);
    localStorage.setItem(THEME_KEY, t);
    updateToggleIcon();
  }
  function setAccent(a) {
    root.setAttribute("data-accent", a);
    localStorage.setItem(ACCENT_KEY, a);
  }

  updateToggleIcon();
  if (accentSelect) accentSelect.value = savedAccent;
  if (toggleBtn) toggleBtn.addEventListener("click", () => setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  if (accentSelect) accentSelect.addEventListener("change", e => setAccent(e.target.value));
})();

// ================= Graph Interactions (pan/zoom/drag/tooltip) =================
(function () {
  const host = document.getElementById("main-host");
  if (!host) return;
  const svg = host.querySelector("svg.gv-svg");
  if (!svg) return;

  const viewport = svg.querySelector("g.viewport");
  const capture = svg.querySelector("rect.pz-capture");
  const nodes = Array.from(svg.querySelectorAll("g.nodes > g.node"));
  const edges = Array.from(svg.querySelectorAll("g.edges > line"));

  // Pan/Zoom state
  let k = 1;              // scale
  let tx = 0, ty = 0;     // translate
  const K_MIN = 0.2, K_MAX = 4;

  function applyTransform() {
    viewport.setAttribute("transform", `translate(${tx},${ty}) scale(${k})`);
  }

  // Client → SVG coords (outer)
  function clientToSvg(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
  }
  // Client → World coords (pre scale/translate)
  function clientToWorld(clientX, clientY) {
    const p = clientToSvg(clientX, clientY);
    return { x: (p.x - tx) / k, y: (p.y - ty) / k };
  }

  // ---------- PAN ----------
  let panning = false;
  let panStart = { x: 0, y: 0 };
  let panAt = { tx: 0, ty: 0 };

  function panStartHandler(e) {
    // Prevent panning when starting a drag gesture on a node
    if (e.target.closest("g.node")) return;
    panning = true;
    svg.classList.add("panning");
    panStart = { x: e.clientX, y: e.clientY };
    panAt = { tx, ty };
    e.preventDefault();
  }
  function panMoveHandler(e) {
    if (!panning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    tx = panAt.tx + dx;
    ty = panAt.ty + dy;
    applyTransform();
  }
  function panEndHandler() {
    panning = false;
    svg.classList.remove("panning");
  }

  (capture || svg).addEventListener("mousedown", panStartHandler);
  window.addEventListener("mousemove", panMoveHandler);
  window.addEventListener("mouseup", panEndHandler);

  // ---------- ZOOM (wheel, zoom-to-cursor) ----------
  svg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const { x: wx, y: wy } = clientToWorld(e.clientX, e.clientY);
  const delta = -e.deltaY; // up = zoom in
  const factor = Math.exp(delta * 0.0015);
  const newK = Math.min(K_MAX, Math.max(K_MIN, k * factor));

  // keep (wx, wy) under the cursor
  tx = tx - (wx * (newK - k));
  ty = ty - (wy * (newK - k));

  k = newK;
  applyTransform();
}, { passive: false });


  // ---------- DRAG NODES ----------
  // mapping: nodeId -> lines that start/end at that node
  const linesByNode = new Map();
  nodes.forEach(n => {
    const id = n.getAttribute("data-id");
    if (!id) return;
    const arr = [];
    edges.forEach(line => {
      if (line.getAttribute("data-from") === id || line.getAttribute("data-to") === id) {
        arr.push(line);
      }
    });
    linesByNode.set(id, arr);
  });

  let dragging = null;           // <g class="node">
  let dragWorldStart = { x: 0, y: 0 };
  let dragNodeStart = { x: 0, y: 0 };

  function getNodePosition(nodeG) {
    const tr = nodeG.getAttribute("transform"); // "translate(x,y)"
    const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(tr || "");
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }
  function setNodePosition(nodeG, x, y) {
    nodeG.setAttribute("transform", `translate(${x},${y})`);
  }
  function updateConnectedLines(nodeId, x, y) {
    const lines = linesByNode.get(nodeId) || [];
    lines.forEach(line => {
      if (line.getAttribute("data-from") === nodeId) {
        line.setAttribute("x1", x);
        line.setAttribute("y1", y);
      }
      if (line.getAttribute("data-to") === nodeId) {
        line.setAttribute("x2", x);
        line.setAttribute("y2", y);
      }
    });
  }

  nodes.forEach(nodeG => {
    nodeG.addEventListener("mousedown", (e) => {
      e.stopPropagation(); // prevent pan
      dragging = nodeG;
      nodeG.classList.add("dragging");
      dragWorldStart = clientToWorld(e.clientX, e.clientY);
      const p = getNodePosition(nodeG);
      dragNodeStart = { x: p.x, y: p.y };
      e.preventDefault();
    });
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const { x: wx, y: wy } = clientToWorld(e.clientX, e.clientY);
    const nx = dragNodeStart.x + (wx - dragWorldStart.x);
    const ny = dragNodeStart.y + (wy - dragWorldStart.y);
    setNodePosition(dragging, nx, ny);
    const id = dragging.getAttribute("data-id");
    if (id) updateConnectedLines(id, nx, ny);
  });

  window.addEventListener("mouseup", () => {
    if (dragging) dragging.classList.remove("dragging");
    dragging = null;
  });

  // ---------- TOOLTIP ----------
  const tooltip = document.createElement("div");
  tooltip.id = "gv-tooltip";
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);

  function showTooltip(e, nodeG) {
    const name = nodeG.getAttribute("data-name") || "";
    let attrs = {};
    try { attrs = JSON.parse(nodeG.getAttribute("data-attrs") || "{}"); }
    catch { attrs = {}; }

    let html = `<div class="t-title">${name}</div>`;
    const keys = Object.keys(attrs);
    if (keys.length) {
      html += `<div class="t-kv">`;
      keys.forEach(k => {
        html += `<span>${k}</span><span>${attrs[k]}</span>`;
      });
      html += `</div>`;
    }
    tooltip.innerHTML = html;
    tooltip.style.display = "block";

    const pad = 10;
    let x = e.clientX + pad, y = e.clientY + pad;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 6) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 6) y = e.clientY - rect.height - pad;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  function hideTooltip() {
    tooltip.style.display = "none";
  }

  nodes.forEach(nodeG => {
    nodeG.addEventListener("mouseenter", (e) => showTooltip(e, nodeG));
    nodeG.addEventListener("mousemove", (e) => showTooltip(e, nodeG));
    nodeG.addEventListener("mouseleave", hideTooltip);
  });

  applyTransform();
})();

window.openWorkspaceDialog = function () {
  document.getElementById("workspaceDialog").showModal();
};

window.closeWorkspaceDialog = function () {
  document.getElementById("workspaceDialog").close();
};

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("workspaceDialog");
  const addBtn = document.getElementById("workspaceAddBtn");
  const cancelBtn = document.getElementById("workspaceCancelBtn");

  addBtn.addEventListener("click", openWorkspaceDialog);
  cancelBtn.addEventListener("click", closeWorkspaceDialog);
});

// --------------- SWITCH VISUALZIERS ---------------

window.gvPositions = window.gvPositions || {};

function switchVisualizer(type) {
  const positions = {};
  document.querySelectorAll(".node, .block-node").forEach(n => {
    const transform = n.getAttribute("transform");
    if (transform) {
      const [x, y] = transform.match(/-?\d+(\.\d+)?/g).map(Number);
      positions[n.getAttribute("data-id")] = { x, y };
    }
  });

  fetch(`/switch-visualizer/${type}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken")
    },
    body: JSON.stringify({ positions })  
  })
  .then(r => r.json())
  .then(data => {
    const mainHost = document.getElementById("main-host");
    mainHost.innerHTML = data.html;

    if (window[data.visualizer + "Init"]) {
      window[data.visualizer + "Init"]();
    }
  })
  .catch(err => console.error("Switch failed:", err));
}

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + "=")) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function simpleInit() {
  const svg = document.querySelector(".gv-svg");
  if (!svg) return;

  let selectedNode = null;
  let offset = [0, 0];

  function updateEdges(node) {
    const nodeId = node.getAttribute("data-id");
    const transform = node.getAttribute("transform");
    if (!transform) return;
    const [x, y] = transform.match(/-?\d+(\.\d+)?/g).map(Number);

    document.querySelectorAll(`.edges line[data-from="${nodeId}"]`).forEach(line => {
      line.setAttribute("x1", x);
      line.setAttribute("y1", y);
    });
    document.querySelectorAll(`.edges line[data-to="${nodeId}"]`).forEach(line => {
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
    });

    window.gvPositions[nodeId] = { x, y }; 
  }

  svg.querySelectorAll(".node").forEach(node => {
    const circle = node.querySelector("circle");
    circle.addEventListener("mousedown", e => {
      selectedNode = node;
      const [x, y] = node.getAttribute("transform").match(/-?\d+(\.\d+)?/g).map(Number);
      offset = [e.clientX - x, e.clientY - y];
      node.classList.add("dragging");
    });
  });

  document.addEventListener("mousemove", e => {
    if (selectedNode) {
      const x = e.clientX - offset[0];
      const y = e.clientY - offset[1];
      selectedNode.setAttribute("transform", `translate(${x},${y})`);
      updateEdges(selectedNode);
    }
  });

  document.addEventListener("mouseup", () => {
    if (selectedNode) {
      selectedNode.classList.remove("dragging");
      selectedNode = null;
    }
  });
}

function blockInit() {
  const svg = document.querySelector(".gv-svg");
  if (!svg) return;

  let selectedNode = null;
  let offset = [0, 0];

  function updateEdges(node) {
    const nodeId = node.getAttribute("data-id");
    const transform = node.getAttribute("transform");
    if (!transform) return;
    const [x, y] = transform.match(/-?\d+(\.\d+)?/g).map(Number);

    svg.querySelectorAll(`.edges line[data-from="${nodeId}"], .edges line[data-to="${nodeId}"]`)
      .forEach(line => {
        const fromNode = svg.querySelector(`.block-node[data-id="${line.getAttribute("data-from")}"]`);
        const toNode = svg.querySelector(`.block-node[data-id="${line.getAttribute("data-to")}"]`);
        if (fromNode && toNode) {
          const [fx, fy] = fromNode.getAttribute("transform").match(/-?\d+(\.\d+)?/g).map(Number);
          const [tx, ty] = toNode.getAttribute("transform").match(/-?\d+(\.\d+)?/g).map(Number);
          line.setAttribute("x1", fx);
          line.setAttribute("y1", fy);
          line.setAttribute("x2", tx);
          line.setAttribute("y2", ty);
        }
      });

    window.gvPositions[nodeId] = { x, y };
  }

  svg.querySelectorAll(".block-node").forEach(node => {
    const rect = node.querySelector(".block-rect");
    rect.addEventListener("mousedown", e => {
      selectedNode = node;
      const [x, y] = node.getAttribute("transform").match(/-?\d+(\.\d+)?/g).map(Number);
      offset = [e.clientX - x, e.clientY - y];
      node.classList.add("dragging");
    });
  });

  document.addEventListener("mousemove", e => {
    if (selectedNode) {
      const x = e.clientX - offset[0];
      const y = e.clientY - offset[1];
      selectedNode.setAttribute("transform", `translate(${x},${y})`);
      updateEdges(selectedNode);
    }
  });

  document.addEventListener("mouseup", () => {
    if (selectedNode) {
      selectedNode.classList.remove("dragging");
      selectedNode = null;
    }
  });
}
