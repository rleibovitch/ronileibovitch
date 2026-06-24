/**
 * Roni Leibovitch — Spatial portfolio interactions
 * Non-linear pan/drag navigation, async reveals, sensory controls
 */

const state = {
  panX: 0,
  panY: 0,
  scale: 1,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  panStartX: 0,
  panStartY: 0,
  galleryIndex: 0,
  galleryTotal: 3,
  activeZone: 'zone-origin',
  focusMode: false,
};

const world = document.getElementById('world');
const viewport = document.getElementById('viewport');
const minimapViewport = document.getElementById('minimap-viewport');
const connectors = document.getElementById('connectors');

const WORLD_W = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--world-w')) || 3200;
const WORLD_H = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--world-h')) || 2400;

/* ─── Initialize ─── */
function init() {
  document.getElementById('year').textContent = new Date().getFullYear();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('calm-motion');
    document.getElementById('toggle-motion')?.setAttribute('aria-pressed', 'true');
  }

  centerOnZone('zone-origin', false);
  setupPanDrag();
  setupSensoryControls();
  setupNavigation();
  setupGallery();
  setupAsyncReveals();
  setupConnectors();
  setupKeyboardNav();
  setupZoneFocus();

  window.addEventListener('resize', debounce(updateMinimap, 150));
  requestAnimationFrame(() => {
    updateMinimap();
    triggerOriginReveals();
  });
}

/* ─── Pan & drag the spatial canvas ─── */
function setupPanDrag() {
  const startDrag = (clientX, clientY) => {
    state.isDragging = true;
    state.dragStartX = clientX;
    state.dragStartY = clientY;
    state.panStartX = state.panX;
    state.panStartY = state.panY;
    document.body.classList.add('is-dragging');
  };

  const moveDrag = (clientX, clientY) => {
    if (!state.isDragging) return;
    const dx = clientX - state.dragStartX;
    const dy = clientY - state.dragStartY;
    state.panX = clampPan(state.panStartX + dx, 'x');
    state.panY = clampPan(state.panStartY + dy, 'y');
    applyTransform();
    updateMinimap();
  };

  const endDrag = () => {
    state.isDragging = false;
    document.body.classList.remove('is-dragging');
  };

  viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('a, button, input, .app-card, .gallery-album')) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  viewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('a, button, input, .app-card, .gallery-album')) return;
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  }, { passive: true });

  viewport.addEventListener('touchend', endDrag);

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.panX = clampPan(state.panX - e.deltaX * 0.8, 'x');
    state.panY = clampPan(state.panY - e.deltaY * 0.8, 'y');
    applyTransform();
    updateMinimap();
  }, { passive: false });
}

function clampPan(value, axis) {
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const ww = WORLD_W();
  const wh = WORLD_H();
  const margin = 100;

  if (axis === 'x') {
    const min = -(ww - vw + margin);
    const max = margin;
    return Math.max(min, Math.min(max, value));
  }
  const min = -(wh - vh + margin);
  const max = margin;
  return Math.max(min, Math.min(max, value));
}

function applyTransform() {
  world.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
}

/* ─── Navigate to zones ─── */
function centerOnZone(zoneId, animate = true) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const zoneRect = {
    left: zone.offsetLeft,
    top: zone.offsetTop,
    width: zone.offsetWidth,
    height: zone.offsetHeight,
  };

  const targetX = vw / 2 - (zoneRect.left + zoneRect.width / 2);
  const targetY = vh / 2 - (zoneRect.top + zoneRect.height / 2);

  if (animate) {
    animatePan(targetX, targetY);
  } else {
    state.panX = clampPan(targetX, 'x');
    state.panY = clampPan(targetY, 'y');
    applyTransform();
  }

  state.activeZone = zoneId;
  updateMinimapDots(zoneId);
  highlightZone(zoneId);

  if (state.focusMode) {
    setFocusZone(zoneId);
  }
}

function animatePan(targetX, targetY) {
  const startX = state.panX;
  const startY = state.panY;
  const endX = clampPan(targetX, 'x');
  const endY = clampPan(targetY, 'y');
  const duration = document.body.classList.contains('calm-motion') ? 0 : 800;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    state.panX = startX + (endX - startX) * eased;
    state.panY = startY + (endY - startY) * eased;
    applyTransform();
    updateMinimap();

    if (t < 1) requestAnimationFrame(step);
  }

  if (duration === 0) {
    state.panX = endX;
    state.panY = endY;
    applyTransform();
    updateMinimap();
  } else {
    requestAnimationFrame(step);
  }
}

