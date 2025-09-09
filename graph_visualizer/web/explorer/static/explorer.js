window.gvCurrentVisualizer = "simple";

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
  const bg = svg.querySelector("rect.pz-capture"); 
  if (bg) bg.addEventListener("click", () => setSelected(null)); 

  // --- Arrow trim helpers ---
  const GV_R = 16;        
  const GV_ARROW = 6;     
  const GV_TRIM = GV_R + GV_ARROW;

  function parseXY(tr) {
    const m = (tr || "").match(/-?\d+(\.\d+)?/g);
    return m && m.length >= 2 ? [Number(m[0]), Number(m[1])] : [0, 0];
  }
  function shorten(x1, y1, x2, y2, off) {
    const dx = x2 - x1, dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    return [x1 + ux * off, y1 + uy * off, x2 - ux * off, y2 - uy * off];
  }

  if (!viewport) return;

  // --- Pan/Zoom State ---
  let k = 1, tx = 0, ty = 0;
  const K_MIN = 0.2, K_MAX = 4;

  function applyTransform() {
    viewport.setAttribute("transform", `translate(${tx},${ty}) scale(${k})`);
      refreshBird();
  }

  // --- Client -> World coordinates ---

  function clientToSvg(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
  }
  function clientToWorld(clientX, clientY) {
    const p = clientToSvg(clientX, clientY);
    return { x: (p.x - tx) / k, y: (p.y - ty) / k };
  }

  // --- Pan ---
  const panState = { active: false, startX: 0, startY: 0 };
  svg.addEventListener("pointerdown", e => {
    if (e.target.closest("g.node")) return; // node drag
    panState.active = true;
    panState.startX = e.clientX - tx;
    panState.startY = e.clientY - ty;
    svg.setPointerCapture(e.pointerId);
    svg.style.cursor = "grab";
  });
  svg.addEventListener("pointermove", e => {
    if (!panState.active) return;
    tx = e.clientX - panState.startX;
    ty = e.clientY - panState.startY;
    applyTransform();
  });
  svg.addEventListener("pointerup", e => {
    panState.active = false;
    svg.releasePointerCapture(e.pointerId);
    svg.style.cursor = "default";
  });

  // --- Zoom ---
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const { x: wx, y: wy } = clientToWorld(e.clientX, e.clientY);
    const delta = -e.deltaY;
    const factor = Math.exp(delta * 0.0015);
    const newK = Math.min(K_MAX, Math.max(K_MIN, k * factor));
    tx = tx - (wx * (newK - k));
    ty = ty - (wy * (newK - k));
    k = newK;
    applyTransform();
  }, { passive: false });

  // --- Node Drag ---
const nodes = Array.from(svg.querySelectorAll(`g.nodes > ${getNodeSelector()}`));
  let dragged = false;
  window.gvSelect = (id, opts) => focusNodeById(id, opts || {});

  const edges = Array.from(svg.querySelectorAll("g.edges > line"));

  // map nodeId -> connected lines
  const linesByNode = new Map();
  nodes.forEach(n => {
    const id = n.getAttribute("data-id");
    if (!id) return;
    const arr = edges.filter(l => l.getAttribute("data-from") === id || l.getAttribute("data-to") === id);
    linesByNode.set(id, arr);
  });
  nodes.forEach(n => updateConnectedLines(n.getAttribute("data-id")));

function getNodeSelector() {
  return window.gvCurrentVisualizer === "block" ? "g.block-node" : "g.node";
}

function setSelected(nodeOrId) {
  const svgRoot = document.querySelector(".gv-svg");
  if (!svgRoot) return;

  const allNodes = svgRoot.querySelectorAll(".node, .block-node");
  const allEdges = svgRoot.querySelectorAll(".edges line");
  allNodes.forEach(n => n.classList.remove("selected", "dim"));
  allEdges.forEach(l => l.classList.remove("active", "dim"));

  if (!nodeOrId) {
    if (typeof window.selectInTree === "function") window.selectInTree(null);
    return;
  }
  let node;
  if (typeof nodeOrId === "string") {
    node = svgRoot.querySelector(`${getNodeSelector()}[data-id="${nodeOrId}"]`);
  } else {
    node = nodeOrId;
  }
  if (!node) return;

  node.classList.add("selected");
  const id = node.getAttribute("data-id");

  const connected = Array.from(svgRoot.querySelectorAll(`.edges line[data-from="${id}"], .edges line[data-to="${id}"]`));

  allNodes.forEach(n => { if (n !== node) n.classList.add("dim"); });
  allEdges.forEach(l => { if (!connected.includes(l)) l.classList.add("dim"); });
  connected.forEach(l => l.classList.add("active"));

  if (typeof svgRoot.updateConnectedLines === "function") {
    svgRoot.updateConnectedLines(id);
  }

  if (typeof window.selectInTree === "function") {
    window.selectInTree(id);
  }
}
window.setSelected = setSelected;

