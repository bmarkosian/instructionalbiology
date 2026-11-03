/* The Reasoning System, drawn on the page (31 Oct 2026). An illustration of a branching hierarchy in a Poincare disc:
   six tiers, each wider than the one before, with activating and suppressing links. Not the trained graph. */
(function () {
  var fig = document.getElementById('ibx-rs');
  if (!fig) return;
  var svg = fig.querySelector('svg.ibx-rs-svg');
  var NS = 'http://www.w3.org/2000/svg';
  var TIERS = ['Peptides', 'Receptors', 'Signaling cascades', 'Master regulators', 'Disease states', 'Outcomes'];
  var COUNTS = [3, 6, 12, 24, 48, 96];
  var R = 170, C = 180;
  // hyperbolic spacing: equal steps of hyperbolic distance give rings that crowd toward the edge
  var radius = function (k) { return Math.tanh(0.42 * (k + 1)) * 0.97; };
  var seed = 7;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  var nodes = [], links = [];
  for (var t = 0; t < TIERS.length; t++) {
    var n = COUNTS[t], rr = radius(t);
    for (var j = 0; j < n; j++) {
      var a = (j + 0.5) / n * 2 * Math.PI - Math.PI / 2 + t * 0.07;
      var node = { t: t, x: rr * Math.cos(a), y: rr * Math.sin(a) };
      if (t > 0) {
        var parent = nodes.filter(function (p) { return p.t === t - 1; })[Math.floor(j / 2)];
        links.push({ a: parent, b: node, sign: rnd() < 0.72 ? 1 : -1, t: t });
      }
      nodes.push(node);
    }
  }
  // geodesic between p and q in the unit disc: the circle through p, q and p's inversion p/|p|^2
  function geodesic(p, q) {
    var pp = p.x * p.x + p.y * p.y;
    if (pp < 1e-6) return 'M' + sx(p) + ' ' + sy(p) + ' L' + sx(q) + ' ' + sy(q);
    var ix = p.x / pp, iy = p.y / pp;
    var ax = p.x, ay = p.y, bx = q.x, by = q.y, cx = ix, cy = iy;
    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-9) return 'M' + sx(p) + ' ' + sy(p) + ' L' + sx(q) + ' ' + sy(q);
    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    var rad = Math.hypot(ax - ux, ay - uy) * R;
    var cross = (p.x - ux) * (q.y - uy) - (p.y - uy) * (q.x - ux);
    return 'M' + sx(p) + ' ' + sy(p) + ' A' + rad.toFixed(1) + ' ' + rad.toFixed(1) + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + sx(q) + ' ' + sy(q);
  }
  function sx(p) { return (C + p.x * R).toFixed(1); }
  function sy(p) { return (C + p.y * R).toFixed(1); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }

  el('circle', { cx: C, cy: C, r: R, class: 'ibx-rs-rim' }, svg);
  var ringEls = [];
  for (var k = 0; k < TIERS.length; k++) ringEls.push(el('circle', { cx: C, cy: C, r: (radius(k) * R).toFixed(1), class: 'ibx-rs-ring' }, svg));
  var gl = el('g', {}, svg), gn = el('g', {}, svg);
  var linkEls = links.map(function (l) { return el('path', { d: geodesic(l.a, l.b), class: 'ibx-rs-link ' + (l.sign > 0 ? 'is-plus' : 'is-minus') }, gl); });
  var nodeEls = nodes.map(function (n) { return el('circle', { cx: sx(n), cy: sy(n), r: Math.max(1.6, 5 - n.t * 0.7), class: 'ibx-rs-node' }, gn); });

  var state = { tier: null, sign: 0 };
  var note = fig.querySelector('.ibx-rs-note');
  function render() {
    links.forEach(function (l, i) {
      var on = (state.sign === 0 || l.sign === state.sign) && (state.tier === null || l.t === state.tier);
      linkEls[i].classList.toggle('is-dim', !on);
    });
    nodes.forEach(function (n, i) { nodeEls[i].classList.toggle('is-dim', state.tier !== null && n.t !== state.tier); });
    ringEls.forEach(function (r, i) { r.classList.toggle('is-on', state.tier === i); });
    if (state.tier === null) {
      note.textContent = 'Six tiers, each wider than the one inside it. In flat space the outer tiers would run out of room; in hyperbolic space they have room right out to the edge.';
    } else {
      note.textContent = TIERS[state.tier] + ': ' + COUNTS[state.tier] + ' nodes in this drawing, ' + (state.tier ? 'each linked from the tier inside it.' : 'the innermost tier.');
    }
    fig.querySelectorAll('[data-tier]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.tier === state.tier)); });
    fig.querySelectorAll('[data-sign]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.sign === state.sign)); });
  }
  fig.querySelectorAll('[data-tier]').forEach(function (b) {
    b.addEventListener('click', function () { var t = +b.dataset.tier; state.tier = state.tier === t ? null : t; render(); });
  });
  fig.querySelectorAll('[data-sign]').forEach(function (b) {
    b.addEventListener('click', function () { var s = +b.dataset.sign; state.sign = state.sign === s ? 0 : s; render(); });
  });
  render();
})();
