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
  const bg = svg.querySelector("rect.pz-capture"); // ADD MMM
  if (bg) bg.addEventListener("click", () => setSelected(null)); // ADD MMM

  // --- Arrow trim helpers ---
  const GV_R = 16;        // poluprečnik <circle r="16">
  const GV_ARROW = 6;     // mali razmak za vrh strelice
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
  const nodes = Array.from(svg.querySelectorAll("g.nodes > g.node"));

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

function setSelected(node) {
  svg.querySelectorAll('.nodes .node').forEach(n => n.classList.remove('selected','dim'));
  svg.querySelectorAll('.edges line').forEach(l => l.classList.remove('active','dim'));
  if (!node) return;

  node.classList.add('selected');

  const id = node.getAttribute('data-id');
  const connected = linesByNode.get(id) || [];

  svg.querySelectorAll('.nodes .node').forEach(n => { if (n !== node) n.classList.add('dim'); });
  svg.querySelectorAll('.edges line').forEach(l => { if (!connected.includes(l)) l.classList.add('dim'); });
  connected.forEach(l => l.classList.add('active'));
}

function focusNodeById(nodeId, opts = {}) {
  const node = svg.querySelector(`g.nodes > g.node[data-id="${nodeId}"]`);
  if (!node) return;
  const [nx, ny] = parseXY(node.getAttribute('transform'));

  const targetK = Math.max(opts.scale ?? 1.2, k);
  const cx = svg.clientWidth / 2;
  const cy = svg.clientHeight / 2;

  // world -> screen: screen = k*world + t  =>  t = center - k*world
  k = Math.min(Math.max(targetK, K_MIN), K_MAX);
  tx = cx - k * nx;
  ty = cy - k * ny;

  applyTransform();
  setSelected(node);
 
  updateConnectedLines(nodeId);
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

  function updateConnectedLines(nodeId) {
    const getNode = id => svg.querySelector(`g.nodes > g.node[data-id="${id}"]`);
    (linesByNode.get(nodeId) || []).forEach(line => {
      const a = line.getAttribute("data-from");
      const b = line.getAttribute("data-to");
      const ga = getNode(a), gb = getNode(b);
      if (!ga || !gb) return;

      const [x1, y1] = parseXY(ga.getAttribute("transform"));
      const [x2, y2] = parseXY(gb.getAttribute("transform"));
      const [sx1, sy1, sx2, sy2] = shorten(x1, y1, x2, y2, GV_TRIM);

      line.setAttribute("x1", sx1.toFixed(2));
      line.setAttribute("y1", sy1.toFixed(2));
      line.setAttribute("x2", sx2.toFixed(2));
      line.setAttribute("y2", sy2.toFixed(2));
    });
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
    node.addEventListener("dblclick", e => {  
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
window.gvCurrentVisualizer = "simple";

function switchVisualizer(type, btn) {
  window.gvCurrentVisualizer = type;

  const positions = {};
  document.querySelectorAll(".node, .block-node").forEach(n => {
    const transform = n.getAttribute("transform") || "";
    const m = transform.match(/-?\d+(\.\d+)?/g);
    if (m && m.length >= 2) {
      const [x, y] = m.map(Number);
      positions[n.getAttribute("data-id")] = { x, y };
    }
  });

  updatePrimaryButton(btn);

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

    const svg = mainHost.querySelector(".gv-svg");
    enablePanZoom(svg);

    if (window[type + "Init"]) {
      window[type + "Init"]();
    }

    bindNodeHoverAndTooltip(svg);

    window.gvCurrentVisualizer = type;
    const searchInput = document.getElementById("search-visualizer");
    if (searchInput) searchInput.value = type;
  
    refreshBird();
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
    refreshBird()
  }

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
      updateEdges(selectedNode);
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
      refreshBird()
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

window.gvPanZoom = window.gvPanZoom || {
  x: 0, y: 0, scale: 1,
  svg: null,
  container: null,
  isPanning: false,
  start: { x: 0, y: 0 }
};

function enablePanZoom(svg) {
  if (!svg) return;

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

    // Hover class i cursor
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