function updateConnectedLines(nodeId) {
  const svg = document.querySelector(".gv-svg");
  if (!svg) return;
  const nodeSel = getNodeSelector();

  const getNode = id => svg.querySelector(`${nodeSel}[data-id="${id}"]`);
  const connectedLines = Array.from(svg.querySelectorAll(`.edges line[data-from="${nodeId}"], .edges line[data-to="${nodeId}"]`));

  connectedLines.forEach(line => {
    const a = line.getAttribute("data-from");
    const b = line.getAttribute("data-to");
    const ga = getNode(a), gb = getNode(b);
    if (!ga || !gb) return;

    const [x1, y1] = (ga.getAttribute("transform") || "").match(/-?\d+(\.\d+)?/g).map(Number);
    const [x2, y2] = (gb.getAttribute("transform") || "").match(/-?\d+(\.\d+)?/g).map(Number);

    let sx1, sy1, sx2, sy2;
    if (window.gvCurrentVisualizer === "block") {
      const nodeA = ga;
      const nodeB = gb;

      const rectA = nodeA.querySelector(".block-rect");
      const rectB = nodeB.querySelector(".block-rect");
      const widthA = rectA ? parseFloat(rectA.getAttribute("width")) : 120;
      const heightA = rectA ? parseFloat(rectA.getAttribute("height")) : 40;
      const widthB = rectB ? parseFloat(rectB.getAttribute("width")) : 120;
      const heightB = rectB ? parseFloat(rectB.getAttribute("height")) : 40;

      const arrowPad = 6;

      [sx1, sy1, sx2, sy2] = shortenBlock(
        x1, y1, x2, y2,
        Math.max(widthA, widthB),
        Math.max(heightA, heightB),
        arrowPad
      );
      } else {
        [sx1, sy1, sx2, sy2] = shorten(x1, y1, x2, y2, 22); 
        
      }

      line.setAttribute("x1", sx1.toFixed(2));
      line.setAttribute("y1", sy1.toFixed(2));
      line.setAttribute("x2", sx2.toFixed(2));
      line.setAttribute("y2", sy2.toFixed(2));
    });
}

