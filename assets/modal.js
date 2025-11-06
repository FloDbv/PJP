/* ========= Hardened Modal Manager (single file) =========
   Expects your CSS classes/ids:
   - .modal-overlay   (backdrop)
   - .modal-panel     (dialog box)
   - .modal-close     (X button)
   - #modal-title     (header title)
   - #modal-body      (content container)
   Triggers:
   - [data-modal="path/to/fragment.html"]    -> loads HTML fragment
   - [data-modal-url="/full/page.html"]      -> loads in iframe
   Optional: data-modal-size="mod-size-xl" , data-title="..."
========================================================== */
;if (window.__PJP_MODAL_LOADED__) { /* already loaded */ void 0; } else { window.__PJP_MODAL_LOADED__ = true;
// ---------- overlay markup (created once) ----------
const overlay = document.createElement('div');
overlay.className = 'modal-overlay';
overlay.innerHTML = `
  <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <header class="modal-head">
      <h3 id="modal-title"></h3>
      <button class="modal-close" type="button" aria-label="Close">×</button>
    </header>
    <div id="modal-body" class="modal-body"></div>
  </div>
`;
document.body.appendChild(overlay);

const panel    = overlay.querySelector('.modal-panel');
const titleEl  = overlay.querySelector('#modal-title');
const body     = overlay.querySelector('#modal-body');
const btnClose = overlay.querySelector('.modal-close');

// ---------- modal state ----------
let isOpen = false;
let lastTrigger = null;
// token/abort pair – guarantees only the latest open can change the DOM
let current = { token: 0, abort: null };

// ---------- helpers ----------
function applySize(sizeClass) {
  overlay.classList.remove('mod-size-xl');
  if (sizeClass) overlay.classList.add(sizeClass);
}

// Fragments (and most iframe pages) live under /modals/
const FRAG_BASE = 'modals/';

function resolveUrl(slug) {
  if (!slug) return '';

  // pass through absolute URLs unchanged
  if (/^https?:\/\//i.test(slug)) return slug;

  // strip leading slashes (so "/personal-training" works too)
  slug = slug.replace(/^\/+/, '');

  // ensure .html suffix
  if (!/\.html(?:$|[?#])/.test(slug)) slug += '.html';

  // prefix our fragments directory
  return FRAG_BASE + slug;
}

function beginOpen(sizeClass, headerText) {
  // cancel any prior job
  current.abort?.abort();
  current.abort = new AbortController();
  current.token += 1;

  // UI prep
  applySize(sizeClass);
  titleEl.textContent = headerText || '';
  overlay.classList.add('is-open');
  isOpen = true;

  // prevent background scroll only while open
  document.documentElement.style.overflow = 'hidden';

  // restart CSS animations (Safari/iOS safety)
  panel.style.animation = 'none'; panel.offsetHeight; panel.style.animation = '';
  overlay.style.animation = 'none'; overlay.offsetHeight; overlay.style.animation = '';

  return { token: current.token, signal: current.abort.signal };
}

// Re-exec any <script> tags that arrive inside fragments
function reviveScripts(scopeEl) {
  scopeEl.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    if (old.src) s.src = old.src;
    else s.textContent = old.textContent;
    old.parentNode.replaceChild(s, old);
  });
}

// ---------- open modes ----------
function openFragment(slug, sizeClass, headerText) {
  if (!slug) return;

  const { token, signal } = beginOpen(sizeClass, headerText);
  body.innerHTML = '<p class="section">Loading…</p>';

  fetch(resolveUrl(slug), { cache: 'no-store', signal })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(html => {
      if (token !== current.token || !isOpen) return; // superseded/closed
      body.innerHTML = html;
      reviveScripts(body);

      // optional: let the fragment decide title by having first h3/h2
      if (!headerText) {
        const h = body.querySelector('h1,h2,h3');
        if (h) titleEl.textContent = h.textContent.trim();
      }

      // focus the first focusable
      const first = body.querySelector('input,select,textarea,button,a[href],[tabindex]:not([tabindex="-1"])');
      if (first) {
        first.focus({ preventScroll: true });
      } else {
        panel.setAttribute('tabindex', '-1');
        panel.focus({ preventScroll: true });
        panel.removeAttribute('tabindex');
      }
    })
    .catch(err => {
      if (err?.name === 'AbortError') return;
      if (token !== current.token || !isOpen) return;
      body.innerHTML = '<p class="section">Could not load this content.</p>';
      titleEl.textContent = headerText || 'Error';
      console.warn('Modal fragment load failed:', err);
    });
}

function openIframe(url, sizeClass, headerText) {
  if (!url) return;

  const { token } = beginOpen(sizeClass, headerText);

  // kill any existing iframe
  const prev = document.getElementById('modal-iframe');
  if (prev) { try { prev.src = 'about:blank'; } catch(_) {} prev.remove(); }

  body.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.id = 'modal-iframe';
  iframe.className = 'modal-iframe';
  iframe.loading = 'eager';
  iframe.src = /^https?:\/\//i.test(url) || url.startsWith('/') ? url : (FRAG_BASE + url.replace(/^\/+/, ''));

  iframe.addEventListener('load', () => {
    if (token !== current.token || !isOpen) return;
    try {
      if (!headerText && iframe.contentDocument?.title) {
        titleEl.textContent = iframe.contentDocument.title;
      }
      // nudge maps etc.
      iframe.contentWindow?.dispatchEvent(new Event('resize'));
      setTimeout(() => { try { iframe.contentWindow?.dispatchEvent(new Event('resize')); } catch(_) {} }, 120);
    } catch(_) {}
  });

  body.appendChild(iframe);

  panel.setAttribute('tabindex', '-1');
  panel.focus({ preventScroll: true });
  panel.removeAttribute('tabindex');
}

// ---------- close ----------
function closeModal() {
  if (!isOpen) return;

  // cancel in-flight
  current.abort?.abort();
  current.abort = null;
  current.token += 1;

  isOpen = false;
  overlay.classList.remove('is-open', 'mod-size-xl');
  document.documentElement.style.overflow = '';

  // kill any iframe
  const frame = document.getElementById('modal-iframe');
  if (frame) { try { frame.src = 'about:blank'; } catch(_) {} frame.remove(); }

  // wipe
  body.innerHTML = '';
  titleEl.textContent = '';

  // return focus
  if (lastTrigger && typeof lastTrigger.focus === 'function') {
    lastTrigger.focus({ preventScroll: true });
  }
}

// ---------- wiring ----------
overlay.addEventListener('click', (e) => {
  // backdrop click closes
  if (e.target === overlay) { closeModal(); return; }
  // any .modal-close or [data-close] inside closes
  if (e.target.closest('.modal-close, [data-close]')) {
    e.preventDefault();
    closeModal();
  }
});

btnClose.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
});

// Global trigger (delegated)
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-modal],[data-modal-url]');
  if (!trigger) return;

  e.preventDefault();
  lastTrigger = trigger;

  const sizeClass = trigger.getAttribute('data-modal-size') || '';
  const titleText = trigger.getAttribute('data-title') || '';

  const url = trigger.getAttribute('data-modal-url');
  if (url) { openIframe(url, sizeClass, titleText); return; }

  const slug = trigger.getAttribute('data-modal');
  if (slug) { openFragment(slug, sizeClass, titleText); }
});

// expose for debugging if needed
window.__pjpModal = { openFragment, openIframe, closeModal };
}