function setupNavigation() {
  const navToggle = document.getElementById('nav-toggle');
  const navNodes = document.getElementById('nav-nodes');

  navToggle?.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    navNodes.hidden = expanded;
  });

  document.querySelectorAll('[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      centerOnZone(target);
      navNodes.hidden = true;
      navToggle?.setAttribute('aria-expanded', 'false');
      revealZoneContent(target);
    });
  });
}

/* ─── Sensory controls ─── */
function setupSensoryControls() {
  document.getElementById('toggle-motion')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!pressed));
    document.body.classList.toggle('calm-motion', !pressed);
  });

  document.getElementById('toggle-contrast')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!pressed));
    document.body.classList.toggle('soft-palette', !pressed);
  });

  document.getElementById('toggle-focus')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!pressed));
    state.focusMode = !pressed;
    document.body.classList.toggle('focus-mode', !pressed);
    if (!pressed) {
      setFocusZone(state.activeZone);
    } else {
      document.querySelectorAll('.zone').forEach((z) => z.classList.remove('zone-active'));
    }
  });
}

function setFocusZone(zoneId) {
  document.querySelectorAll('.zone').forEach((z) => {
    z.classList.toggle('zone-active', z.id === zoneId);
  });
}

/* ─── Gallery mini album ─── */
function setupGallery() {
  const track = document.getElementById('gallery-track');
  const counter = document.getElementById('gallery-counter');
  const album = document.getElementById('gallery-album');
  const dots = document.querySelectorAll('.gallery-dot');
  if (!track) return;

  const goTo = (index) => {
    state.galleryIndex = ((index % state.galleryTotal) + state.galleryTotal) % state.galleryTotal;
    track.style.transform = `translateX(-${state.galleryIndex * 100}%)`;
    if (counter) counter.textContent = `${state.galleryIndex + 1} / ${state.galleryTotal}`;
    dots.forEach((dot, i) => {
      const active = i === state.galleryIndex;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
    });
  };

  document.getElementById('gallery-prev')?.addEventListener('click', () => goTo(state.galleryIndex - 1));
  document.getElementById('gallery-next')?.addEventListener('click', () => goTo(state.galleryIndex + 1));

  dots.forEach((dot) => {
    dot.addEventListener('click', () => goTo(parseInt(dot.dataset.index, 10)));
  });

  if (!album) return;

  let swipeStartX = 0;
  let swiping = false;

  const onSwipeStart = (clientX) => {
    swipeStartX = clientX;
    swiping = true;
    album.classList.add('is-dragging');
  };

  const onSwipeEnd = (clientX) => {
    if (!swiping) return;
    const dx = clientX - swipeStartX;
    if (Math.abs(dx) > 48) {
      goTo(state.galleryIndex + (dx < 0 ? 1 : -1));
    }
    swiping = false;
    album.classList.remove('is-dragging');
  };

  album.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    onSwipeStart(e.clientX);
  });

  window.addEventListener('mouseup', (e) => {
    if (swiping) onSwipeEnd(e.clientX);
  });

  album.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    onSwipeStart(e.touches[0].clientX);
  }, { passive: true });

  album.addEventListener('touchend', (e) => {
    if (e.changedTouches[0]) onSwipeEnd(e.changedTouches[0].clientX);
  }, { passive: true });

  goTo(0);
}

/* ─── Async reveals — intersection-based storytelling ─── */
function setupAsyncReveals() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = parseInt(el.dataset.delay || '0', 10);

          if (el.classList.contains('async-story')) {
            setTimeout(() => el.classList.add('revealed'), delay);
          } else {
            setTimeout(() => el.classList.add('revealed'), delay);
          }

          observer.unobserve(el);
        }
      });
    },
    { root: viewport, threshold: 0.3, rootMargin: '50px' }
  );

  document.querySelectorAll('.async-reveal, .async-story').forEach((el) => {
    observer.observe(el);
  });
}

function triggerOriginReveals() {
  document.querySelectorAll('#zone-origin .async-reveal').forEach((el) => {
    const delay = parseInt(el.dataset.delay || '0', 10);
    setTimeout(() => el.classList.add('revealed'), delay);
  });
}

function revealZoneContent(zoneId) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.querySelectorAll('.async-reveal:not(.revealed), .async-story:not(.revealed)').forEach((el) => {
    const delay = parseInt(el.dataset.delay || '0', 10);
    setTimeout(() => el.classList.add('revealed'), delay);
  });
}

