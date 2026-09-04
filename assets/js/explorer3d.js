// ---- 3D illustrative Poincare-ball explorer ----
// Synthetic, non-enabling data only: generic tier labels, no real compound
// or receptor names, no methodology claims beyond "illustrative projection."
(function () {
  var root = document.getElementById('exp3d');
  if (!root) return;

  var canvas = root.querySelector('.exp-canvas');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  // ---- seeded PRNG for deterministic synthetic layout ----
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(1234);

  var TIERS = [
    { name: 'regulator', color: '#b5654a', r: 0.06 },
    { name: 'cascade',   color: '#8b80e8', r: 0.42 },
    { name: 'receptor',  color: '#5b7a8c', r: 0.66 },
    { name: 'peptide',   color: '#4a5168', r: 0.80 },
    { name: 'disease',   color: '#9a8f78', r: 0.90 },
    { name: 'outcome',   color: '#d9b878', r: 0.95 }
  ];
  var PER_TIER = 7;

  // Fibonacci-sphere point distribution for a natural-looking 3D spread.
  function sphereShell(count, radius, tierIndex) {
    var pts = [];
    var offset = tierIndex * 0.6;
    for (var i = 0; i < count; i++) {
      var y = 1 - (i / (count - 1 || 1)) * 2;
      var rAtY = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = (2.399963 * i) + offset;
      pts.push({
        x: Math.cos(theta) * rAtY * radius,
        y: y * radius * 0.9,
        z: Math.sin(theta) * rAtY * radius
      });
    }
    return pts;
  }

  // A child's hierarchical position is drawn from its parent's direction plus
  // a bounded jitter, then scaled out to the child's own tier radius. This is
  // what makes "connected nodes sit closer together than unconnected ones"
  // (see the layout diagnostics panel) actually true of the rendered layout,
  // rather than merely asserted by the caption — with fully independent
  // per-tier placement, a parent and child could land on opposite sides of
  // the ball with nothing pulling them together.
  function unit(v) {
    var m = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / m, y: v.y / m, z: v.z / m };
  }
  var HIER_JITTER = 0.55;

  // Illustrative relation vocabulary shown on click — not a real mechanism
  // claim, just a label for the kind of edge being traced.
  var RELATIONS = ['activates', 'inhibits', 'modulates', 'feeds into', 'cross-talks with'];
  function pickRelation() { return RELATIONS[Math.floor(rng() * RELATIONS.length)]; }

  var nodes = []; // {id, tier, tierIndex, x,y,z (hierarchical), ux,uy,uz (unordered), degree}
  var byTier = {};
  var edges = [];

  // Preferential attachment: a node is chosen with probability proportional
  // to how many connections it already has (+1), so a small number of nodes
  // per tier snowball into disproportionately high connectivity — the same
  // "rich get richer" dynamic that produces hub / master-regulator structure
  // in real signaling networks, instead of every node ending up equally and
  // arbitrarily connected.
  function pickWeighted(pool, exclude) {
    var weights = [], total = 0, i;
    for (i = 0; i < pool.length; i++) {
      var w = (exclude && exclude.has(pool[i])) ? 0 : (pool[i].degree + 1);
      weights.push(w);
      total += w;
    }
    if (total <= 0) return null;
    var r = rng() * total;
    for (i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function edgeExists(a, b) {
    return edges.some(function (e) { return (e.a === a && e.b === b) || (e.a === b && e.b === a); });
  }
  function addEdge(a, b) {
    if (!a || !b || a === b || edgeExists(a, b)) return;
    edges.push({ a: a, b: b, type: pickRelation() });
    a.neighbors.push(b);
    b.neighbors.push(a);
    a.degree++; b.degree++;
  }

  TIERS.forEach(function (t, ti) {
    var uPts = sphereShell(PER_TIER, 0.10 + rng() * 0.08, ti + 9); // unordered: all crowded near origin
    var rootPts = ti === 0 ? sphereShell(PER_TIER, t.r, ti) : null;
    var prevTier = ti > 0 ? byTier[TIERS[ti - 1].name] : null;
    byTier[t.name] = [];
    for (var i = 0; i < PER_TIER; i++) {
      var hx, hy, hz, positionParent = null;
      if (ti === 0) {
        hx = rootPts[i].x; hy = rootPts[i].y; hz = rootPts[i].z;
      } else {
        positionParent = pickWeighted(prevTier);
        var pDir = unit(positionParent);
        var cDir = unit({
          x: pDir.x + (rng() * 2 - 1) * HIER_JITTER,
          y: pDir.y + (rng() * 2 - 1) * HIER_JITTER,
          z: pDir.z + (rng() * 2 - 1) * HIER_JITTER
        });
        hx = cDir.x * t.r; hy = cDir.y * t.r; hz = cDir.z * t.r;
      }
      var n = {
        id: t.name.charAt(0).toUpperCase() + t.name.slice(1) + ' ' + (i + 1),
        key: t.name + '_' + i,
        tier: t.name, tierIndex: ti, color: t.color,
        x: hx, y: hy, z: hz,
        ux: uPts[i].x, uy: uPts[i].y, uz: uPts[i].z,
        neighbors: [], degree: 0
      };
      nodes.push(n);
      byTier[t.name].push(n);
      if (positionParent) addEdge(n, positionParent);
    }
    // A second, independently-chosen cross-tier link per node so most
    // downstream nodes tie back to more than one upstream node — a strict
    // one-parent tree can't show a cascade node sitting under two regulators.
    if (ti > 0 && prevTier) {
      byTier[t.name].forEach(function (n) {
        if (rng() < 0.65) addEdge(n, pickWeighted(prevTier, new Set(n.neighbors)));
      });
    }
  });

  // ---- intra-tier cross-talk ----
  // Regulators and cascades also connect laterally to each other, not just
  // down the hierarchy — the AKT/mTOR-style cross-talk a strict parent-child
  // tree can't represent. Preferential attachment again means a handful of
  // regulators end up as clear hubs: the master regulators.
  [{ tier: 'regulator', extra: 9 }, { tier: 'cascade', extra: 5 }].forEach(function (spec) {
    var pool = byTier[spec.tier];
    for (var k = 0; k < spec.extra; k++) {
      var a = pool[Math.floor(rng() * pool.length)];
      addEdge(a, pickWeighted(pool, new Set([a].concat(a.neighbors))));
    }
  });

  // Top-connected regulators, flagged as master regulators.
  var masterRegs = byTier.regulator.slice().sort(function (a, b) { return b.degree - a.degree; });
  masterRegs.forEach(function (n, idx) { n.isHub = idx < 3; });

  // ---- view state ----
  var mode = 'hier'; // 'hier' | 'unordered'
  var rotY = 0.6, rotX = -0.25;
  var autorotate = true;
  var dragging = false, lastX = 0, lastY = 0;
  var selected = null;
  var selectedEdge = null;

  function pos(n) { return mode === 'hier' ? [n.x, n.y, n.z] : [n.ux, n.uy, n.uz]; }

  function project(x, y, z) {
    var cy = Math.cos(rotY), sy = Math.sin(rotY);
    var x1 = x * cy + z * sy;
    var z1 = -x * sy + z * cy;
    var cx = Math.cos(rotX), sx = Math.sin(rotX);
    var y1 = y * cx - z1 * sx;
    var z2 = y * sx + z1 * cx;
    var perspective = 2.6;
    var factor = perspective / (perspective + z2);
    var scale = Math.min(W, H) * 0.34;
    return {
      px: W / 2 + x1 * scale * factor,
      py: H / 2 + y1 * scale * factor,
      z: z2, factor: factor
    };
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    // boundary circle
    ctx.strokeStyle = 'rgba(233,230,218,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.34, 0, Math.PI * 2);
    ctx.stroke();

    var projected = nodes.map(function (n) {
      var p = pos(n);
      var proj = project(p[0], p[1], p[2]);
      return { n: n, proj: proj };
    });

    // A node click focuses that node + its neighbors; an edge click focuses
    // just its two endpoints. Either way, focusNodes drives node/edge dimming.
    var focusNodes = selected ? [selected].concat(selected.neighbors)
      : selectedEdge ? [selectedEdge.a, selectedEdge.b] : null;

    // edges
    var edgeScreens = [];
    edges.forEach(function (e) {
      var pa = project.apply(null, pos(e.a));
      var pb = project.apply(null, pos(e.b));
      var isActive = e === selectedEdge || (selected && (e.a === selected || e.b === selected));
      var avgZ = (pa.z + pb.z) / 2;
      var depthOpacity = Math.max(0.06, Math.min(0.35, 0.25 - avgZ * 0.15));
      ctx.strokeStyle = isActive ? 'rgba(217,184,120,.9)' : 'rgba(69,76,99,' + depthOpacity + ')';
      ctx.lineWidth = isActive ? 1.6 : 0.7;
      ctx.beginPath();
      ctx.moveTo(pa.px, pa.py);
      ctx.lineTo(pb.px, pb.py);
      ctx.stroke();
      edgeScreens.push({ e: e, pa: pa, pb: pb });
    });

    // nodes, back-to-front
    projected.sort(function (a, b) { return a.proj.z - b.proj.z; });
    projected.forEach(function (item) {
      var n = item.n, p = item.proj;
      // Higher-degree nodes render larger — connection count is visible at a
      // glance, not just on click.
      var baseR = 3 + n.tierIndex * 0.4 + Math.min(n.degree, 8) * 0.4;
      var r = baseR * (0.7 + p.factor * 0.5);
      var isSelected = n === selected || (selectedEdge && (n === selectedEdge.a || n === selectedEdge.b));
      var dim = focusNodes && focusNodes.indexOf(n) === -1;
      ctx.globalAlpha = dim ? 0.22 : 1;
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
      ctx.fill();
      if (n.isHub && !isSelected) {
        ctx.strokeStyle = 'rgba(217,184,120,.65)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      if (isSelected) {
        ctx.strokeStyle = '#d9b878';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      item.screen = p;
    });

    this._lastProjected = projected;
    this._lastEdgeScreens = edgeScreens;
    return { nodes: projected, edges: edgeScreens };
  }

  var lastProjected = [];
  var lastEdgeScreens = [];
  function draw() {
    var out = render();
    lastProjected = out.nodes;
    lastEdgeScreens = out.edges;
  }

  function loop() {
    if (autorotate && !dragging) rotY += 0.0022;
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- drag to rotate ----
  function toLocal(ev) {
    var rect = canvas.getBoundingClientRect();
    var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    var cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
    return { x: cx * (W / rect.width), y: cy * (H / rect.height) };
  }
  canvas.addEventListener('pointerdown', function (ev) {
    dragging = true; autorotate = false;
    lastX = ev.clientX; lastY = ev.clientY;
  });
  window.addEventListener('pointermove', function (ev) {
    if (!dragging) return;
    var dx = ev.clientX - lastX, dy = ev.clientY - lastY;
    rotY += dx * 0.006;
    rotX = Math.max(-1.3, Math.min(1.3, rotX + dy * 0.006));
    lastX = ev.clientX; lastY = ev.clientY;
  });
  window.addEventListener('pointerup', function () { dragging = false; });

  // ---- rotate the ball so the clicked node lands dead center ----
  // project() maps a point through rotY then rotX; centerOn solves those two
  // rotations in reverse so the clicked node's own (x,y,z) ends up on the
  // camera axis (px,py at the exact center, z maximized), then tweens there
  // instead of snapping.
  function angleDelta(a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function centerOn(p) {
    var targetY = Math.atan2(-p[0], p[2]);
    var targetX = Math.atan2(p[1], Math.hypot(p[0], p[2]));
    var startY = rotY, startX = rotX;
    var dY = angleDelta(startY, targetY);
    var dX = angleDelta(startX, targetX);
    autorotate = false;
    var t0 = performance.now();
    var duration = 550;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function step(now) {
      var t = Math.min(1, (now - t0) / duration);
      var e = ease(t);
      rotY = startY + dY * e;
      rotX = startX + dX * e;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function distToSegment(px, py, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay;
    var len2 = abx * abx + aby * aby;
    var t = len2 ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2)) : 0;
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
  }

  canvas.addEventListener('click', function (ev) {
    var local = toLocal(ev);
    var best = null, bestDist = 18;
    lastProjected.forEach(function (item) {
      var d = Math.hypot(item.screen.px - local.x, item.screen.py - local.y);
      if (d < bestDist) { bestDist = d; best = item.n; }
    });

    if (best) {
      selected = best;
      selectedEdge = null;
      updateSelPanel();
      centerOn(pos(best));
      return;
    }

    // No node hit — check edges, so a click on a connection line traces and
    // centers that specific relationship instead of doing nothing.
    var bestEdge = null, bestEdgeDist = 8;
    lastEdgeScreens.forEach(function (item) {
      var d = distToSegment(local.x, local.y, item.pa.px, item.pa.py, item.pb.px, item.pb.py);
      if (d < bestEdgeDist) { bestEdgeDist = d; bestEdge = item.e; }
    });

    selected = null;
    selectedEdge = bestEdge;
    updateSelPanel();
    if (bestEdge) {
      var pa = pos(bestEdge.a), pb = pos(bestEdge.b);
      centerOn([(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2]);
    }
  });

  // ---- sidebar: selected node ----
  var selEl = document.getElementById('expSel');
  function relationFor(a, b) {
    var e = edges.filter(function (e) { return (e.a === a && e.b === b) || (e.a === b && e.b === a); })[0];
    return e ? e.type : '';
  }
  function updateSelPanel() {
    if (!selEl) return;
    if (selectedEdge) {
      selEl.innerHTML =
        '<div class="id">' + selectedEdge.a.id + ' → ' + selectedEdge.b.id + '</div>' +
        '<div class="tr">' + selectedEdge.a.tier + ' → ' + selectedEdge.b.tier + '</div>' +
        '<div class="nb">Relationship: ' + selectedEdge.type + '</div>';
      return;
    }
    if (!selected) {
      selEl.innerHTML = '<div class="ph">Click a node or a connecting line to trace it.</div>';
      return;
    }
    var nb = selected.neighbors.map(function (n) {
      return n.id + ' (' + relationFor(selected, n) + ')';
    }).join(', ');
    var hubNote = selected.isHub
      ? '<div class="nb" style="color:#d9b878;">Master regulator — highest cross-talk connectivity in its tier.</div>'
      : '';
    selEl.innerHTML =
      '<div class="id">' + selected.id + '</div>' +
      '<div class="tr">' + selected.tier + ' tier · ' + selected.degree + (selected.degree === 1 ? ' connection' : ' connections') + '</div>' +
      hubNote +
      '<div class="nb">Connects to: ' + (nb || '—') + '</div>';
  }

  // ---- toggle buttons ----
  var bHier = document.getElementById('expBHier');
  var bUn = document.getElementById('expBUn');
  function setMode(m) {
    mode = m;
    if (bHier) bHier.setAttribute('aria-pressed', m === 'hier' ? 'true' : 'false');
    if (bUn) bUn.setAttribute('aria-pressed', m === 'unordered' ? 'true' : 'false');
    updateDiagnostics();
  }
  if (bHier) bHier.addEventListener('click', function () { setMode('hier'); });
  if (bUn) bUn.addEventListener('click', function () { setMode('unordered'); });

  // ---- diagnostics ----
  function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function updateDiagnostics() {
    var innerAvg = 0, outerAvg = 0, maxR = 0;
    byTier[TIERS[0].name].forEach(function (n) { innerAvg += Math.hypot.apply(null, pos(n)); });
    byTier[TIERS[TIERS.length - 1].name].forEach(function (n) { outerAvg += Math.hypot.apply(null, pos(n)); });
    innerAvg /= PER_TIER; outerAvg /= PER_TIER;
    nodes.forEach(function (n) { maxR = Math.max(maxR, Math.hypot.apply(null, pos(n))); });

    var connectedD = 0, unconnectedD = 0, ucCount = 0;
    edges.forEach(function (e) { connectedD += dist3(pos(e.a), pos(e.b)); });
    connectedD /= edges.length;
    for (var i = 0; i < 60; i++) {
      var a = nodes[Math.floor(rng() * nodes.length)];
      var b = nodes[Math.floor(rng() * nodes.length)];
      if (a !== b && a.neighbors.indexOf(b) === -1) { unconnectedD += dist3(pos(a), pos(b)); ucCount++; }
    }
    unconnectedD /= (ucCount || 1);

    var sepEl = document.getElementById('expSep');
    var encEl = document.getElementById('expEnc');
    var radEl = document.getElementById('expRad');
    if (sepEl) sepEl.textContent = (outerAvg / (innerAvg || 0.01)).toFixed(2) + '×';
    if (encEl) encEl.textContent = (unconnectedD / (connectedD || 0.01)).toFixed(2) + '×';
    if (radEl) radEl.textContent = maxR.toFixed(2);
  }
  updateDiagnostics();

  // ---- legend ----
  var legEl = document.getElementById('expLeg');
  if (legEl) {
    legEl.innerHTML = TIERS.map(function (t) {
      return '<div class="exp-lg"><span class="exp-dot" style="background:' + t.color + '"></span>' +
        t.name.charAt(0).toUpperCase() + t.name.slice(1) + '<span class="n">' + PER_TIER + '</span></div>';
    }).join('');
  }

  // ---- master regulators (ranked by connection count) ----
  var hubsEl = document.getElementById('expHubs');
  if (hubsEl) {
    hubsEl.innerHTML = masterRegs.map(function (n, idx) {
      return '<div class="exp-lg"' + (n.isHub ? ' style="color:#d9b878;"' : '') + '>' +
        '<span class="exp-dot" style="background:' + n.color + '"></span>' +
        n.id + '<span class="n">' + n.degree + '</span></div>';
    }).join('');
  }

  // ---- polarity mini-diagrams ----
  function drawPolarity() {
    var pA = document.getElementById('expPA'), pB = document.getElementById('expPB');
    if (!pA || !pB) return;
    var cA = pA.getContext('2d'), cB = pB.getContext('2d');
    var w = pA.width, h = pA.height, cx = w / 2, cy = h / 2;

    // Attenuation: arrows shrink toward zero as "inhibition" increases.
    cA.clearRect(0, 0, w, h);
    for (var i = 0; i < 5; i++) {
      var len = (60 - i * 13);
      var alpha = 1 - i * 0.15;
      cA.strokeStyle = 'rgba(139,128,232,' + alpha + ')';
      cA.lineWidth = 2;
      cA.beginPath();
      cA.moveTo(cx, cy);
      cA.lineTo(cx + len, cy - 6 * i);
      cA.stroke();
    }
    cA.fillStyle = 'rgba(233,230,218,.5)';
    cA.font = '10px monospace';
    cA.fillText('→ 0', cx + 65, cy + 4);

    // Rotation: arrows stay full length, sweep through angle.
    cB.clearRect(0, 0, w, h);
    for (var j = 0; j < 5; j++) {
      var ang = -0.9 + j * 0.45;
      var alpha2 = 0.35 + j * 0.13;
      cB.strokeStyle = 'rgba(217,184,120,' + alpha2 + ')';
      cB.lineWidth = 2;
      cB.beginPath();
      cB.moveTo(cx, cy);
      cB.lineTo(cx + Math.cos(ang) * 62, cy + Math.sin(ang) * 62);
      cB.stroke();
    }
    cB.fillStyle = 'rgba(233,230,218,.5)';
    cB.font = '10px monospace';
    cB.fillText('‖·‖ constant', cx + 20, cy + 60);
  }
  drawPolarity();
})();
