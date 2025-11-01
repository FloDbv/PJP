// Modal loader with HTML fragment and IFRAME support
(function () {
  // Optional explicit mapping for fragment modals if names differ
  const MODAL_MAP = {
    "personal-training": "modals/personal-training.html",
    // add other exceptions here if needed
  };

  // Build overlay once
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div class="modal-title" id="modal-title">Loading…</div>
        <button class="modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const panel    = overlay.querySelector('.modal-panel');
  const body     = overlay.querySelector('#modal-body');

  // Ensure modal scrolls internally on small viewports
  window.addEventListener('resize', () => {
    const panelEl = document.querySelector('.modal-panel');
    if (panelEl) {
      if (window.innerHeight < 600) panelEl.style.overflowY = 'auto';
      else panelEl.style.overflowY = 'visible';
    }
  });
  const titleEl  = overlay.querySelector('#modal-title');
  const btnClose = overlay.querySelector('.modal-close');
  
  let lastTrigger = null;

  // ----- Initialize any availability widgets inside a just-loaded modal body
function initAvailabilityWidgets(root) {
  if (!root) return;

  // ---------- Option A: simple chips (days + windows shared) ----------
  (function(){
    const daysRow    = root.querySelector('#chipDays');
    const windowsRow = root.querySelector('#chipWindows');
    const outJSON    = root.querySelector('#availJSON');
    const outHuman   = root.querySelector('#availHuman');
    const btnAllDays = root.querySelector('#chipAllDays');
    const btnClear   = root.querySelector('#chipClear');

    if (!daysRow || !windowsRow || !outJSON || !outHuman) return; // not present in this fragment

    const state = { days: new Set(), windows: new Set() };

    function renderVisibility(){
      windowsRow.classList.toggle('is-visible', state.days.size > 0);
    }
    function serialize(){
      const obj = {};
      state.days.forEach(d => { obj[d] = Array.from(state.windows); });
      outJSON.value = JSON.stringify(obj);

      const dayLabel = {mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
      const winLabel = {morning:'morning',afternoon:'afternoon',evening:'evening'};
      const parts = [];
      Object.keys(obj).forEach(d=>{
        if (obj[d].length) parts.push(`${dayLabel[d]}: ${obj[d].map(w=>winLabel[w]).join(', ')}`);
      });
      outHuman.value = parts.join(' | ');
    }
    function toggleChip(chip, set, key){
      const on = chip.classList.toggle('is-selected');
      if (on) set.add(key); else set.delete(key);
      renderVisibility(); serialize();
    }

    daysRow.addEventListener('click', e=>{
      const chip = e.target.closest('.chip[data-day]');
      if (!chip) return;
      toggleChip(chip, state.days, chip.dataset.day);
    });
    windowsRow.addEventListener('click', e=>{
      const chip = e.target.closest('.chip-window');
      if (!chip) return;
      toggleChip(chip, state.windows, chip.dataset.window);
    });

    btnAllDays?.addEventListener('click', ()=>{
      daysRow.querySelectorAll('.chip[data-day]').forEach(ch=>{
        ch.classList.add('is-selected');
        state.days.add(ch.dataset.day);
      });
      renderVisibility(); serialize();
    });
    btnClear?.addEventListener('click', ()=>{
      [...daysRow.querySelectorAll('.chip'), ...windowsRow.querySelectorAll('.chip')].forEach(ch=>ch.classList.remove('is-selected'));
      state.days.clear(); state.windows.clear();
      renderVisibility(); serialize();
    });

    renderVisibility(); serialize();
  })();

  // ---------- Option B: two-step wizard (days first, then per-day windows) ----------
  (function(){
    const rootWiz = root.querySelector('#wizAvail');
    if (!rootWiz) return;

    const stepDays   = rootWiz.querySelector('[data-step="days"]');
    const stepWins   = rootWiz.querySelector('[data-step="windows"]');
    const chipsDays  = rootWiz.querySelector('#wizDays');
    const btnNext    = rootWiz.querySelector('#wizNext');
    const btnBack    = rootWiz.querySelector('#wizBack');
    const btnDone    = rootWiz.querySelector('#wizDone');
    const winsWrap   = rootWiz.querySelector('#wizWindows');

    const outJSON  = root.querySelector('#availJSON');
    const outHuman = root.querySelector('#availHuman');

    const state = { days: new Set(), byDay: {} };
    const dayLabel = {mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
    const winLabel = {morning:'Morning',afternoon:'Afternoon',evening:'Evening'};

    function toggleChip(chip, set, key){
      const on = chip.classList.toggle('is-selected');
      if (on) set.add(key); else set.delete(key);
    }

    chipsDays.addEventListener('click', e=>{
      const chip = e.target.closest('.chip[data-day]');
      if (!chip) return;
      toggleChip(chip, state.days, chip.dataset.day);
      btnNext.disabled = state.days.size === 0;
    });

    function buildWindowsUI(){
      winsWrap.innerHTML = '';
      state.byDay = {};
      state.days.forEach(day=>{
        state.byDay[day] = new Set();
        const block = document.createElement('div');
        block.className = 'wiz-day-block';

        const title = document.createElement('div');
        title.className = 'wiz-day-title';
        title.textContent = dayLabel[day];
        block.appendChild(title);

        const row = document.createElement('div');
        row.className = 'chips-row';
        ['morning','afternoon','evening'].forEach(w=>{
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'chip';
          b.dataset.day = day;
          b.dataset.window = w;
          b.textContent = winLabel[w];
          row.appendChild(b);
        });
        block.appendChild(row);
        winsWrap.appendChild(block);
      });
    }

    btnNext?.addEventListener('click', ()=>{
      buildWindowsUI();
      stepDays.classList.add('is-hidden');
      stepWins.classList.remove('is-hidden');
    });
    btnBack?.addEventListener('click', ()=>{
      stepWins.classList.add('is-hidden');
      stepDays.classList.remove('is-hidden');
    });

    winsWrap.addEventListener('click', e=>{
      const chip = e.target.closest('.chip[data-window]');
      if (!chip) return;
      const d = chip.dataset.day, w = chip.dataset.window;
      chip.classList.toggle('is-selected');
      const set = state.byDay[d] || (state.byDay[d] = new Set());
      if (chip.classList.contains('is-selected')) set.add(w); else set.delete(w);
    });

    function serialize(){
      const obj = {};
      Object.keys(state.byDay).forEach(d=>{ obj[d] = Array.from(state.byDay[d] || []); });
      if (outJSON)  outJSON.value  = JSON.stringify(obj);
      if (outHuman) outHuman.value = Object.keys(obj)
        .filter(d => obj[d].length)
        .map(d => `${dayLabel[d]}: ${obj[d].map(w=>winLabel[w]).join(', ')}`)
        .join(' | ');
    }
    btnDone?.addEventListener('click', serialize);
  })();
}


  function resolveUrl(slug) {
    return MODAL_MAP[slug] || `modals/${slug}.html`;
  }

  function setHeaderTitleFromContent() {
    const h =
      body.querySelector('[data-title]') ||
      body.querySelector('.modal-title') ||
      body.querySelector('h1, h2, h3');
    titleEl.textContent = h ? h.textContent.trim() : 'Details';
  }

  function applySize(size) {
    overlay.classList.remove('mod-size-xl');
    if (size === 'xl') overlay.classList.add('mod-size-xl');
  }

  function openFragment(slug, size, titleText) {
    if (!slug) return;
    applySize(size);
    titleEl.textContent = titleText || 'Loading…';
    body.innerHTML = '<p class="section">Please wait…</p>';
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';

    fetch(resolveUrl(slug), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(html => {
        body.innerHTML = html;
        // initialize any widgets inside this fragment
        initAvailabilityWidgets(body);
        
        // initialize the recap-capable wizard
        if (typeof window.initAvailabilityWizard === 'function') {
          window.initAvailabilityWizard(body);
        }
        bindPtForm(body); // <-- ensure the submit handler is attached to the injected form
        // After content is injected, place the close button inside the first section (desktop)
        // and hide it on mobile (the bottom nav closes modals there).
        (function () {
          const isDesktop = window.matchMedia('(min-width: 769px)').matches;
          const btnClose  = overlay.querySelector('.modal-close');
          if (!btnClose) return;

          if (isDesktop) {
    const firstSection = body.querySelector('.section, .modal-body > div');
    if (firstSection) {
      firstSection.style.position = 'relative';
      firstSection.appendChild(btnClose); // re-parent
      btnClose.classList.add('in-section');
    }
  } else {
    // mobile: no close button (footer bar handles closing)
    btnClose.style.display = 'none';
  }
})();

        if (!titleText) setHeaderTitleFromContent();
        const first = body.querySelector('input, select, textarea, button, a, [tabindex]:not([tabindex="-1"])');
        (first || btnClose).focus({ preventScroll: true });
      })
      .catch(err => {
        console.warn('Modal fetch failed:', err);
        body.innerHTML = `<p class="section">Could not load this content.</p>`;
        titleEl.textContent = 'Error';
      });
  }

    function openIframe(url, size, titleText) {
    if (!url) return;
    applySize(size);
    titleEl.textContent = titleText || 'Loading…';
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';

    // create the iframe
    body.innerHTML = '';
    // After content is injected, place the close button inside the first section (desktop)
// and hide it on mobile (the bottom nav closes modals there).
(function () {
  const isDesktop = window.matchMedia('(min-width: 769px)').matches;
  const btnClose  = overlay.querySelector('.modal-close');
  if (!btnClose) return;

  if (isDesktop) {
    const firstSection = body.querySelector('.section, .modal-body > div');
    if (firstSection) {
      firstSection.style.position = 'relative';
      firstSection.appendChild(btnClose); // re-parent
      btnClose.classList.add('in-section');
    }
  } else {
    // mobile: no close button (footer bar handles closing)
    btnClose.style.display = 'none';
  }
})();

    const iframe = document.createElement('iframe');
    iframe.className = 'modal-iframe';
    iframe.loading = 'eager';
    iframe.src = url;

    iframe.addEventListener('load', () => {
      // If the iframe document has a title and we didn't force one, use it
      try {
        if (!titleText && iframe.contentDocument && iframe.contentDocument.title) {
          titleEl.textContent = iframe.contentDocument.title;
        }
      } catch (_) { /* cross-origin safety, but same-origin here */ }

      // ✅ Kick map resize once the iframe has loaded
      setTimeout(() => {
        try { iframe.contentWindow.dispatchEvent(new Event('resize')); } catch (_) {}
      }, 100);
      setTimeout(() => {
        try { iframe.contentWindow.dispatchEvent(new Event('resize')); } catch (_) {}
      }, 300);
    });

    body.appendChild(iframe);
    // After content is injected, place the close button inside the first section (desktop)
// and hide it on mobile (the bottom nav closes modals there).
(function () {
  const isDesktop = window.matchMedia('(min-width: 769px)').matches;
  const btnClose  = overlay.querySelector('.modal-close');
  if (!btnClose) return;

  if (isDesktop) {
    const firstSection = body.querySelector('.section, .modal-body > div');
    if (firstSection) {
      firstSection.style.position = 'relative';
      firstSection.appendChild(btnClose); // re-parent
      btnClose.classList.add('in-section');
    }
  } else {
    // mobile: no close button (footer bar handles closing)
    btnClose.style.display = 'none';
  }
})();

    // ✅ Kick one more time after modal animation finishes
    setTimeout(() => {
      try { iframe.contentWindow.dispatchEvent(new Event('resize')); } catch (_) {}
    }, 400);

    btnClose.focus({ preventScroll: true });
  }

  function closeModal() {
    // ⬅️ NEW: return the close button to the header so it isn't destroyed
    const header = overlay.querySelector('.modal-header');
    const btn    = overlay.querySelector('.modal-close');
    if (header && btn) {
      btn.classList.remove('in-section');
      btn.style.display = '';           // reset any mobile hide
      header.appendChild(btn);          // park it back in the header
    }
    overlay.classList.remove('is-open', 'mod-size-xl');
    document.documentElement.style.overflow = '';
    body.innerHTML = '';
    if (lastTrigger && lastTrigger.focus) {
      lastTrigger.focus({ preventScroll: true });
    }
  }

  // Close interactions
  btnClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal(); });
  // Also close when tapping the bottom footer nav (mobile)
  // Works even if the page then smooth-scrolls to a section.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.mobile-fixed-nav a[href^="#"]');
    if (!link) return;
    if (overlay.classList.contains('is-open')) closeModal();
  });

  // Generic trigger: any element with data-modal or data-modal-url
  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('[data-modal],[data-modal-url]');
    if (!trigger) return;

    e.preventDefault();
    lastTrigger = trigger;

    const titleText = trigger.getAttribute('data-title') || '';
    const size      = trigger.getAttribute('data-modal-size') || ''; // '', 'xl'

    const url = trigger.getAttribute('data-modal-url');
    if (url) {
      openIframe(url, size, titleText);
      return;
    }

    const slug = trigger.getAttribute('data-modal');
    if (slug) {
      openFragment(slug, size, titleText);
    }
  });

})();
/* ===== Chips availability selector (days & windows) ===== */
(function(){
  const daysRow = document.getElementById('chipDays');
  const windowsRow = document.getElementById('chipWindows');
  const outJSON = document.getElementById('availJSON');
  const outHuman = document.getElementById('availHuman');
  const btnAllDays = document.getElementById('chipAllDays');
  const btnClear = document.getElementById('chipClear');

  if (!daysRow || !windowsRow) return; // not on this modal

  const state = {
    days: new Set(),              // mon, tue, ...
    windows: new Set()            // morning, afternoon, evening
  };

  function renderVisibility(){
    windowsRow.classList.toggle('is-visible', state.days.size > 0);
  }

  function serialize(){
    // Build an object like { mon:['morning','evening'], tue:[...] }
    const obj = {};
    state.days.forEach(d => {
      obj[d] = Array.from(state.windows);
    });
    outJSON.value = JSON.stringify(obj);

    // Human string
    const dayLabel = {mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
    const winLabel = {morning:'morning',afternoon:'afternoon',evening:'evening'};
    const parts = [];
    Object.keys(obj).forEach(d=>{
      if (obj[d].length) parts.push(`${dayLabel[d]}: ${obj[d].map(w=>winLabel[w]).join(', ')}`);
    });
    outHuman.value = parts.join(' | ');
  }

  function toggleChip(chip, set, key){
    const isSelected = chip.classList.toggle('is-selected');
    if (isSelected) set.add(key); else set.delete(key);
    renderVisibility(); serialize();
  }

  // Day chips
  daysRow.addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip[data-day]');
    if (!chip) return;
    toggleChip(chip, state.days, chip.dataset.day);
  });

  // Window chips
  windowsRow.addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip-window');
    if (!chip) return;
    toggleChip(chip, state.windows, chip.dataset.window);
  });

  // Helpers
  btnAllDays?.addEventListener('click', ()=>{
    daysRow.querySelectorAll('.chip[data-day]').forEach(ch=>{
      ch.classList.add('is-selected');
      state.days.add(ch.dataset.day);
    });
    renderVisibility(); serialize();
  });
  btnClear?.addEventListener('click', ()=>{
    [...daysRow.querySelectorAll('.chip'), ...windowsRow.querySelectorAll('.chip')]
      .forEach(ch=>ch.classList.remove('is-selected'));
    state.days.clear(); state.windows.clear();
    renderVisibility(); serialize();
  });

  renderVisibility(); serialize();
})();

