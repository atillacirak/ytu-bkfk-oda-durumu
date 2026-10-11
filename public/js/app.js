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
  const adminToast = document.getElementById('admin-toast');

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
      if (occText) occText.textContent = 'Oda Şuan Kapalı';
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
      renderAdminButtons();
    }
  }

  function renderAdminButtons() {
    if (!ykBtnOpen || !ykBtnClosed) return;

    if (currentStatus.isOpen) {
      ykBtnOpen.classList.add('active');
      ykBtnClosed.classList.remove('active');
    } else {
      ykBtnOpen.classList.remove('active');
      ykBtnClosed.classList.add('active');
    }

    if (currentStatus.occupancy === 'full') {
      ykBtnFull.className = 'yk-btn btn-occ active-full';
      ykBtnEmpty.className = 'yk-btn btn-occ';
    } else {
      ykBtnEmpty.className = 'yk-btn btn-occ active-empty';
      ykBtnFull.className = 'yk-btn btn-occ';
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

  async function sendAdminUpdate(newFields) {
    if (!adminPin) {
      openPinModal();
      return;
    }

    try {
      const payload = {
        isOpen: typeof newFields.isOpen === 'boolean' ? newFields.isOpen : currentStatus.isOpen,
        occupancy: newFields.occupancy || currentStatus.occupancy
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
        showToast('Durum güncellendi! 🚀');
      } else {
        showToast('Güncelleme başarısız!');
      }
    } catch {
      showToast('Ağ hatası!');
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
    // 1-Touch Status Buttons for YK
    if (ykBtnOpen) {
      ykBtnOpen.addEventListener('click', () => {
        sendAdminUpdate({ isOpen: true });
      });
    }

    if (ykBtnClosed) {
      ykBtnClosed.addEventListener('click', () => {
        sendAdminUpdate({ isOpen: false });
      });
    }

    if (ykBtnEmpty) {
      ykBtnEmpty.addEventListener('click', () => {
        sendAdminUpdate({ occupancy: 'empty' });
      });
    }

    if (ykBtnFull) {
      ykBtnFull.addEventListener('click', () => {
        sendAdminUpdate({ occupancy: 'full' });
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

  // Run on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
