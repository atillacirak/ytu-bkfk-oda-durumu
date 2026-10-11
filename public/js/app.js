/**
 * YTÜ BKFK - Sade & Fantastik Canlı Oda Durumu
 * SSE Canlı Yayın ve /yk Özel Yönetim Mantığı
 */

(function () {
  'use strict';

  // State
  let currentStatus = {
    isOpen: true,
    occupancy: 'empty',
    updatedAt: new Date().toISOString()
  };

  let adminPin = localStorage.getItem('bkfk_admin_pin') || '';
  let eventSource = null;
  let timeAgoTicker = null;

  // DOM Elements
  const statusCard = document.getElementById('status-card');
  const ambientGlow = document.getElementById('ambient-glow');
  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const occupancyPill = document.getElementById('occupancy-pill');
  const occIcon = document.getElementById('occ-icon');
  const occText = document.getElementById('occ-text');
  const updateTime = document.getElementById('update-time');

  // Admin Section (Only on /yk or /admin)
  const adminPanel = document.getElementById('admin-panel');
  const adminExitBtn = document.getElementById('admin-exit-btn');
  const ykBtnOpen = document.getElementById('yk-btn-open');
  const ykBtnClosed = document.getElementById('yk-btn-closed');
  const ykBtnEmpty = document.getElementById('yk-btn-empty');
  const ykBtnFull = document.getElementById('yk-btn-full');
  const ykBtnSave = document.getElementById('yk-btn-save');
  const adminToast = document.getElementById('admin-toast');

  // PWA & State
  const pwaInstallBtn = document.getElementById('pwa-install-btn');
  let deferredPrompt = null;
  let pendingIsOpen = null;
  let pendingOccupancy = null;

  // PIN Dialog
  const pinDialog = document.getElementById('pin-dialog');
  const pinForm = document.getElementById('pin-form');
  const pinInput = document.getElementById('pin-input');
  const pinError = document.getElementById('pin-error');
  const pinCancelBtn = document.getElementById('pin-cancel-btn');
  const viewToggleBtn = document.getElementById('view-toggle-btn');

  function isYkUrl() {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const params = new URLSearchParams(window.location.search);
    return path === '/yk' || path === '/admin' || path === '/yonetim' || params.has('yk') || params.has('admin');
  }

  function enableCardMode(save = true) {
    document.body.classList.add('view-card-mode');
    if (viewToggleBtn) viewToggleBtn.textContent = '⛶ Tam Sayfa Görünümüne Geç';
    if (save) localStorage.setItem('bkfk_view_mode', 'card');
  }

  function enableFullpageMode(save = true) {
    document.body.classList.remove('view-card-mode');
    if (viewToggleBtn) viewToggleBtn.textContent = '◫ Pencere Görünümüne Geç';
    if (save) localStorage.setItem('bkfk_view_mode', 'fullpage');
  }

  function toggleViewMode() {
    if (document.body.classList.contains('view-card-mode')) {
      enableFullpageMode(true);
    } else {
      enableCardMode(true);
    }
  }

  function init() {
    setupEventListeners();
    connectSSE();
    startTimeAgoInterval();
    initPWA();

    // Check saved view preference (default is fullpage)
    const savedView = localStorage.getItem('bkfk_view_mode');
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('v') || urlParams.get('view');

    if (savedView === 'card' || viewParam === 'card' || viewParam === '1') {
      enableCardMode(false);
    } else {
      enableFullpageMode(false);
    }

    // Check if on YK route
    if (isYkUrl()) {
      if (adminPin) {
        verifyPin(adminPin, false).then((valid) => {
          if (valid) {
            showAdminPanel();
          } else {
            openPinModal();
          }
        });
      } else {
        openPinModal();
      }
    } else {
      if (adminPanel) adminPanel.style.display = 'none';
    }
  }

  /* --------------------------------------------------------------------------
     SSE Real-Time Sync & Fallback
     -------------------------------------------------------------------------- */
  function connectSSE() {
    if (eventSource) eventSource.close();

    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = function (e) {
        try {
          const payload = JSON.parse(e.data);
          if (payload.status) {
            handleStatusUpdate(payload.status);
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      eventSource.onerror = function () {
        eventSource.close();
        setTimeout(() => {
          fallbackFetch();
          connectSSE();
        }, 5000);
      };
    } catch {
      fallbackFetch();
    }
  }

  function fallbackFetch() {
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          handleStatusUpdate(d.data);
        }
      })
      .catch(() => {});
  }

  function handleStatusUpdate(newStatus) {
    currentStatus = { ...newStatus };
    if (pendingIsOpen === null) pendingIsOpen = currentStatus.isOpen;
    if (pendingOccupancy === null) pendingOccupancy = currentStatus.occupancy;
    renderStatus();
    if (isYkUrl()) {
      renderAdminButtons();
    }
  }

  /* --------------------------------------------------------------------------
     Render Status (Oda Açık mı, Dolu mu?)
     -------------------------------------------------------------------------- */
  function renderStatus() {
    const { isOpen, occupancy, updatedAt } = currentStatus;

    // 1. Oda Açık mı / Kapalı mı?
    if (isOpen) {
      statusBanner.className = 'status-banner is-open';
      statusText.textContent = '❖ ODA AÇIK ❖';
    } else {
      statusBanner.className = 'status-banner is-closed';
      statusText.textContent = '❖ ODA KAPALI ❖';
    }

    // 2. Doluluk Durumu (Yer Var mı / Doldu mu?)
    if (!isOpen) {
      occupancyPill.className = 'occupancy-pill is-closed-pill';
      if (occText) occText.textContent = 'Oda Şu An Kapalı';
    } else if (occupancy === 'full') {
      occupancyPill.className = 'occupancy-pill is-full';
      if (occText) occText.textContent = '✦ DOLDU (Yer Kalmadı) ✦';
    } else {
      occupancyPill.className = 'occupancy-pill has-space';
      if (occText) occText.textContent = '✦ YER VAR ✦';
    }

    // 3. Son Güncelleme
    updateTimeText(updatedAt);
  }

  function updateTimeText(isoString) {
    if (!updateTime || !isoString) return;
    const diffSec = Math.floor((new Date() - new Date(isoString)) / 1000);

    if (diffSec < 20) {
      updateTime.textContent = 'Canlı • Az önce güncellendi';
    } else if (diffSec < 60) {
      updateTime.textContent = `Canlı • ${diffSec} saniye önce güncellendi`;
    } else if (diffSec < 3600) {
      const min = Math.floor(diffSec / 60);
      updateTime.textContent = `Canlı • ${min} dakika önce güncellendi`;
    } else {
      const hours = Math.floor(diffSec / 3600);
      updateTime.textContent = `Canlı • ${hours} saat önce güncellendi`;
    }
  }

  function startTimeAgoInterval() {
    if (timeAgoTicker) clearInterval(timeAgoTicker);
    timeAgoTicker = setInterval(() => {
      updateTimeText(currentStatus.updatedAt);
    }, 20000);
  }

  /* --------------------------------------------------------------------------
     YK Admin Functions
     -------------------------------------------------------------------------- */
  function showAdminPanel() {
    if (adminPanel) {
      adminPanel.style.display = 'block';
      if (pendingIsOpen === null) pendingIsOpen = currentStatus.isOpen;
      if (pendingOccupancy === null) pendingOccupancy = currentStatus.occupancy;
      renderAdminButtons();
    }
  }

  function renderAdminButtons() {
    if (!ykBtnOpen || !ykBtnClosed) return;

    const openVal = pendingIsOpen !== null ? pendingIsOpen : currentStatus.isOpen;
    const occVal = pendingOccupancy !== null ? pendingOccupancy : currentStatus.occupancy;

    if (openVal) {
      ykBtnOpen.classList.add('active');
      ykBtnClosed.classList.remove('active');
    } else {
      ykBtnOpen.classList.remove('active');
      ykBtnClosed.classList.add('active');
    }

    if (occVal === 'full') {
      ykBtnFull.className = 'yk-btn btn-occ active-full';
      ykBtnEmpty.className = 'yk-btn btn-occ';
    } else {
      ykBtnEmpty.className = 'yk-btn btn-occ active-empty';
      ykBtnFull.className = 'yk-btn btn-occ';
    }

    if (ykBtnSave && !ykBtnSave.classList.contains('is-saving')) {
      const hasChanges = (openVal !== currentStatus.isOpen) || (occVal !== currentStatus.occupancy);
      if (hasChanges) {
        ykBtnSave.classList.remove('is-saved');
        ykBtnSave.innerHTML = '<span>💾</span><span>Değişiklikleri Kaydet</span>';
      } else if (ykBtnSave.classList.contains('is-saved')) {
        ykBtnSave.innerHTML = '<span>✅</span><span>Kaydedildi</span>';
      } else {
        ykBtnSave.innerHTML = '<span>💾</span><span>Değişiklikleri Kaydet</span>';
      }
    }
  }

  async function verifyPin(pin, showErr = true) {
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.success) {
        adminPin = pin;
        localStorage.setItem('bkfk_admin_pin', pin);
        if (pinDialog.open) pinDialog.close();
        showAdminPanel();
        return true;
      } else {
        if (showErr && pinError) {
          pinError.textContent = 'Hatalı PIN!';
        }
        return false;
      }
    } catch {
      if (showErr && pinError) {
        pinError.textContent = 'Bağlantı hatası!';
      }
      return false;
    }
  }

  async function sendAdminUpdate(newFields = {}) {
    if (!adminPin) {
      openPinModal();
      return;
    }

    const targetIsOpen = typeof newFields.isOpen === 'boolean' 
      ? newFields.isOpen 
      : (pendingIsOpen !== null ? pendingIsOpen : currentStatus.isOpen);
    const targetOccupancy = newFields.occupancy || (pendingOccupancy !== null ? pendingOccupancy : currentStatus.occupancy);

    if (ykBtnSave) {
      ykBtnSave.classList.remove('is-saved');
      ykBtnSave.classList.add('is-saving');
      ykBtnSave.innerHTML = '<span>⏳</span><span>Kaydediliyor...</span>';
    }

    try {
      const payload = {
        isOpen: targetIsOpen,
        occupancy: targetOccupancy
      };

      const res = await fetch('/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast('Durum başarıyla kaydedildi! 🚀');
        currentStatus.isOpen = payload.isOpen;
        currentStatus.occupancy = payload.occupancy;
        currentStatus.updatedAt = new Date().toISOString();
        pendingIsOpen = payload.isOpen;
        pendingOccupancy = payload.occupancy;
        renderStatus();

        if (ykBtnSave) {
          ykBtnSave.classList.remove('is-saving');
          ykBtnSave.classList.add('is-saved');
          ykBtnSave.innerHTML = '<span>✅</span><span>Kaydedildi</span>';
        }
        renderAdminButtons();
      } else {
        showToast(data.message || 'Güncelleme başarısız!');
        if (ykBtnSave) {
          ykBtnSave.classList.remove('is-saving');
        }
        renderAdminButtons();
      }
    } catch {
      showToast('Ağ hatası oluştu!');
      if (ykBtnSave) {
        ykBtnSave.classList.remove('is-saving');
      }
      renderAdminButtons();
    } finally {
      if (ykBtnSave) {
        ykBtnSave.classList.remove('is-saving');
      }
    }
  }

  function showToast(msg) {
    if (!adminToast) return;
    adminToast.textContent = msg;
    setTimeout(() => {
      adminToast.textContent = '';
    }, 2500);
  }

  function openPinModal() {
    if (!pinDialog) return;
    if (pinError) pinError.textContent = '';
    if (pinInput) pinInput.value = '';
    if (typeof pinDialog.showModal === 'function') {
      pinDialog.showModal();
    } else {
      pinDialog.setAttribute('open', '');
    }
    if (pinInput) pinInput.focus();
  }

  function setupEventListeners() {
    // Admin Buttons for YK (Pending selection -> Save button commits)
    if (ykBtnOpen) {
      ykBtnOpen.addEventListener('click', () => {
        pendingIsOpen = true;
        renderAdminButtons();
      });
    }

    if (ykBtnClosed) {
      ykBtnClosed.addEventListener('click', () => {
        pendingIsOpen = false;
        renderAdminButtons();
      });
    }

    if (ykBtnEmpty) {
      ykBtnEmpty.addEventListener('click', () => {
        pendingOccupancy = 'empty';
        renderAdminButtons();
      });
    }

    if (ykBtnFull) {
      ykBtnFull.addEventListener('click', () => {
        pendingOccupancy = 'full';
        renderAdminButtons();
      });
    }

    if (ykBtnSave) {
      ykBtnSave.addEventListener('click', () => {
        sendAdminUpdate();
      });
    }

    // Admin Logout -> redirects to /
    if (adminExitBtn) {
      adminExitBtn.addEventListener('click', () => {
        adminPin = '';
        localStorage.removeItem('bkfk_admin_pin');
        window.location.href = '/';
      });
    }

    // Cancel PIN -> redirects to /
    if (pinCancelBtn) {
      pinCancelBtn.addEventListener('click', () => {
        pinDialog.close();
        window.location.href = '/';
      });
    }

    if (pinDialog) {
      pinDialog.addEventListener('cancel', () => {
        window.location.href = '/';
      });
    }

    // PIN Submit
    if (pinForm) {
      pinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const entered = pinInput.value.trim();
        if (entered) {
          await verifyPin(entered, true);
        }
      });
    }

    // Toggle View Mode (Fullpage vs Card)
    if (viewToggleBtn) {
      viewToggleBtn.addEventListener('click', toggleViewMode);
    }
  }

  /* --------------------------------------------------------------------------
     PWA Kurulumu & Service Worker
     -------------------------------------------------------------------------- */
  function initPWA() {
    // 1. Service Worker Kaydı
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('SW kaydı başarısız:', err);
        });
      });
    }

    // Zaten PWA / Standalone olarak açılmışsa yükle butonunu gizle
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
      return;
    }

    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    // 2. Android / Chrome / Samsung Internet kurulum bildirimi yakalama
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaInstallBtn) pwaInstallBtn.style.display = 'inline-flex';
    });

    // 3. iOS Cihazlar (beforeinstallprompt desteklemez, butonu direkt gösterip rehber açıyoruz)
    if (isIos && !isStandalone && pwaInstallBtn) {
      pwaInstallBtn.style.display = 'inline-flex';
    }

    // 4. Yükleme butonuna tıklama davranışı
    if (pwaInstallBtn) {
      pwaInstallBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            pwaInstallBtn.style.display = 'none';
          }
          deferredPrompt = null;
        } else if (isIos) {
          alert("📱 Uygulamayı Telefona Yükleme:\n\n1. Safari'nin altındaki 'Paylaş (⬆️)' simgesine dokunun.\n2. Açılan menüden 'Ana Ekrana Ekle' seçeneğini seçin.");
        } else {
          alert("📱 Uygulamayı Telefona Yükleme:\n\nTarayıcınızın menüsünden (sağ üstteki ⋮ simgesi) 'Ana Ekrana Ekle' veya 'Uygulamayı Yükle'yi seçebilirsiniz.");
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
      showToast('Uygulama başarıyla yüklendi! 📱');
    });
  }

  // Run on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
