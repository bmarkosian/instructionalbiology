// ---- Poincaré-disk interactivity ----
// Click a node: highlights its real connections only (no repositioning).
// "Transform" toggle: explicitly pushes every node out to the boundary,
// preserving each node's original angle from center. Reset: clears
// highlighting and returns to the original layout. These are three
// independent actions — clicking a node never moves anything.
(function () {
  var CX = 260, CY = 260, R = 236;

  function initGraph(svg) {
    var nodeEls = Array.from(svg.querySelectorAll('.p-node'));
    var edgeEls = Array.from(svg.querySelectorAll('.p-edge'));
    if (!nodeEls.length) return;

    // Parse each node's initial translate(x,y) from its transform attribute.
    var current = {};   // id -> {x, y}  (current animated position)
    var original = {};  // id -> {x, y}  (layout position, for reset)
    nodeEls.forEach(function (n) {
      var m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(n.getAttribute('transform') || '');
      var x = m ? parseFloat(m[1]) : CX, y = m ? parseFloat(m[2]) : CY;
      current[n.id] = { x: x, y: y };
      original[n.id] = { x: x, y: y };
    });

    // Adjacency from the already-drawn edges.
    var neighbors = {};
    edgeEls.forEach(function (e) {
      var s = e.dataset.source, t = e.dataset.target;
      (neighbors[s] = neighbors[s] || []).push(t);
      (neighbors[t] = neighbors[t] || []).push(s);
    });

    function render(positions) {
      nodeEls.forEach(function (n) {
        var p = positions[n.id];
        n.style.transform = 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px)';
      });
      edgeEls.forEach(function (e) {
        var s = positions[e.dataset.source], t = positions[e.dataset.target];
        e.setAttribute('x1', s.x.toFixed(2));
        e.setAttribute('y1', s.y.toFixed(2));
        e.setAttribute('x2', t.x.toFixed(2));
        e.setAttribute('y2', t.y.toFixed(2));
      });
    }

    function animateTo(target, duration) {
      var start = {};
      Object.keys(current).forEach(function (id) { start[id] = { x: current[id].x, y: current[id].y }; });
      var t0 = performance.now();
      function ease(t) { return 1 - Math.pow(1 - t, 3); }
      function step(now) {
        var t = Math.min(1, (now - t0) / duration);
        var e = ease(t);
        var frame = {};
        Object.keys(start).forEach(function (id) {
          frame[id] = {
            x: start[id].x + (target[id].x - start[id].x) * e,
            y: start[id].y + (target[id].y - start[id].y) * e
          };
        });
        render(frame);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          current = target;
        }
      }
      requestAnimationFrame(step);
    }

    // ---- click a node: highlight only, nothing moves ----
    function highlight(id) {
      var connected = new Set([id].concat(neighbors[id] || []));
      nodeEls.forEach(function (n) {
        n.classList.toggle('dimmed', !connected.has(n.id));
        n.classList.toggle('is-active', n.id === id);
      });
      edgeEls.forEach(function (e) {
        var touches = e.dataset.source === id || e.dataset.target === id;
        e.classList.toggle('active', touches);
        e.classList.toggle('dimmed', !touches);
      });
    }

    function clearHighlight() {
      nodeEls.forEach(function (n) { n.classList.remove('dimmed', 'is-active'); });
      edgeEls.forEach(function (e) { e.classList.remove('active', 'dimmed'); });
    }

    // ---- "Push to edges" toggle ----
    var transformed = false;
    var centeredId = null;
    var BOUNDARY_R = R * 0.94;
    function originalAngle(id) {
      var o = original[id];
      return Math.atan2(o.y - CY, o.x - CX);
    }
    function edgePosition(id) {
      var a = originalAngle(id);
      return { x: CX + BOUNDARY_R * Math.cos(a), y: CY + BOUNDARY_R * Math.sin(a) };
    }
    // Every node goes to its edge slot, except `focusId` (if given), which
    // goes to dead center. Recomputed fresh from original angles each time,
    // so repeated clicks never compound or drift.
    function ringLayout(focusId) {
      var target = {};
      Object.keys(current).forEach(function (id) {
        target[id] = (id === focusId) ? { x: CX, y: CY } : edgePosition(id);
      });
      return target;
    }

    var resetBtn = svg.parentElement.parentElement.querySelector('.poincare-reset');
    var transformBtn = svg.parentElement.parentElement.querySelector('.poincare-transform');

    function setTransformBtnState(on) {
      if (!transformBtn) return;
      transformBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      transformBtn.textContent = on ? '⇄ Restore layout' : '⇄ Transform: push to edges';
    }

    if (transformBtn) {
      // Manual preview: push every node to the boundary with none centered.
      transformBtn.addEventListener('click', function () {
        transformed = !transformed;
        centeredId = null;
        setTransformBtnState(transformed);
        animateTo(transformed ? ringLayout(null) : original, 700);
        if (resetBtn) resetBtn.hidden = false;
      });
    }

    // ---- node click: highlights its real connections AND immediately
    // brings it to center while every other node is pushed out to the
    // boundary ring — a single click does the whole thing, no separate
    // "Transform" press required. Clicking a different node afterward
    // re-centers on the new one and pushes the previous one back out.
    // ringLayout() is recomputed fresh from original angles each time, so
    // repeated clicks never compound or drift.
    nodeEls.forEach(function (n) {
      function activate() {
        highlight(n.id);
        transformed = true;
        centeredId = n.id;
        setTransformBtnState(true);
        animateTo(ringLayout(centeredId), 500);
        if (resetBtn) resetBtn.hidden = false;
      }
      n.addEventListener('click', activate);
      n.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(); }
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        clearHighlight();
        animateTo(original, 650);
        resetBtn.hidden = true;
        transformed = false;
        centeredId = null;
        if (transformBtn) {
          transformBtn.setAttribute('aria-pressed', 'false');
          transformBtn.textContent = '⇄ Transform: push to edges';
        }
      });
    }
  }

  document.querySelectorAll('#poincareHome, #poincareFull').forEach(initGraph);
})();

// ---- Mobile nav drawer ----
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('mobileNav');
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    nav.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    setOpen(!nav.classList.contains('is-open'));
  });
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setOpen(false); });
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') setOpen(false);
  });
  // Collapse the drawer if the viewport grows past the mobile breakpoint.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 860) setOpen(false);
  });
})();

// ---- Newsletter (MailerLite) + mailto-based contact form ----
// The newsletter form posts directly to MailerLite (no JS needed for the
// submission itself); this just pings their "form viewed" tracking endpoint.
(function () {
  var newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm && window.fetch) {
    fetch('https://assets.mailerlite.com/jsonp/2626401/forms/198176186437731915/takel').catch(function () {});
  }

  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = document.getElementById('contactName').value.trim();
      var email = document.getElementById('contactEmail').value.trim();
      var message = document.getElementById('contactMessage').value.trim();
      var subject = encodeURIComponent('Message from ' + (name || 'website visitor'));
      var body = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + message);
      window.location.href = 'mailto:instructionalbiologyinc@gmail.com?subject=' + subject + '&body=' + body;
    });
  }
})();