/* ─── Zone focus on proximity ─── */
function setupZoneFocus() {
  const zoneObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
          state.activeZone = entry.target.id;
          updateMinimapDots(entry.target.id);
          revealZoneContent(entry.target.id);
        }
      });
    },
    { root: viewport, threshold: [0.4, 0.6] }
  );

  document.querySelectorAll('.zone').forEach((zone) => zoneObserver.observe(zone));
}

/* ─── Connector lines between zones ─── */
function setupConnectors() {
  const zones = ['zone-origin', 'zone-bio', 'zone-gallery', 'zone-writing', 'zone-apps', 'zone-art'];
  const pairs = [
    [0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [4, 5], [2, 3],
  ];

  pairs.forEach(([a, b]) => {
    const elA = document.getElementById(zones[a]);
    const elB = document.getElementById(zones[b]);
    if (!elA || !elB) return;

    const ax = elA.offsetLeft + elA.offsetWidth / 2;
    const ay = elA.offsetTop + elA.offsetHeight / 2;
    const bx = elB.offsetLeft + elB.offsetWidth / 2;
    const by = elB.offsetTop + elB.offsetHeight / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', ax);
    line.setAttribute('y1', ay);
    line.setAttribute('x2', bx);
    line.setAttribute('y2', by);
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '6 4');
    connectors.appendChild(line);
  });
}

/* ─── Minimap ─── */
function updateMinimap() {
  if (!minimapViewport) return;

  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const ww = WORLD_W();
  const wh = WORLD_H();
  const mapW = minimapViewport.clientWidth;
  const mapH = minimapViewport.clientHeight;

  const scaleX = mapW / ww;
  const scaleY = mapH / wh;

  const rectW = vw * scaleX;
  const rectH = vh * scaleY;
  const rectX = -state.panX * scaleX;
  const rectY = -state.panY * scaleY;

  minimapViewport.style.setProperty('--rect-x', `${rectX}px`);
  minimapViewport.style.setProperty('--rect-y', `${rectY}px`);
  minimapViewport.style.setProperty('--rect-w', `${rectW}px`);
  minimapViewport.style.setProperty('--rect-h', `${rectH}px`);

  const after = minimapViewport;
  after.style.setProperty('--minimap-x', `${rectX}px`);
  after.style.setProperty('--minimap-y', `${rectY}px`);
  after.style.setProperty('--minimap-w', `${rectW}px`);
  after.style.setProperty('--minimap-h', `${rectH}px`);

  const style = document.createElement('style');
  style.textContent = `
    .minimap-viewport::after {
      left: ${rectX}px;
      top: ${rectY}px;
      width: ${rectW}px;
      height: ${rectH}px;
    }
  `;
  const existing = document.getElementById('minimap-dynamic-style');
  if (existing) existing.remove();
  style.id = 'minimap-dynamic-style';
  document.head.appendChild(style);
}

function updateMinimapDots(activeId) {
  document.querySelectorAll('.minimap-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.target === activeId);
  });
}

function highlightZone(zoneId) {
  document.querySelectorAll('.zone').forEach((z) => {
    z.style.zIndex = z.id === zoneId ? '5' : '1';
  });
}

/* ─── Keyboard navigation ─── */
function setupKeyboardNav() {
  const zoneOrder = ['zone-origin', 'zone-bio', 'zone-gallery', 'zone-writing', 'zone-apps', 'zone-art'];

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;

    const currentIndex = zoneOrder.indexOf(state.activeZone);

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault();
        const next = zoneOrder[(currentIndex + 1) % zoneOrder.length];
        centerOnZone(next);
        revealZoneContent(next);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        const prev = zoneOrder[(currentIndex - 1 + zoneOrder.length) % zoneOrder.length];
        centerOnZone(prev);
        revealZoneContent(prev);
        break;
      }
      case 'Home':
        e.preventDefault();
        centerOnZone('zone-origin');
        break;
      case 'Escape':
        document.getElementById('nav-nodes').hidden = true;
        document.getElementById('nav-toggle')?.setAttribute('aria-expanded', 'false');
        break;
      default:
        break;
    }
  });
}

/* ─── Art piece navigation ─── */
document.querySelectorAll('.art-piece').forEach((piece, i) => {
  const targets = ['zone-gallery', 'zone-writing', 'zone-apps', 'zone-art'];
  piece.addEventListener('click', () => {
    if (targets[i]) centerOnZone(targets[i]);
  });
  piece.style.cursor = 'pointer';
});

/* ─── Utility ─── */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

init();