// === Availability wizard (scoped, robust) ===============================
window.initAvailabilityWizard = function initAvailabilityWizard(root) {
  // Allow calling with the modal content element OR default to the document
  var container = (root && root.querySelector) ? root : document;
  var wiz = container.querySelector('#wizAvail');
  if (!wiz) return; // nothing to do on other modals

  var daysWrap   = wiz.querySelector('#wizDays');
  var nextBtn    = wiz.querySelector('#wizNext');
  var backBtn    = wiz.querySelector('#wizBack');
  var doneBtn    = wiz.querySelector('#wizDone');
  var winHost    = wiz.querySelector('#wizWindows');
  var stepDays   = wiz.querySelector('.wiz-step[data-step="days"]');
  var stepWins   = wiz.querySelector('.wiz-step[data-step="windows"]');
  var recapBox   = wiz.querySelector('#wizRecap');
  var recapText  = wiz.querySelector('#wizRecapText');
  var editBtn    = wiz.querySelector('#wizEdit');
  var outJSON    = wiz.querySelector('#availJSON');
  var outHuman   = wiz.querySelector('#availHuman');

  if (!daysWrap || !nextBtn || !winHost || !stepDays || !stepWins ||
      !recapBox || !recapText || !outJSON || !outHuman) {
    // essential nodes missing; abort safely
    return;
  }

  // selection state
  var selectedDays = new Set();
  var windowsByDay = {};  // { mon:['morning',...], tue:[] }

  // toggle day chips
  daysWrap.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip[data-day]');
    if (!chip) return;
    var key = chip.getAttribute('data-day');
    if (selectedDays.has(key)) {
      selectedDays.delete(key);
      chip.classList.remove('is-selected');
    } else {
      selectedDays.add(key);
      chip.classList.add('is-selected');
    }
    nextBtn.disabled = selectedDays.size === 0;
  });

  // build windows UI for selected days
  function buildWindowsUI() {
    winHost.innerHTML = '';
    selectedDays.forEach(function (dayKey) {
      if (!windowsByDay[dayKey]) windowsByDay[dayKey] = [];
      var dayLabel = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);

      var section = document.createElement('div');
      section.className = 'wiz-day-block';
      section.innerHTML = [
        '<div class="wiz-day-title">', dayLabel, '</div>',
        '<div class="chips-row" data-day="', dayKey, '">',
          '<button type="button" class="chip" data-window="morning">Morning</button>',
          '<button type="button" class="chip" data-window="afternoon">Afternoon</button>',
          '<button type="button" class="chip" data-window="evening">Evening</button>',
        '</div>'
      ].join('');

      winHost.appendChild(section);

      // mark preselected windows (if any)
      var row = section.querySelector('.chips-row');
      windowsByDay[dayKey].forEach(function (w) {
        var btn = row.querySelector('.chip[data-window="' + w + '"]');
        if (btn) btn.classList.add('is-selected');
      });
    });
  }

  // handle window chip toggles (event delegation)
  winHost.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip[data-window]');
    if (!chip) return;
    var row = chip.closest('.chips-row');
    var day = row.getAttribute('data-day');
    var w   = chip.getAttribute('data-window');
    var list = windowsByDay[day] || (windowsByDay[day] = []);
    var i = list.indexOf(w);
    if (i >= 0) { list.splice(i, 1); chip.classList.remove('is-selected'); }
    else        { list.push(w);       chip.classList.add('is-selected'); }
  });

  // navigation
  nextBtn.addEventListener('click', function () {
    if (selectedDays.size === 0) return;
    buildWindowsUI();
    stepDays.classList.add('is-hidden');
    recapBox.classList.add('is-hidden');
    stepWins.classList.remove('is-hidden');
  });

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      stepWins.classList.add('is-hidden');
      recapBox.classList.add('is-hidden');
      stepDays.classList.remove('is-hidden');
    });
  }

  if (doneBtn) {
  doneBtn.addEventListener('click', function () {
    // 1) Collect ordered data from selections
    var dayOrder = ['mon','tue','wed','thu','fri','sat','sun'];
    var labels   = {mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun'};
    var timeOrder = ['morning','afternoon','evening'];
    var timeLabel = {morning:'Morning', afternoon:'Afternoon', evening:'Evening'};

    var data = {};
    dayOrder.forEach(function (d) {
      var arr = (windowsByDay[d] || []).slice();
      arr.sort(function(a,b){ return timeOrder.indexOf(a) - timeOrder.indexOf(b); });
      if (arr.length) data[d] = arr;
    });

    // nothing picked? bounce back to Step 1
    if (Object.keys(data).length === 0) {
      stepWins.classList.add('is-hidden');
      stepDays.classList.remove('is-hidden');
      nextBtn.disabled = true;
      return;
    }

    // 2) Outputs for the form
    outJSON.value = JSON.stringify(data);
    outHuman.value = Object.keys(data).map(function (d) {
      return labels[d] + ': ' + data[d].map(function (w) { return timeLabel[w]; }).join(', ');
    }).join(' • ');

    // Mirror into data-attributes so the submit hook can read them even if recap is hidden
      recapBox.dataset.json  = outJSON.value;
      recapBox.dataset.human = outHuman.value;

    // 3) Build recap as a neat grid
    var rowsHTML = Object.keys(data).map(function (d) {
      var chips = data[d]
        .map(function (w) { return '<span class="chip-mini">' + timeLabel[w] + '</span>'; })
        .join(' ');
      return (
        '<li class="recap-row">' +
          '<span class="recap-day">'   + labels[d] + '</span>' +
          '<span class="recap-times">' + chips     + '</span>' +
        '</li>'
      );
    }).join('');

    recapText.innerHTML = '<ul class="recap-grid">' + rowsHTML + '</ul>';

    // 4) Show recap and scroll to it
    stepWins.classList.add('is-hidden');
    recapBox.classList.remove('is-hidden');
    recapBox.scrollIntoView({ behavior:'smooth', block:'center' });
  });
}

  if (editBtn) {
  editBtn.addEventListener('click', function () {
    // Hide recap
    recapBox.classList.add('is-hidden');
    // Show step 1 (day selection)
    stepDays.classList.remove('is-hidden');
    // Enable the "Next" button again
    nextBtn.disabled = false;
    // Optionally scroll smoothly to the top of the wizard
    stepDays.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  }
};

// After modal content is injected, modal.js should already do this:
// if (typeof window.initAvailabilityWizard === 'function') {
//   window.initAvailabilityWizard(contentEl);
// }
// Bind Web3Forms submit for a PT request form inside a given root (inline success)
function bindPtForm(root) {
  const form = root.querySelector('#pt-request');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // ✅ keep user in the modal

    // 1) Ensure the wizard outputs are filled
    const recap  = form.querySelector('#wizRecap');
    const human  = form.querySelector('#availHuman');
    const json   = form.querySelector('#availJSON');
    const status = form.querySelector('#pt-status');

    // prefer what the wizard wrote…
    if (!human.value && recap?.dataset?.human) human.value = recap.dataset.human;
    if (!json.value  && recap?.dataset?.json)  json.value  = recap.dataset.json;

    // add package to subject (nice UX)
    const pkg = form.querySelector('#pt-package')?.value || 'N/A';
    const subject = form.querySelector('input[name="subject"]');
    if (subject) subject.value = `New PT request — ${pkg}`;

    // 2) Submit to Web3Forms via fetch
    status.textContent = 'Sending…';
    status.style.color = 'var(--muted)';
    const fd = new FormData(form);

    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: fd
      });
      const data = await r.json();

      if (data.success) {
        // 3) Inline success UI
        form.innerHTML = `
          <div class="section" style="text-align:center; padding:2rem 1rem;">
            <h3 style="margin-bottom:.5rem;">Request sent ✓</h3>
            <p class="muted">Thanks! You’ll receive a confirmation by email within 24 hours.</p>
            <div style="margin:1rem 0;">
              <strong>Summary</strong><br>
              <small>${human.value ? human.value : 'No availability preferences provided.'}</small>
            </div>
            <button type="button" class="primary" id="pt-close">Close</button>
          </div>
        `;
        // close button returns the user to the page
        form.querySelector('#pt-close')?.addEventListener('click', () => {
          document.querySelector('.modal-close')?.click();
        });
      } else {
        status.textContent = data.message || 'Submit failed. Please try again.';
        status.style.color = 'var(--danger, #ff6b6b)';
      }
    } catch (err) {
      status.textContent = 'Network error. Please try again.';
      status.style.color = 'var(--danger, #ff6b6b)';
      console.error(err);
    }
  });
}