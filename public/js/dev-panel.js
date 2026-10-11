/**
 * YTÜ BKFK - Yerel Geliştirici & Canlı Tasarım Müfettişi (Dev Panel)
 * SADECE localhost / 127.0.0.1 üzerinde çalışır.
 * Sitedeki herhangi bir elemente tıklayarak boyutunu, rengini ve aralığını anında değiştirmeyi sağlar.
 */

(function () {
  'use strict';

  // 1. Sadece Yerel Geliştirme Ortamında Çalıştır
  const isLocal =
    ['localhost', '127.0.0.1', '::1', ''].includes(window.location.hostname) ||
    window.location.hostname.endsWith('.local') ||
    new URLSearchParams(window.location.search).has('dev');

  if (!isLocal) {
    return; // Canlıda (Production) tamamen devre dışı!
  }

  // State
  let inspecting = false;
  let selectedElement = null;
  let hoveredElement = null;
  let customStyles = {};

  try {
    customStyles = JSON.parse(localStorage.getItem('bkfk_dev_styles') || '{}');
  } catch {
    customStyles = {};
  }

  // Restore saved styles on load
  function applySavedStyles() {
    for (const [selector, rules] of Object.entries(customStyles)) {
      const el = document.querySelector(selector);
      if (el) {
        for (const [prop, val] of Object.entries(rules)) {
          el.style.setProperty(prop, val, 'important');
          if (prop === 'background-color' && (selector === 'body' || selector === '#main-container')) {
            document.documentElement.style.setProperty('--bg-pure', val);
          }
        }
      }
    }
  }

  // Inject Styles for Dev Panel
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Dev Inspector Highlight */
    .dev-inspect-hover {
      outline: 2px dashed #00f0ff !important;
      outline-offset: 3px !important;
      cursor: crosshair !important;
    }
    .dev-inspect-selected {
      outline: 2px solid #eab308 !important;
      outline-offset: 3px !important;
    }

    /* Floating Dev Widget */
    #dev-panel-root {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #f3f4f6;
    }

    #dev-panel-toggle {
      background: #18181b;
      border: 1px solid #d4af37;
      color: #d4af37;
      padding: 8px 14px;
      border-radius: 999px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      transition: all 0.2s;
    }
    #dev-panel-toggle:hover {
      background: #27272a;
      transform: translateY(-2px);
    }

    #dev-panel-window {
      display: none;
      width: 320px;
      max-height: 85vh;
      overflow-y: auto;
      background: #111113;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.85);
      padding: 14px;
      margin-bottom: 8px;
    }

    .dev-p-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid #27272a;
      margin-bottom: 10px;
    }
    .dev-p-title {
      font-weight: 700;
      color: #d4af37;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dev-btn-close {
      background: transparent;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
      font-size: 14px;
    }

    /* Inspect Mode Button */
    .dev-inspect-btn {
      width: 100%;
      padding: 8px;
      background: #27272a;
      border: 1px solid #52525b;
      color: #fafafa;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 10px;
      transition: all 0.2s;
    }
    .dev-inspect-btn.active {
      background: #0284c7;
      border-color: #38bdf8;
      color: #fff;
    }

    /* Quick Shortcuts */
    .dev-shortcuts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 12px;
    }
    .dev-shortcut-chip {
      background: #1f1f23;
      border: 1px solid #333;
      color: #d4d4d8;
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 4px;
      cursor: pointer;
    }
    .dev-shortcut-chip:hover {
      background: #2e2e33;
      color: #fff;
    }

    /* Target Element Info */
    .dev-target-info {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 12px;
      font-family: monospace;
      font-size: 11px;
      color: #38bdf8;
      word-break: break-all;
    }

    /* Controls Grid */
    .dev-control-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
    }
    .dev-control-row label {
      font-size: 11px;
      color: #a1a1aa;
      display: flex;
      justify-content: space-between;
    }
    .dev-slider-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dev-slider-wrap input[type="range"] {
      flex: 1;
      accent-color: #d4af37;
    }
    .dev-slider-wrap span {
      font-size: 11px;
      color: #d4d4d8;
      width: 42px;
      text-align: right;
    }

    .dev-color-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dev-color-wrap input[type="color"] {
      width: 32px;
      height: 28px;
      border: none;
      background: transparent;
      cursor: pointer;
    }
    .dev-color-wrap input[type="text"] {
      flex: 1;
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      color: #fff;
      padding: 4px 8px;
      font-size: 11px;
      font-family: monospace;
    }

    /* Footer Buttons */
    .dev-actions {
      display: flex;
      gap: 6px;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #27272a;
    }
    .dev-btn {
      flex: 1;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      text-align: center;
    }
    .dev-btn-copy {
      background: #1e3a8a;
      border-color: #3b82f6;
      color: #fff;
    }
    .dev-btn-reset {
      background: #27272a;
      border-color: #3f3f46;
      color: #ef4444;
    }
    .dev-toast {
      margin-top: 6px;
      font-size: 11px;
      text-align: center;
      color: #10b981;
      min-height: 14px;
    }
  `;
  document.head.appendChild(styleEl);

  // Create Dev Panel HTML
  const root = document.createElement('div');
  root.id = 'dev-panel-root';
  root.innerHTML = `
    <div id="dev-panel-window">
      <div class="dev-p-header">
        <span class="dev-p-title">🛠️ Dev Canlı Tasarım Müfettişi</span>
        <button id="dev-close-x" class="dev-btn-close">✕</button>
      </div>

      <button id="dev-inspect-toggle" class="dev-inspect-btn">
        <span>🎯 Element Seç (Tıkla ve Düzenle)</span>
      </button>

      <div class="dev-shortcuts">
        <span class="dev-shortcut-chip" data-sel="body">⬛ Arka Plan</span>
        <span class="dev-shortcut-chip" data-sel=".crest-text">🏛️ YTÜ Yazısı</span>
        <span class="dev-shortcut-chip" data-sel=".hero-logo-box">🖼️ Logo Kutusu</span>
        <span class="dev-shortcut-chip" data-sel=".bkfk-logo">✨ Logo Görseli</span>
        <span class="dev-shortcut-chip" data-sel=".hero-club-title">👑 Başlık</span>
        <span class="dev-shortcut-chip" data-sel=".status-banner">❖ Durum</span>
        <span class="dev-shortcut-chip" data-sel=".occupancy-pill">✦ Doluluk</span>
        <span class="dev-shortcut-chip" data-sel=".location-btn">📍 Konum</span>
      </div>

      <div id="dev-target-info" class="dev-target-info">Henüz element seçilmedi</div>

      <!-- Controls Form -->
      <div id="dev-controls-body" style="opacity: 0.5; pointer-events: none;">
        
        <!-- Font Size -->
        <div class="dev-control-row">
          <label>Yazı Boyutu (Font Size)</label>
          <div class="dev-slider-wrap">
            <input type="range" id="dev-font-size" min="8" max="72" value="16">
            <span id="dev-font-size-val">16px</span>
          </div>
        </div>

        <!-- Width / Size -->
        <div class="dev-control-row">
          <label>Genişlik / Boyut (Width / Size)</label>
          <div class="dev-slider-wrap">
            <input type="range" id="dev-width" min="40" max="600" value="200">
            <span id="dev-width-val">200px</span>
          </div>
        </div>

        <!-- Height -->
        <div class="dev-control-row">
          <label>Yükseklik (Height)</label>
          <div class="dev-slider-wrap">
            <input type="range" id="dev-height" min="40" max="500" value="200">
            <span id="dev-height-val">200px</span>
          </div>
        </div>

        <!-- Color (Text / Fill) -->
        <div class="dev-control-row">
          <label>Metin / Çizim Rengi (Color)</label>
          <div class="dev-color-wrap">
            <input type="color" id="dev-color-picker" value="#ffffff">
            <input type="text" id="dev-color-text" value="#ffffff" placeholder="#hex">
          </div>
        </div>

        <!-- Background Color -->
        <div class="dev-control-row">
          <label>Arka Plan Rengi (Background)</label>
          <div class="dev-color-wrap">
            <input type="color" id="dev-bg-picker" value="#070708">
            <input type="text" id="dev-bg-text" value="#070708" placeholder="#hex veya rgba">
          </div>
        </div>

        <!-- Border Color -->
        <div class="dev-control-row">
          <label>Çerçeve Rengi (Border Color)</label>
          <div class="dev-color-wrap">
            <input type="color" id="dev-border-picker" value="#c5a059">
            <input type="text" id="dev-border-text" value="#c5a059" placeholder="#hex">
          </div>
        </div>

        <!-- Padding -->
        <div class="dev-control-row">
          <label>İç Boşluk (Padding)</label>
          <div class="dev-slider-wrap">
            <input type="range" id="dev-padding" min="0" max="60" value="12">
            <span id="dev-padding-val">12px</span>
          </div>
        </div>

        <!-- Margin -->
        <div class="dev-control-row">
          <label>Dış Boşluk (Margin Bottom)</label>
          <div class="dev-slider-wrap">
            <input type="range" id="dev-margin" min="0" max="60" value="16">
            <span id="dev-margin-val">16px</span>
          </div>
        </div>

        <!-- Border Radius -->
        <div class="dev-control-row">
          <label>Köşe Yuvarlaklığı (Radius)</label>
          <div class="dev-slider-wrap">
            <input type="range" id="dev-radius" min="0" max="50" value="8">
            <span id="dev-radius-val">8px</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="dev-actions">
        <button id="dev-copy-css" class="dev-btn dev-btn-copy" title="CSS Kodunu Kopyala">📋 CSS Kopyala</button>
        <button id="dev-reset" class="dev-btn dev-btn-reset" title="Tüm Değişiklikleri Sıfırla">↺ Sıfırla</button>
      </div>
      <div id="dev-toast" class="dev-toast"></div>
    </div>

    <!-- Toggle Button -->
    <button id="dev-panel-toggle">
      <span>🛠️</span>
      <span>Dev Panel</span>
    </button>
  `;
  document.body.appendChild(root);

  // References
  const panelWindow = document.getElementById('dev-panel-window');
  const panelToggle = document.getElementById('dev-panel-toggle');
  const closeBtn = document.getElementById('dev-close-x');
  const inspectBtn = document.getElementById('dev-inspect-toggle');
  const targetInfo = document.getElementById('dev-target-info');
  const controlsBody = document.getElementById('dev-controls-body');

  // Input Controls
  const fontSizeSlider = document.getElementById('dev-font-size');
  const fontSizeVal = document.getElementById('dev-font-size-val');
  const widthSlider = document.getElementById('dev-width');
  const widthVal = document.getElementById('dev-width-val');
  const heightSlider = document.getElementById('dev-height');
  const heightVal = document.getElementById('dev-height-val');

  const colorPicker = document.getElementById('dev-color-picker');
  const colorText = document.getElementById('dev-color-text');
  const bgPicker = document.getElementById('dev-bg-picker');
  const bgText = document.getElementById('dev-bg-text');
  const borderPicker = document.getElementById('dev-border-picker');
  const borderText = document.getElementById('dev-border-text');

  const paddingSlider = document.getElementById('dev-padding');
  const paddingVal = document.getElementById('dev-padding-val');
  const marginSlider = document.getElementById('dev-margin');
  const marginVal = document.getElementById('dev-margin-val');
  const radiusSlider = document.getElementById('dev-radius');
  const radiusVal = document.getElementById('dev-radius-val');

  const copyCssBtn = document.getElementById('dev-copy-css');
  const resetBtn = document.getElementById('dev-reset');
  const toastEl = document.getElementById('dev-toast');

  // Open/Close Panel
  panelToggle.addEventListener('click', () => {
    const isHidden = panelWindow.style.display === 'none' || !panelWindow.style.display;
    panelWindow.style.display = isHidden ? 'block' : 'none';
  });

  closeBtn.addEventListener('click', () => {
    panelWindow.style.display = 'none';
    stopInspecting();
  });

  // Toggle Inspect Mode
  inspectBtn.addEventListener('click', () => {
    if (inspecting) {
      stopInspecting();
    } else {
      startInspecting();
    }
  });

  function startInspecting() {
    inspecting = true;
    inspectBtn.classList.add('active');
    inspectBtn.innerHTML = '<span>🎯 Tıklayarak Element Seçin...</span>';
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onElementClick, true);
  }

  function stopInspecting() {
    inspecting = false;
    inspectBtn.classList.remove('active');
    inspectBtn.innerHTML = '<span>🎯 Element Seç (Tıkla ve Düzenle)</span>';
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onElementClick, true);
    if (hoveredElement) {
      hoveredElement.classList.remove('dev-inspect-hover');
      hoveredElement = null;
    }
  }

  function onMouseOver(e) {
    if (!inspecting) return;
    if (e.target.closest('#dev-panel-root')) return;

    const target = (e.target.tagName.toLowerCase() === 'path' && e.target.closest('svg'))
      ? e.target.closest('svg')
      : e.target;

    if (hoveredElement && hoveredElement !== target) {
      hoveredElement.classList.remove('dev-inspect-hover');
    }
    hoveredElement = target;
    hoveredElement.classList.add('dev-inspect-hover');
  }

  function onElementClick(e) {
    if (!inspecting) return;
    if (e.target.closest('#dev-panel-root')) return;

    e.preventDefault();
    e.stopPropagation();

    const target = (e.target.tagName.toLowerCase() === 'path' && e.target.closest('svg'))
      ? e.target.closest('svg')
      : e.target;

    selectTarget(target);
    stopInspecting();
  }

  // Quick Shortcuts
  document.querySelectorAll('.dev-shortcut-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const sel = chip.getAttribute('data-sel');
      const el = document.querySelector(sel);
      if (el) {
        selectTarget(el);
      }
    });
  });

  function getElementSelector(el) {
    if (el === document.body) return 'body';
    if (el.id) return `#${el.id}`;
    if (el.classList.length > 0) {
      const validClasses = Array.from(el.classList).filter(
        (c) => !c.startsWith('dev-inspect')
      );
      if (validClasses.length > 0) return `.${validClasses[0]}`;
    }
    return el.tagName.toLowerCase();
  }

  function selectTarget(el) {
    if (selectedElement) {
      selectedElement.classList.remove('dev-inspect-selected');
    }
    selectedElement = el;
    selectedElement.classList.add('dev-inspect-selected');

    const selector = getElementSelector(el);
    targetInfo.textContent = `${selector} (${el.tagName.toLowerCase()})`;
    controlsBody.style.opacity = '1';
    controlsBody.style.pointerEvents = 'auto';

    // Read computed style
    const comp = window.getComputedStyle(el);

    // Font size
    const fs = parseInt(comp.fontSize) || 16;
    fontSizeSlider.value = fs;
    fontSizeVal.textContent = `${fs}px`;

    // Width
    const w = parseInt(comp.width) || 200;
    widthSlider.value = Math.min(600, Math.max(40, w));
    widthVal.textContent = `${w}px`;

    // Height
    const h = parseInt(comp.height) || 200;
    heightSlider.value = Math.min(500, Math.max(40, h));
    heightVal.textContent = `${h}px`;

    // Color
    const cHex = rgbToHex(comp.color || comp.fill) || '#ffffff';
    colorPicker.value = cHex;
    colorText.value = comp.color || comp.fill || '#ffffff';

    // Background
    const bgHex = rgbToHex(comp.backgroundColor) || '#070708';
    bgPicker.value = bgHex;
    bgText.value = comp.backgroundColor;

    // Border
    const bHex = rgbToHex(comp.borderColor) || '#c5a059';
    borderPicker.value = bHex;
    borderText.value = comp.borderColor;

    // Padding
    const p = parseInt(comp.paddingTop) || 0;
    paddingSlider.value = p;
    paddingVal.textContent = `${p}px`;

    // Margin
    const m = parseInt(comp.marginBottom) || 0;
    marginSlider.value = m;
    marginVal.textContent = `${m}px`;

    // Radius
    const r = parseInt(comp.borderRadius) || 0;
    radiusSlider.value = r;
    radiusVal.textContent = `${r}px`;
  }

  function rgbToHex(col) {
    if (!col || col === 'transparent' || col.includes('rgba(0, 0, 0, 0)')) return '#070708';
    const match = col.match(/\d+/g);
    if (!match || match.length < 3) return '#ffffff';
    return (
      '#' +
      [match[0], match[1], match[2]]
        .map((x) => parseInt(x).toString(16).padStart(2, '0'))
        .join('')
    );
  }

  function setStyleProperty(prop, value) {
    if (!selectedElement) return;
    selectedElement.style.setProperty(prop, value, 'important');

    const selector = getElementSelector(selectedElement);
    if (!customStyles[selector]) customStyles[selector] = {};
    customStyles[selector][prop] = value;

    try {
      localStorage.setItem('bkfk_dev_styles', JSON.stringify(customStyles));
    } catch {}
  }

  // Bind Control Events
  fontSizeSlider.addEventListener('input', (e) => {
    const val = `${e.target.value}px`;
    fontSizeVal.textContent = val;
    setStyleProperty('font-size', val);
  });

  widthSlider.addEventListener('input', (e) => {
    const val = `${e.target.value}px`;
    widthVal.textContent = val;
    setStyleProperty('width', val);
    setStyleProperty('max-width', val);
  });

  heightSlider.addEventListener('input', (e) => {
    const val = `${e.target.value}px`;
    heightVal.textContent = val;
    setStyleProperty('height', val);
  });

  function updateColor(val) {
    setStyleProperty('color', val);
    if (selectedElement) {
      if (selectedElement.tagName.toLowerCase() === 'svg' || selectedElement.classList.contains('bkfk-logo') || selectedElement.querySelector('path')) {
        setStyleProperty('fill', val);
      }
    }
  }

  function updateBgColor(val) {
    setStyleProperty('background-color', val);
    if (selectedElement === document.body || (selectedElement && selectedElement.id === 'main-container')) {
      document.documentElement.style.setProperty('--bg-pure', val);
    }
  }

  colorPicker.addEventListener('input', (e) => {
    colorText.value = e.target.value;
    updateColor(e.target.value);
  });
  colorText.addEventListener('change', (e) => {
    updateColor(e.target.value);
  });

  bgPicker.addEventListener('input', (e) => {
    bgText.value = e.target.value;
    updateBgColor(e.target.value);
  });
  bgText.addEventListener('change', (e) => {
    updateBgColor(e.target.value);
  });

  borderPicker.addEventListener('input', (e) => {
    borderText.value = e.target.value;
    setStyleProperty('border-color', e.target.value);
  });
  borderText.addEventListener('change', (e) => {
    setStyleProperty('border-color', e.target.value);
  });

  paddingSlider.addEventListener('input', (e) => {
    const val = `${e.target.value}px`;
    paddingVal.textContent = val;
    setStyleProperty('padding', val);
  });

  marginSlider.addEventListener('input', (e) => {
    const val = `${e.target.value}px`;
    marginVal.textContent = val;
    setStyleProperty('margin-bottom', val);
  });

  radiusSlider.addEventListener('input', (e) => {
    const val = `${e.target.value}px`;
    radiusVal.textContent = val;
    setStyleProperty('border-radius', val);
  });

  // Copy CSS Action
  copyCssBtn.addEventListener('click', () => {
    let cssText = '/* Canlı Dev Panel ile Düzenlenen Stiller */\n';
    for (const [sel, rules] of Object.entries(customStyles)) {
      cssText += `${sel} {\n`;
      for (const [p, v] of Object.entries(rules)) {
        cssText += `  ${p}: ${v};\n`;
      }
      cssText += `}\n\n`;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(cssText).then(() => {
        showToast('CSS panoya kopyalandı! 📋');
      });
    } else {
      showToast('Kopyalama başarısız');
    }
  });

  // Reset Action
  resetBtn.addEventListener('click', () => {
    if (confirm('Tüm özel stiller sıfırlansın mı?')) {
      customStyles = {};
      localStorage.removeItem('bkfk_dev_styles');
      window.location.reload();
    }
  });

  function showToast(msg) {
    toastEl.textContent = msg;
    setTimeout(() => {
      toastEl.textContent = '';
    }, 2500);
  }

  // Initialize saved styles on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySavedStyles);
  } else {
    applySavedStyles();
  }
})();
