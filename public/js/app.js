/**
 * YTÜ BKFK - Kulüp Odası Canlı Durum İstemci Mantığı
 * Real-time SSE listener, dynamic UI theming, and 1-Touch YK Admin Controls
 */

(function () {
  'use strict';

  // State
  let currentStatus = {
    isOpen: true,
    occupancy: 'empty',
    activity: '',
    responsible: '',
    note: '',
    updatedAt: new Date().toISOString()
  };

  let previousState = {
    isOpen: null,
    occupancy: null
  };

  let adminPin = localStorage.getItem('bkfk_admin_pin') || '';
  let wantsNotification = localStorage.getItem('bkfk_notify_enabled') === 'true';
  let eventSource = null;
  let timeAgoInterval = null;

  // DOM Elements
  const heroCard = document.getElementById('hero-status-card');
  const portalCore = document.getElementById('portal-core-icon');
  const liveBadgeText = document.getElementById('live-badge-text');
  const statusTitle = document.getElementById('status-title');
  const statusSubtitle = document.getElementById('status-subtitle');

  // Occupancy elements
  const occBadge = document.getElementById('occ-badge');
  const occDescription = document.getElementById('occ-description');
  const occSeg1 = document.getElementById('occ-seg-1');
  const occSeg2 = document.getElementById('occ-seg-2');
  const occSeg3 = document.getElementById('occ-seg-3');

  // Info details
  const currentActivityText = document.getElementById('info-activity');
  const responsiblePersonText = document.getElementById('info-responsible');
  const lastUpdatedText = document.getElementById('info-updated');
  const bulletinBanner = document.getElementById('bulletin-banner');
  const bulletinText = document.getElementById('bulletin-text');

  // Sound & Header
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundIcon = document.getElementById('sound-icon');
  const ykAccessBtn = document.getElementById('yk-access-btn');
  const ykBtnText = document.getElementById('yk-btn-text');

  // Hero Actions (Notify & Share)
  const notifyToggleBtn = document.getElementById('notify-toggle-btn');
  const notifyIcon = document.getElementById('notify-icon');
  const notifyText = document.getElementById('notify-text');
  const shareStatusBtn = document.getElementById('share-status-btn');
  const shareToast = document.getElementById('share-toast');

  // Admin Section & Dialog
  const pinDialog = document.getElementById('pin-dialog');
  const pinForm = document.getElementById('pin-form');
  const pinInput = document.getElementById('pin-input');
  const rememberPinCheck = document.getElementById('remember-pin');
  const cancelPinBtn = document.getElementById('cancel-pin-btn');
  const pinErrorMsg = document.getElementById('pin-error-msg');
  const adminPanelSection = document.getElementById('admin-panel-section');
  const adminExitBtn = document.getElementById('admin-exit-btn');
  const adminSaveBtn = document.getElementById('admin-save-btn');
  const adminToast = document.getElementById('admin-toast');

  // Admin 1-Touch Quick Presets
  const quickOpenEmpty = document.getElementById('quick-open-empty');
  const quickOpenMod = document.getElementById('quick-open-mod');
  const quickOpenFull = document.getElementById('quick-open-full');
  const quickCloseRoom = document.getElementById('quick-close-room');

  // Admin Controls
  const btnAdminOpen = document.getElementById('btn-admin-open');
  const btnAdminClosed = document.getElementById('btn-admin-closed');
  const adminOccBtns = document.querySelectorAll('.btn-occ');
  const adminActivityInput = document.getElementById('admin-activity-input');
  const adminResponsibleInput = document.getElementById('admin-responsible-input');
  const adminNoteInput = document.getElementById('admin-note-input');
  const activityChips = document.querySelectorAll('.activity-chip');

  // Sync Pill
  const syncDot = document.getElementById('sync-dot');
  const syncStatusText = document.getElementById('sync-status-text');

  // Working Admin Draft State
  let adminDraft = {
    isOpen: true,
    occupancy: 'empty',
    activity: '',
    responsible: localStorage.getItem('bkfk_last_responsible') || '',
    note: ''
  };

  /* --------------------------------------------------------------------------
     Initialization
     -------------------------------------------------------------------------- */
  function init() {
    updateSoundIcon();
    updateNotificationButtonUI();
    setupEventListeners();
    connectSSE();
    startTimeAgoTicker();

    // Check if user already has remembered PIN
    if (adminPin) {
      verifyAndEnableAdmin(adminPin, false);
    }
  }

  /* --------------------------------------------------------------------------
     SSE Real-Time Sync & Fallback Polling
     -------------------------------------------------------------------------- */
  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    setSyncStatus(true, 'Canlı Boyut Bağlantısı Aktif (SSE)');

    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = function (event) {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status) {
            handleStatusUpdate(payload.status);
          }
        } catch (e) {
          console.error('SSE JSON parse error:', e);
        }
      };

      eventSource.onerror = function () {
        setSyncStatus(false, 'Yeniden Bağlanıyor...');
        eventSource.close();
        setTimeout(() => {
          fetchStatusFallback();
          connectSSE();
        }, 5000);
      };
    } catch {
      fetchStatusFallback();
    }
  }

  function fetchStatusFallback() {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          handleStatusUpdate(data.data);
          setSyncStatus(true, 'Bağlantı Kuruldu (Polled)');
        }
      })
      .catch(() => {
        setSyncStatus(false, 'Bağlantı Kesildi');
      });
  }

  function setSyncStatus(isLive, label) {
    if (syncDot) {
      syncDot.className = 'sync-dot ' + (isLive ? '' : 'disconnected');
    }
    if (syncStatusText) {
      syncStatusText.textContent = label;
    }
  }

  /* --------------------------------------------------------------------------
     Render Status & Audio/Notification Feedback
     -------------------------------------------------------------------------- */
  function handleStatusUpdate(newStatus) {
    const isFirstRun = previousState.isOpen === null;
    const hasOpenChanged = previousState.isOpen !== null && previousState.isOpen !== newStatus.isOpen;
    const hasOccupancyChanged = previousState.occupancy !== null && previousState.occupancy !== newStatus.occupancy;

    // Trigger Sound Effects on live status transitions
    if (!isFirstRun && window.soundFx) {
      if (hasOpenChanged) {
        if (newStatus.isOpen) {
          window.soundFx.playOpen();
        } else {
          window.soundFx.playClose();
        }
      } else if (hasOccupancyChanged && newStatus.occupancy === 'full') {
        window.soundFx.playFullWarning();
      }
    }

    // Trigger Desktop / Mobile Web Notification if room opened
    if (!isFirstRun && hasOpenChanged && newStatus.isOpen && wantsNotification) {
      triggerRoomOpenedNotification(newStatus);
    }

    currentStatus = { ...newStatus };
    previousState.isOpen = newStatus.isOpen;
    previousState.occupancy = newStatus.occupancy;

    renderUI();
  }

  function renderUI() {
    const { isOpen, occupancy, activity, responsible, note, updatedAt } = currentStatus;

    // 1. Update Hero Card Classes
    if (isOpen) {
      heroCard.classList.remove('state-closed');
      heroCard.classList.add('state-open');
      portalCore.innerHTML = '🌀';
      liveBadgeText.textContent = 'PORTAL AKTİF • ODAYA GİRİŞ SERBEST';
      statusTitle.textContent = 'KULÜP ODASI AÇIK';
      statusSubtitle.textContent = 'Boyut kapısı aralandı! Masaüstü RYO, kutu oyunları veya muhabbet için odaya bekleniyorsunuz.';
    } else {
      heroCard.classList.remove('state-open');
      heroCard.classList.add('state-closed');
      portalCore.innerHTML = '🛡️';
      liveBadgeText.textContent = 'KORUYUCU KALKAN AKTİF • ODA KAPALI';
      statusTitle.textContent = 'KULÜP ODASI KAPALI';
      statusSubtitle.textContent = 'Oda şu an kapalı ve dinlenme modunda. Bir sonraki sefer için hazır ol, maceracı!';
    }

    // 2. Update Occupancy Display
    updateOccupancyDisplay(isOpen, occupancy);

    // 3. Update Info Cards
    currentActivityText.textContent = activity || (isOpen ? 'Serbest Vakit & Sohbet' : 'Oda Dinlenmede');
    responsiblePersonText.textContent = responsible || (isOpen ? 'Kulüp Üyeleri / YK' : 'Kimse Yok');
    updateTimeAgoDisplay(updatedAt);

    // 4. Update Bulletin Note
    if (note && note.trim().length > 0) {
      bulletinBanner.style.display = 'flex';
      bulletinText.textContent = `"${note.trim()}"`;
    } else {
      bulletinBanner.style.display = 'none';
    }

    // 5. Update Ambient Canvas Background Tint
    if (typeof window.updateSpaceTheme === 'function') {
      window.updateSpaceTheme(isOpen, occupancy);
    }

    // 6. Sync Admin Panel Draft
    syncAdminDraftWithCurrent();
  }

  function updateOccupancyDisplay(isOpen, occupancy) {
    occSeg1.className = 'occ-segment';
    occSeg2.className = 'occ-segment';
    occSeg3.className = 'occ-segment';
    occBadge.className = 'occ-badge';

    if (!isOpen) {
      occBadge.textContent = 'KAPALI';
      occBadge.className = 'occ-badge occ-full';
      occDescription.textContent = 'Kapı kilitli, odada şu an etkinlik bulunmuyor.';
      return;
    }

    if (occupancy === 'empty') {
      occBadge.textContent = '🟢 BOŞ / YER ÇOK';
      occBadge.classList.add('occ-empty');
      occSeg1.classList.add('active-empty');
      occDescription.textContent = 'Sakin Boyut: Masalar ve koltuklar boş, rahatça gelip yerleşebilirsiniz.';
    } else if (occupancy === 'moderate') {
      occBadge.textContent = '🟡 ORTA / YER VAR';
      occBadge.classList.add('occ-moderate');
      occSeg1.classList.add('active-mod');
      occSeg2.classList.add('active-mod');
      occDescription.textContent = 'Hareketli Han: Birkaç masa dolu, kutu oyunu veya sohbet için hâlâ müsait yer var!';
    } else if (occupancy === 'full') {
      occBadge.textContent = '🔴 TIKLIM TIKLIM DOLU';
      occBadge.classList.add('occ-full');
      occSeg1.classList.add('active-full');
      occSeg2.classList.add('active-full');
      occSeg3.classList.add('active-full');
      occDescription.textContent = 'Warp Çekirdeği Doldu: Masa ve sandalyeler tamamen dolu, içerisi yoğun!';
    }
  }

  /* --------------------------------------------------------------------------
     Time-Ago Live Formatter
     -------------------------------------------------------------------------- */
  function updateTimeAgoDisplay(isoString) {
    if (!lastUpdatedText || !isoString) return;
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 20) {
      lastUpdatedText.textContent = 'Az önce';
    } else if (diffSec < 60) {
      lastUpdatedText.textContent = `${diffSec} saniye önce`;
    } else if (diffSec < 3600) {
      const min = Math.floor(diffSec / 60);
      lastUpdatedText.textContent = `${min} dakika önce`;
    } else if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      lastUpdatedText.textContent = `${hours} saat önce`;
    } else {
      const days = Math.floor(diffSec / 86400);
      lastUpdatedText.textContent = `${days} gün önce`;
    }
  }

  function startTimeAgoTicker() {
    if (timeAgoInterval) clearInterval(timeAgoInterval);
    timeAgoInterval = setInterval(() => {
      updateTimeAgoDisplay(currentStatus.updatedAt);
    }, 20000);
  }

  /* --------------------------------------------------------------------------
     Notification & Sharing Features
     -------------------------------------------------------------------------- */
  function updateNotificationButtonUI() {
    if (!notifyToggleBtn) return;
    if (wantsNotification && 'Notification' in window && Notification.permission === 'granted') {
      notifyToggleBtn.classList.add('active');
      notifyIcon.textContent = '🔔';
      notifyText.textContent = 'Bildirim Açık';
    } else {
      notifyToggleBtn.classList.remove('active');
      notifyIcon.textContent = '🔕';
      notifyText.textContent = 'Açılınca Haber Ver';
    }
  }

  async function toggleRoomNotification() {
    if (!('Notification' in window)) {
      showShareToast('Tarayıcınız bildirim desteği sunmuyor.');
      return;
    }

    if (Notification.permission === 'granted') {
      wantsNotification = !wantsNotification;
      localStorage.setItem('bkfk_notify_enabled', wantsNotification);
      updateNotificationButtonUI();
      showShareToast(wantsNotification ? 'Oda açılınca bildirim alacaksınız!' : 'Bildirimler kapatıldı.');
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        wantsNotification = true;
        localStorage.setItem('bkfk_notify_enabled', 'true');
        updateNotificationButtonUI();
        showShareToast('Bildirim izni verildi! Oda açılınca haber vereceğiz.');
      } else {
        showShareToast('Bildirim izni reddedildi.');
      }
    } else {
      showShareToast('Bildirimler tarayıcı ayarlarından engellenmiş.');
    }
  }

  function triggerRoomOpenedNotification(status) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = '🌌 YTÜ BKFK Odası Açıldı!';
        const body = `Boyut kapısı aktif! ${status.activity ? 'Aktivite: ' + status.activity : 'Kulüp odasına bekleniyorsunuz.'}`;
        new Notification(title, {
          body: body,
          icon: '/icons/logo.svg',
          badge: '/icons/logo.svg'
        });
      }
    } catch (e) {
      console.debug('Notification error:', e);
    }
  }

  function shareRoomStatus() {
    const isOpenStr = currentStatus.isOpen ? 'AÇIK 🟢' : 'KAPALI 🔴';
    const occStr = currentStatus.isOpen
      ? (currentStatus.occupancy === 'empty' ? 'Boş' : (currentStatus.occupancy === 'moderate' ? 'Orta' : 'Dolu'))
      : 'Kapalı';
    const activityStr = currentStatus.activity ? `Şu an: ${currentStatus.activity}` : '';
    const noteStr = currentStatus.note ? `"${currentStatus.note}"` : '';

    const text = `🌌 YTÜ BKFK Kulüp Odası: ${isOpenStr} (Doluluk: ${occStr})\n${activityStr}\n${noteStr}\n📍 Davutpaşa Kampüsü Kulüpler Binası\nCanlı durum: ${window.location.href}`;

    if (navigator.share) {
      navigator.share({
        title: 'YTÜ BKFK Kulüp Odası Durumu',
        text: text,
        url: window.location.href
      }).catch(() => {
        copyToClipboard(text);
      });
    } else {
      copyToClipboard(text);
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showShareToast('Durum ve bağlantı panoya kopyalandı! 📋');
      }).catch(() => {
        showShareToast('Kopyalama başarısız oldu.');
      });
    } else {
      showShareToast('Bağlantı: ' + window.location.href);
    }
  }

  function showShareToast(message) {
    if (!shareToast) return;
    shareToast.textContent = message;
    shareToast.classList.add('show');
    setTimeout(() => {
      shareToast.classList.remove('show');
    }, 3200);
  }

  /* --------------------------------------------------------------------------
     Admin Panel & Quick 1-Touch Controls
     -------------------------------------------------------------------------- */
  function syncAdminDraftWithCurrent() {
    adminDraft.isOpen = currentStatus.isOpen;
    adminDraft.occupancy = currentStatus.occupancy;
    adminDraft.activity = currentStatus.activity;
    adminDraft.responsible = currentStatus.responsible || adminDraft.responsible;
    adminDraft.note = currentStatus.note;

    renderAdminControlsUI();
  }

  function renderAdminControlsUI() {
    // Open / Closed buttons
    if (adminDraft.isOpen) {
      btnAdminOpen.classList.add('active');
      btnAdminClosed.classList.remove('active');
    } else {
      btnAdminOpen.classList.remove('active');
      btnAdminClosed.classList.add('active');
    }

    // Occupancy buttons
    adminOccBtns.forEach((btn) => {
      if (btn.getAttribute('data-occ') === adminDraft.occupancy) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Inputs
    if (adminActivityInput && document.activeElement !== adminActivityInput) {
      adminActivityInput.value = adminDraft.activity || '';
    }
    if (adminResponsibleInput && document.activeElement !== adminResponsibleInput) {
      adminResponsibleInput.value = adminDraft.responsible || '';
    }
    if (adminNoteInput && document.activeElement !== adminNoteInput) {
      adminNoteInput.value = adminDraft.note || '';
    }
  }

  async function verifyAndEnableAdmin(pin, showAlert = true) {
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.success) {
        adminPin = pin;
        adminPanelSection.style.display = 'block';
        if (ykBtnText) ykBtnText.textContent = 'YK Paneli Aktif';
        ykAccessBtn.style.borderColor = 'var(--state-open-glow)';

        syncAdminDraftWithCurrent();
        if (pinDialog.open) pinDialog.close();

        if (window.soundFx) window.soundFx.playSuccess();
        return true;
      } else {
        if (showAlert) {
          pinErrorMsg.textContent = 'Hatalı PIN Kodu! Lütfen tekrar deneyin.';
        }
        return false;
      }
    } catch (e) {
      if (showAlert) {
        pinErrorMsg.textContent = 'Bağlantı hatası: Sunucuya ulaşılamadı.';
      }
      return false;
    }
  }

  // Instant 1-Touch update helper
  async function triggerInstantStatus(isOpen, occupancy) {
    adminDraft.isOpen = isOpen;
    if (occupancy) adminDraft.occupancy = occupancy;
    renderAdminControlsUI();
    await saveAdminStatus();
  }

  async function saveAdminStatus() {
    if (!adminPin) {
      openPinDialog();
      return;
    }

    adminDraft.activity = adminActivityInput.value.trim();
    adminDraft.responsible = adminResponsibleInput.value.trim();
    adminDraft.note = adminNoteInput.value.trim();

    if (adminDraft.responsible) {
      localStorage.setItem('bkfk_last_responsible', adminDraft.responsible);
    }

    try {
      adminSaveBtn.disabled = true;
      adminSaveBtn.textContent = 'Yayınlanıyor...';

      const res = await fetch('/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify({
          isOpen: adminDraft.isOpen,
          occupancy: adminDraft.occupancy,
          activity: adminDraft.activity,
          responsible: adminDraft.responsible,
          note: adminDraft.note,
          updatedBy: adminDraft.responsible || 'YK'
        })
      });

      const data = await res.json();

      if (data.success) {
        if (window.soundFx) window.soundFx.playSuccess();
        showToast('Durum güncellendi ve tüm üyelere canlı iletildi! 🚀', 'success');
      } else {
        showToast(data.message || 'Güncelleme başarısız oldu.', 'error');
      }
    } catch (err) {
      showToast('Ağ hatası: Durum gönderilemedi.', 'error');
    } finally {
      adminSaveBtn.disabled = false;
      adminSaveBtn.innerHTML = '<span>🚀</span><span>CANLI YAYINLA & KAYDET</span>';
    }
  }

  function showToast(msg, type) {
    if (!adminToast) return;
    adminToast.textContent = msg;
    adminToast.className = `admin-status-toast show ${type}`;
    setTimeout(() => {
      adminToast.className = 'admin-status-toast';
    }, 4000);
  }

  function openPinDialog() {
    pinErrorMsg.textContent = '';
    pinInput.value = '';
    if (typeof pinDialog.showModal === 'function') {
      pinDialog.showModal();
    } else {
      pinDialog.setAttribute('open', '');
    }
    pinInput.focus();
  }

  /* --------------------------------------------------------------------------
     Event Listeners Setup
     -------------------------------------------------------------------------- */
  function setupEventListeners() {
    // Sound Toggle Button
    soundToggleBtn.addEventListener('click', () => {
      if (window.soundFx) {
        const isMuted = window.soundFx.toggleMute();
        updateSoundIcon();
        if (!isMuted) window.soundFx.playClick();
      }
    });

    // Notify & Share Buttons
    if (notifyToggleBtn) {
      notifyToggleBtn.addEventListener('click', toggleRoomNotification);
    }
    if (shareStatusBtn) {
      shareStatusBtn.addEventListener('click', shareRoomStatus);
    }

    // YK Panel Access Button
    ykAccessBtn.addEventListener('click', () => {
      if (window.soundFx) window.soundFx.playClick();
      if (adminPin && adminPanelSection.style.display !== 'none') {
        adminPanelSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        openPinDialog();
      }
    });

    // Cancel PIN Dialog
    cancelPinBtn.addEventListener('click', () => {
      if (window.soundFx) window.soundFx.playClick();
      pinDialog.close();
    });

    // Light-dismiss click outside dialog
    pinDialog.addEventListener('click', (e) => {
      const rect = pinDialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        pinDialog.close();
      }
    });

    // PIN Submit Form
    pinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enteredPin = pinInput.value.trim();
      if (!enteredPin) return;

      const isValid = await verifyAndEnableAdmin(enteredPin, true);
      if (isValid && rememberPinCheck.checked) {
        localStorage.setItem('bkfk_admin_pin', enteredPin);
      }
    });

    // Admin Log Out
    adminExitBtn.addEventListener('click', () => {
      if (window.soundFx) window.soundFx.playClick();
      adminPin = '';
      localStorage.removeItem('bkfk_admin_pin');
      adminPanelSection.style.display = 'none';
      if (ykBtnText) ykBtnText.textContent = 'YK Kontrol';
      ykAccessBtn.style.borderColor = 'rgba(189, 0, 255, 0.45)';
    });

    // 1-Touch Super Quick Presets
    if (quickOpenEmpty) {
      quickOpenEmpty.addEventListener('click', () => triggerInstantStatus(true, 'empty'));
    }
    if (quickOpenMod) {
      quickOpenMod.addEventListener('click', () => triggerInstantStatus(true, 'moderate'));
    }
    if (quickOpenFull) {
      quickOpenFull.addEventListener('click', () => triggerInstantStatus(true, 'full'));
    }
    if (quickCloseRoom) {
      quickCloseRoom.addEventListener('click', () => triggerInstantStatus(false, null));
    }

    // 1-Touch Open / Closed Buttons
    btnAdminOpen.addEventListener('click', () => {
      if (window.soundFx) window.soundFx.playClick();
      adminDraft.isOpen = true;
      renderAdminControlsUI();
      saveAdminStatus();
    });

    btnAdminClosed.addEventListener('click', () => {
      if (window.soundFx) window.soundFx.playClick();
      adminDraft.isOpen = false;
      renderAdminControlsUI();
      saveAdminStatus();
    });

    // 1-Touch Occupancy Buttons
    adminOccBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.soundFx) window.soundFx.playClick();
        adminDraft.occupancy = btn.getAttribute('data-occ');
        renderAdminControlsUI();
        saveAdminStatus();
      });
    });

    // Preset Activity Chips
    activityChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        if (window.soundFx) window.soundFx.playClick();
        const activityVal = chip.getAttribute('data-activity') || chip.textContent.trim();
        adminActivityInput.value = activityVal;
        adminDraft.activity = activityVal;
        saveAdminStatus();
      });
    });

    // Manual Save / Update Button
    adminSaveBtn.addEventListener('click', () => {
      if (window.soundFx) window.soundFx.playClick();
      saveAdminStatus();
    });

    // Global click sound on interactive elements
    document.addEventListener('click', (e) => {
      if (e.target.closest('button, .social-pill, .activity-chip, .hero-action-pill')) {
        if (window.soundFx) window.soundFx.playClick();
      }
    });
  }

  function updateSoundIcon() {
    const isMuted = localStorage.getItem('bkfk_audio_muted') === 'true';
    if (soundIcon) {
      soundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