window.focusNodeById = function(nodeId, opts = {}) {
  const node = document.querySelector(`.nodes > ${getNodeSelector()}[data-id="${nodeId}"]`);
  if (!node) return;

  const [nx, ny] = (node.getAttribute("transform") || "translate(0,0)")
    .match(/-?\d+(\.\d+)?/g).map(Number);

  const svg = document.querySelector(".gv-svg");
  if (!svg) return;

  const targetK = Math.max(opts.scale ?? 1.2, window.gvPanZoom?.scale || 1);
  const cx = svg.clientWidth / 2;
  const cy = svg.clientHeight / 2;

  // world -> screen: screen = k*world + t  =>  t = center - k*world
  window.gvPanZoom.scale = Math.min(Math.max(targetK, 0.2), 4);
  window.gvPanZoom.x = cx - window.gvPanZoom.scale * nx;
  window.gvPanZoom.y = cy - window.gvPanZoom.scale * ny;

  const container = svg.querySelector("g.viewport");
  if (container) {
    container.setAttribute("transform", `translate(${window.gvPanZoom.x},${window.gvPanZoom.y}) scale(${window.gvPanZoom.scale})`);
  }

  setSelected(node);

  if (typeof updateConnectedLines === "function") {
    updateConnectedLines(nodeId);
  }
}

  let draggingNode = null;
  let dragOffset = { x: 0, y: 0 };

  function getNodePos(node) {
    const tr = node.getAttribute("transform") || "";
    const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(tr);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }
  function setNodePos(node, x, y) {
    node.setAttribute("transform", `translate(${x},${y})`);
  }

  nodes.forEach(node => {
    const circle = node.querySelector("circle");
    if (!circle) return;
    circle.addEventListener("pointerdown", e => {
      e.stopPropagation();
      dragged = false;                       
      draggingNode = node;
      const pos = getNodePos(node);
      dragOffset.x = e.clientX - pos.x;
      dragOffset.y = e.clientY - pos.y;
      node.classList.add("dragging");
      svg.setPointerCapture(e.pointerId);
    });
    node.addEventListener("click", e => {  
      e.stopPropagation();
      focusNodeById(node.getAttribute("data-id"), { scale: 1.6 }); 
    });

  });

  svg.addEventListener("pointermove", e => {
    if (!draggingNode) return;
     dragged = true; 
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    setNodePos(draggingNode, x, y);
    updateConnectedLines(draggingNode.getAttribute("data-id"));
  });

  svg.addEventListener("pointerup", e => {
    if (draggingNode) {
      draggingNode.classList.remove("dragging");
      if (!dragged) setSelected(draggingNode);  
      draggingNode = null;
      return;
    }
  
    setSelected(null);                          
  });


  // --- Tooltip Hover ---
  const tooltip = document.createElement("div");
  tooltip.id = "gv-tooltip";
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);

  nodes.forEach(node => {
    const circle = node.querySelector("circle");
    if (!circle) return;

    function showTip(e) {
      const name = node.getAttribute("data-name") || "";
      let attrs = {};
      try { attrs = JSON.parse(node.getAttribute("data-attrs") || "{}"); } catch {}
      let html = `<div class="t-title">${name}</div>`;
      if (Object.keys(attrs).length) {
        html += `<div class="t-kv">`;
        for (const k in attrs) html += `<span>${k}</span><span>${attrs[k]}</span>`;
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

    node.addEventListener("pointerenter", showTip);
    node.addEventListener("pointermove", showTip);
    node.addEventListener("pointerleave", () => { tooltip.style.display = "none"; });
  });

  applyTransform();
})();

window.openWorkspaceDialog = function () {
    const dialog = document.getElementById("workspaceDialog");
    if (dialog) dialog.showModal();
};

window.closeWorkspaceDialog = function () {
    const dialog = document.getElementById("workspaceDialog");
    if (dialog) dialog.close();
};

document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("workspaceAddBtn");
  const cancelBtn = document.getElementById("workspaceCancelBtn");
  
  if(addBtn) addBtn.addEventListener("click", openWorkspaceDialog);
  if(cancelBtn) cancelBtn.addEventListener("click", closeWorkspaceDialog);

  const mainHost = document.getElementById("main-host"); 
  const type = mainHost?.dataset.visualizer || "simple";
  window.gvCurrentVisualizer = type; 
});

// --------------- SWITCH VISUALZIERS ---------------

window.gvPositions = window.gvPositions || {};
window.gvCurrentVisualizer = "simple";

function switchVisualizer(type, btn) {
  window.gvCurrentVisualizer = type;

  const selectedNode = document.querySelector(".node.selected, .block-node.selected");
  const selectedId = selectedNode ? selectedNode.getAttribute("data-id") : null;

  const positions = {};
  document.querySelectorAll(".node, .block-node").forEach(n => {
    const tr = n.getAttribute("transform") || "";
    const m = tr.match(/-?\d+(\.\d+)?/g);
    if (m && m.length >= 2) positions[n.getAttribute("data-id")] = { x: Number(m[0]), y: Number(m[1]) };
  });

  updatePrimaryButton(btn);

  fetch(`/switch-visualizer/${type}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
    body: JSON.stringify({ positions })
  })
  .then(r => r.json())
  .then(data => {
    const mainHost = document.getElementById("main-host");
    if (!mainHost) return;

    mainHost.innerHTML = data.html;

    const svg = mainHost.querySelector(".gv-svg");
    if (!svg) return;

    window.draggingNode = null;
    window.dragOffset = { x: 0, y: 0 };

    enablePanZoom(svg);
    bindNodes(svg);
    bindNodeHoverAndTooltip(svg);

    if (type === "simple") simpleInit();
    if (type === "block") blockInit();

    const searchInput = document.getElementById("search-visualizer");
    if (searchInput) searchInput.value = type;

    refreshBird();

    if (selectedId) {
      if (typeof window.gvSelect === "function") {
        window.gvSelect(selectedId, { scale: 1.6 });
      } else if (typeof window.focusNodeById === "function") {
        window.focusNodeById(selectedId, { scale: 1.6 });
      }
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

function updatePrimaryButton(activeBtn) {
  document.querySelectorAll(".btn-group .btn").forEach(btn => {
    btn.classList.remove("primary");
  });
  activeBtn.classList.add("primary");
}

function bindNodes(svg) {
  const nodes = svg.querySelectorAll(window.gvCurrentVisualizer === "block" ? ".block-node" : ".node");

  nodes.forEach(node => {
    const circle = node.querySelector("circle") || node.querySelector(".block-rect");
    if (!circle) return;

    circle.addEventListener("pointerdown", e => {
      e.stopPropagation();
      window.draggingNode = node;
      const tr = node.getAttribute("transform") || "translate(0,0)";
      const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(tr);
      window.dragOffset.x = e.clientX - (m ? parseFloat(m[1]) : 0);
      window.dragOffset.y = e.clientY - (m ? parseFloat(m[2]) : 0);
      node.classList.add("dragging");
    });

    node.addEventListener("dblclick", e => {
      e.stopPropagation();
      setSelected(node);
    });

    node.addEventListener("mouseenter", () => {
      node.classList.add("hovered");
      circle.style.cursor = "grab";
    });
    node.addEventListener("mouseleave", () => {
      node.classList.remove("hovered");
      circle.style.cursor = "default";
    });
  });
}

document.addEventListener("pointermove", e => {
  if (!window.draggingNode) return;
  const x = e.clientX - window.dragOffset.x;
  const y = e.clientY - window.dragOffset.y;
  window.draggingNode.setAttribute("transform", `translate(${x},${y})`);

  const svg = document.querySelector(".gv-svg");
  if (svg && typeof svg.updateConnectedLines === "function") {
    svg.updateConnectedLines(window.draggingNode.getAttribute("data-id"));
  }});

document.addEventListener("pointerup", () => {
  if (window.draggingNode) {
    window.draggingNode.classList.remove("dragging");
    setSelected(window.draggingNode);
    window.draggingNode = null;
  }
});

function simpleInit() {
  const svg = document.querySelector(".gv-svg");
  if (!svg) return;

  const bg = svg.querySelector("rect.pz-capture");
  if (bg) {
    bg.addEventListener("click", () => setSelected(null));
  }

  let selectedNode = null;
  let offset = [0, 0];

  svg.updateConnectedLines = function(nodeId) {
    const node = svg.querySelector(`.node[data-id="${nodeId}"]`);
    if (!node) return;

    const transform = node.getAttribute("transform");
    if (!transform) return;
    const [x, y] = transform.match(/-?\d+(\.\d+)?/g).map(Number);

    svg.querySelectorAll(`.edges line[data-from="${nodeId}"]`).forEach(line => {
      line.setAttribute("x1", x);
      line.setAttribute("y1", y);
    });
    svg.querySelectorAll(`.edges line[data-to="${nodeId}"]`).forEach(line => {
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
    });

    window.gvPositions[nodeId] = { x, y };
    refreshBird();
  };

  svg.querySelectorAll(".node").forEach(node => {
    const circle = node.querySelector("circle");

    node.addEventListener("mouseenter", () => {
      node.classList.add("hovered");
      circle.style.cursor = "grab";
    });
    node.addEventListener("mouseleave", () => {
      node.classList.remove("hovered");
      circle.style.cursor = "default";
    });

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
      svg.updateConnectedLines(selectedNode.getAttribute("data-id"));
    }
  });

  document.addEventListener("mouseup", () => {
    if (selectedNode) {
      selectedNode.classList.remove("dragging");
      selectedNode = null;
    }
  });

  enablePanZoom(svg);
}

function blockInit() {
  const svg = document.querySelector(".gv-svg");
  if (!svg) return;

  const bg = svg.querySelector("rect.pz-capture");
  if (bg) {
    bg.addEventListener("click", () => setSelected(null));
  }

  window.gvPanZoom = window.gvPanZoom || {
    x: 0, y: 0, scale: 1,
    svg: svg,
    container: svg.querySelector("g.viewport"),
    isPanning: false,
    start: { x: 0, y: 0 }
  };

  const nodes = svg.querySelectorAll(".block-node");
  let selectedNode = null;
  let offset = { x: 0, y: 0 };

  function getNodePos(node) {
    const tr = node.getAttribute("transform") || "";
    const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(tr);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  function setNodePos(node, x, y) {
    node.setAttribute("transform", `translate(${x},${y})`);
  }

  function shortenBlock(x1, y1, x2, y2, nodeWidth = 120, nodeHeight = 40, arrowPad = 6) {
    const dx = x2 - x1, dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const offsetX = (nodeWidth / 2 + arrowPad) * Math.abs(ux);
    const offsetY = (nodeHeight / 2 + arrowPad) * Math.abs(uy);
    return [
      x1 + ux * offsetX,
      y1 + uy * offsetY,
      x2 - ux * offsetX,
      y2 - uy * offsetY
    ];
  }

  svg.updateConnectedLines = function(nodeId) {
    const node = svg.querySelector(`.block-node[data-id="${nodeId}"]`);
    if (!node) return;

    const { x, y } = getNodePos(node);

    svg.querySelectorAll(`.edges line[data-from="${nodeId}"]`).forEach(line => {
      const toNode = svg.querySelector(`.block-node[data-id="${line.dataset.to}"]`);
      if (!toNode) return;
      const { x: tx, y: ty } = getNodePos(toNode);
      const [nx1, ny1, nx2, ny2] = shortenBlock(x, y, tx, ty);
      line.setAttribute("x1", nx1);
      line.setAttribute("y1", ny1);
      line.setAttribute("x2", nx2);
      line.setAttribute("y2", ny2);
    });

    svg.querySelectorAll(`.edges line[data-to="${nodeId}"]`).forEach(line => {
      const fromNode = svg.querySelector(`.block-node[data-id="${line.dataset.from}"]`);
      if (!fromNode) return;
      const { x: fx, y: fy } = getNodePos(fromNode);
      const [nx1, ny1, nx2, ny2] = shortenBlock(fx, fy, x, y);
      line.setAttribute("x1", nx1);
      line.setAttribute("y1", ny1);
      line.setAttribute("x2", nx2);
      line.setAttribute("y2", ny2);
    });

    window.gvPositions[nodeId] = { x, y };
    refreshBird();
  };

  nodes.forEach(node => {
    node.addEventListener("mouseenter", () => {
      node.classList.add("hovered");
      node.style.cursor = "grab";
    });
    node.addEventListener("mouseleave", () => {
      node.classList.remove("hovered");
      node.style.cursor = "default";
    });

    node.addEventListener("mousedown", e => {
      selectedNode = node;
      const { x, y } = getNodePos(node);
      offset.x = e.clientX - x;
      offset.y = e.clientY - y;
      node.classList.add("dragging");
      setSelected(node);
    });
  });

  document.addEventListener("mousemove", e => {
    if (selectedNode) {
      const x = e.clientX - offset.x;
      const y = e.clientY - offset.y;
      setNodePos(selectedNode, x, y);
      svg.updateConnectedLines(selectedNode.getAttribute("data-id"));
    }
  });

  document.addEventListener("mouseup", () => {
    if (selectedNode) {
      selectedNode.classList.remove("dragging");
      selectedNode = null;
    }
  });

  enablePanZoom(svg);
}

function enablePanZoom(svg) {
  if (!svg) return;

  window.gvPanZoom = window.gvPanZoom || {
    x: 0,
    y: 0,
    scale: 1,
    svg: null,
    container: null,
    isPanning: false,
    start: { x: 0, y: 0 }
  };

  const container = svg.querySelector("g.viewport");
  if (!container) return;

  window.gvPanZoom.svg = svg;
  window.gvPanZoom.container = container;

  function updateTransform() {
    const { x, y, scale, container } = window.gvPanZoom;
    if (container) container.setAttribute("transform", `translate(${x},${y}) scale(${scale})`);
  }

  if (!enablePanZoom.bound) {
    document.addEventListener("mousedown", e => {
      const { svg } = window.gvPanZoom;
      if (!svg) return;
      if (e.button === 1 || e.button === 2 || e.shiftKey) {
        window.gvPanZoom.isPanning = true;
        window.gvPanZoom.start = { x: e.clientX - window.gvPanZoom.x, y: e.clientY - window.gvPanZoom.y };
        svg.style.cursor = "grab";
        e.preventDefault();
      }
    });

    document.addEventListener("mousemove", e => {
      if (window.gvPanZoom.isPanning) {
        window.gvPanZoom.x = e.clientX - window.gvPanZoom.start.x;
        window.gvPanZoom.y = e.clientY - window.gvPanZoom.start.y;
        updateTransform();
      }
    });

    document.addEventListener("mouseup", () => {
      if (window.gvPanZoom.isPanning) {
        window.gvPanZoom.isPanning = false;
        if (window.gvPanZoom.svg) window.gvPanZoom.svg.style.cursor = "default";
      }
    });

    document.addEventListener("wheel", e => {
      const { svg } = window.gvPanZoom;
      if (!svg) return;
      e.preventDefault();
      const scaleFactor = 1.1;
      if (e.ctrlKey) {
        window.gvPanZoom.scale *= e.deltaY < 0 ? scaleFactor : 1 / scaleFactor;
      } else {
        window.gvPanZoom.x -= e.deltaX;
        window.gvPanZoom.y -= e.deltaY;
      }
      updateTransform();
    }, { passive: false });

    enablePanZoom.bound = true;
  }

  updateTransform();
}

function bindNodeHoverAndTooltip(svg) {
  if (!svg) return;
  
  const tooltip = document.getElementById("gv-tooltip") || (() => {
    const t = document.createElement("div");
    t.id = "gv-tooltip";
    t.style.display = "none";
    document.body.appendChild(t);
    return t;
  })();

  svg.querySelectorAll(".node").forEach(nodeG => {
    const circle = nodeG.querySelector("circle");
    if (!circle) return;

    nodeG.addEventListener("mouseenter", () => {
      nodeG.classList.add("hovered");
      circle.style.cursor = "grab";
    });
    nodeG.addEventListener("mouseleave", () => {
      nodeG.classList.remove("hovered");
      circle.style.cursor = "default";
      tooltip.style.display = "none";
    });

    function showTooltip(e) {
      const name = nodeG.getAttribute("data-name") || "";
      let attrs = {};
      try { attrs = JSON.parse(nodeG.getAttribute("data-attrs") || "{}"); } catch {}
      
      let html = `<div class="t-title">${name}</div>`;
      const keys = Object.keys(attrs);
      if (keys.length) {
        html += `<div class="t-kv">`;
        keys.forEach(k => html += `<span>${k}</span><span>${attrs[k]}</span>`);
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

    nodeG.addEventListener("mousemove", showTooltip);
    nodeG.addEventListener("mouseenter", showTooltip);
  });
}

 // --------------- SEARCH AND FILTER --------------

document.addEventListener("DOMContentLoaded", () => {
  const mainHost = document.getElementById("main-host");
  const type = mainHost?.dataset.visualizer || "simple";
  window.gvCurrentVisualizer = type;

  document.querySelectorAll(".btn-group .btn").forEach(btn => btn.classList.remove("primary"));
  const activeBtn = document.querySelector(`.btn-group .btn[data-visualizer="${type}"]`);
  if (activeBtn) activeBtn.classList.add("primary");

  document.querySelectorAll('form[action="/search"], form[action="/filter"]').forEach(form => {
    form.addEventListener("submit", () => {
      let input = form.querySelector('input[name="visualizer"]');
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = "visualizer";
        form.appendChild(input);
      }
      input.value = window.gvCurrentVisualizer;
    });
  });
});

 // -------------- TREE VIEW --------------

document.addEventListener("click", function(e) {
  if (e.target.classList.contains("toggle")) {
    const nested = e.target.closest("li").querySelector(".nested");
    if (nested) {
      nested.classList.toggle("active");
      e.target.textContent = nested.classList.contains("active") ? "−" : "+";
    }
  }
});

function showNodeDropdown(nodeId, event) {
  event.stopPropagation(); 
  const existing = document.querySelector(".node-dropdown");
  if (existing) existing.remove();

  const dropdown = document.createElement("div");
  dropdown.className = "node-dropdown";
  dropdown.innerHTML = `
    <p><strong>Node:</strong> ${nodeId}</p>
    <button onclick="alert('Details for ${nodeId}')">Details</button>
    <button onclick="alert('Remove ${nodeId}')">Remove</button>
  `;

  dropdown.style.position = "absolute";
  dropdown.style.left = event.pageX + "px";
  dropdown.style.top = event.pageY + "px";
  dropdown.style.background = "#fff";
  dropdown.style.border = "1px solid #ccc";
  dropdown.style.padding = "6px";
  dropdown.style.borderRadius = "4px";
  dropdown.style.zIndex = "9999";

  document.body.appendChild(dropdown);

  document.addEventListener("click", function close(e) {
    if (!dropdown.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener("click", close);
    }
  });
}

window.selectInTree = function(nodeId) {
  const tree = document.querySelector(".component-tree");
  if (!tree) return;

  tree.querySelectorAll("li.tree-selected").forEach(li => li.classList.remove("tree-selected"));

  if (!nodeId) return; 

  const li = tree.querySelector(`li[data-node-id="${CSS.escape(String(nodeId))}"]`);
  if (!li) return;

  li.classList.add("tree-selected");

  const header = li.querySelector(".node-header");
  if (header) header.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
};

document.addEventListener("click", function(e) {
  const label = e.target.closest(".component-tree .tree-label");
  if (!label) return;

  const li = label.closest('li[data-node-id]');
  if (!li) return;

  const id = li.getAttribute("data-node-id");
  if (typeof window.gvSelect === "function") {
    window.gvSelect(id, { scale: 1.6 });
  } else if (typeof window.focusNodeById === "function") {
    window.focusNodeById(id, { scale: 1.6 });
  }
  e.stopPropagation();
});

 // -------------- BIRD VIEW ------------

function refreshBird() {
  if (!window.gvPanZoom) return;

  const svg = document.querySelector("#main-host svg");
  if (!svg) return;

  const viewport = {
    x: -window.gvPanZoom.x / window.gvPanZoom.scale,
    y: -window.gvPanZoom.y / window.gvPanZoom.scale,
    width: svg.clientWidth / window.gvPanZoom.scale,
    height: svg.clientHeight / window.gvPanZoom.scale
  };

  const positions = {};
  document.querySelectorAll(".node, .block-node").forEach(n => {
    const transform = n.getAttribute("transform") || "";
    const m = transform.match(/-?\d+(\.\d+)?/g);
    if (m && m.length >= 2) {
      const [x, y] = m.map(Number);
      positions[n.getAttribute("data-id")] = [x, y];
    }
  });

  const visualizer = window.gvCurrentVisualizer || "simple";

  fetch("/bird-render/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken")
    },
    body: JSON.stringify({ viewport, positions, visualizer })
  })
  .then(r => r.json())
  .then(data => {
    const birdHost = document.querySelector(".panel-body.bird");
    if (birdHost && data.html) birdHost.innerHTML = data.html;
  })
  .catch(err => console.error("Bird refresh failed:", err));
}

window.addEventListener("load", () => {
  refreshBird();
});
// --- CLI LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const cliContainer = document.getElementById('cli-container');
    const toggleButton = document.getElementById('terminal-toggle-btn');
    const cliOutput = document.getElementById('cli-output');
    const cliInput = document.getElementById('cli-input');
    const graphContainer = document.getElementById('graph-container');

    const commandHistory = [];
    let historyIndex = -1;
    
    // --- Terminal display logic ---
    toggleButton.addEventListener('click', () => {
        cliContainer.classList.toggle('open');
        if (cliContainer.classList.contains('open')) {
            cliInput.focus();
        }
    });

    // --- Command entry logic ---
    cliInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && cliInput.value.trim() !== '') {
            const commandText = cliInput.value.trim();
            commandHistory.push(commandText);
            historyIndex = commandHistory.length;
            
            logToOutput(commandText);
            processCommand(commandText);
            cliInput.value = '';
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                cliInput.value = commandHistory[historyIndex];
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                cliInput.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                cliInput.value = '';
            }
            e.preventDefault();
        }
    });

    function logToOutput(text, type = 'command') {
        const prompt = `<span class="prompt">&gt;</span>`;
        let line;
        if (type === 'command') {
            line = `<div class="command-line">${prompt}<div>${text}</div></div>`;
        } else {
            line = `<div class="response ${type}">${text}</div>`;
        }
        cliOutput.innerHTML += line;
        cliOutput.scrollTop = cliOutput.scrollHeight;
    }

    // --- Processing and sending commands ---
    async function processCommand(commandText) {
        const [command, ...args] = commandText.split(/\s+/);

        let payload = {};
        let isValid = true;
        
        try {
            switch(command.toLowerCase()) {
                case 'create-node':
                    if (args.length < 1) throw new Error("Potreban je ID čvora.");
                    const [id, ...restCreate] = args;
                    payload = { id, ...parseKeyValues(restCreate) };
                    break;
                
                case 'update-node':
                    if (args.length < 2) throw new Error("Potreban je ID čvora i bar jedan atribut za izmenu.");
                    const [nodeIdUpdate, ...updates] = args;
                    payload = { id: nodeIdUpdate, updates: parseKeyValues(updates) };
                    break;

                case 'delete-node':
                  if (args.length !== 1) throw new Error("Potreban je tačno jedan ID čvora.");
                  payload = { id: args[0] };
                  break;

                case 'create-edge':
                  if (args.length < 2) throw new Error("Potrebno je dva id-ja i tip grane.");
                  payload = { from: args[0], to: args[1], type: args[2]};
                  break;

                case 'filter':
                    if (args.length < 1) throw new Error("Potreban je izraz za filtriranje.");
                    payload = { expression: args.join(' ') };
                    break;
                
                case 'search':
                    if (args.length < 1) throw new Error("Potreban je upit za pretragu.");
                    payload = { query: args.join(' ') };
                    break;
                    
                case 'help':
                    logHelp();
                    isValid = false; 
                    break;

                case 'clear':
                    cliOutput.innerHTML = '';
                    isValid = false; 
                    break;

                default:
                    throw new Error(`Unknown command: '${command}'. Type 'help' for a list of commands.`);
            }
        } catch (error) {
            logToOutput(error.message, 'error');
            isValid = false;
        }

        if (isValid) {
            await sendCommandToServer(command.toLowerCase(), payload);
        }
    }

    function parseKeyValues(args) {
        const result = {};
        args.forEach(arg => {
            const parts = arg.split('=');
            if (parts.length === 2) {
                result[parts[0]] = parts[1];
            }
        });
        return result;
    }
    
    function logHelp() {
        const helpText = `
Available commands:
- <strong>create-node &lt;id&gt; [label=...] [color=...]</strong>: Creates a new node.
- <strong>update-node &lt;id&gt; [label=...] [color=...]</strong>: Changes the attributes of an existing node.
- <strong>delete-node &lt;id&gt;</strong>: Deletes a node and its connections..
- <strong>create-edge &lt;fromNodeId&gt; &lt;toNodeId&gt; type=... </strong>: Creates a new branch between two nodes.
- <strong>filter &lt;expression&gt;</strong>: Filters the graph based on an expression.
- <strong>search &lt;query&gt;</strong>: Searches the graph.
- <strong>clear</strong>: Clear terminal window.
- <strong>help</strong>: Showing this help.
        `;
        logToOutput(helpText.replace(/\n/g, '<br>'), 'info');
    }

    async function sendCommandToServer(command, payload) {
        try {
            const response = await fetch('/api/graph-command/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ command, payload })
            });
            
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Server je vratio grešku ${response.status}`);
            }
            
            logToOutput('Command executed successfully.', 'success');
            redrawGraph(result.graph);

        } catch (error) {
            logToOutput(`Error: ${error.message}`, 'error');
        }
    }
    
    function redrawGraph(graphData) {
        simpleInit()
        blockInit()
        
        logToOutput("I'm refreshing the page to show the changes", 'info');
        setTimeout(() => window.location.reload(), 1000);
    }

    logToOutput("Welcome to the Graph CLI. Type 'help' for a list of commands.");
});