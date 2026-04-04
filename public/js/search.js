// DomainSoft — browser-side domain search logic
(function () {
  'use strict';

  // --- DOM refs ---
  const form              = document.getElementById('search-form');
  const input             = document.getElementById('domain-input');
  const btn               = document.getElementById('search-btn');
  const loading           = document.getElementById('loading');
  const errorBox          = document.getElementById('error');
  const errorMsg          = document.getElementById('error-message');
  const results           = document.getElementById('results');
  const availability      = document.getElementById('availability');
  const details           = document.getElementById('details');
  const detailsGrid       = document.getElementById('details-grid');
  const pricingCard       = document.getElementById('pricing');
  const pricingTableWrap  = document.getElementById('pricing-table-wrap');
  const suggestionsSection= document.getElementById('suggestions');
  const tldSuggestions    = document.getElementById('tld-suggestions');
  const keywordSuggestions= document.getElementById('keyword-suggestions');

  // --- TLD chip shortcuts ---
  document.querySelectorAll('.tld-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var tld = chip.dataset.tld || '';
      var current = input.value.trim();
      // Strip any existing TLD and append the clicked one
      var base = current.includes('.') ? current.split('.')[0] : current;
      if (!base) return;
      input.value = base + tld;
      form.dispatchEvent(new Event('submit'));
    });
  });

  // --- Form submit ---
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var domain = input.value.trim();
    if (!domain) return;

    // Auto-append .com if no TLD
    if (!domain.includes('.')) domain = domain + '.com';
    input.value = domain;

    resetUI();
    loading.classList.remove('hidden');
    btn.disabled = true;

    try {
      var checkRes = await fetch('/api/check?domain=' + encodeURIComponent(domain));
      var checkData = await checkRes.json();

      loading.classList.add('hidden');

      if (!checkRes.ok) {
        showError(checkData.error || 'Tra cứu thất bại. Vui lòng thử lại.');
        return;
      }

      results.classList.remove('hidden');
      renderAvailability(checkData);
      saveHistory(domain, checkData.available);

      if (!checkData.available && checkData.details) {
        renderDetails(checkData.details);
      }

      // Fetch pricing for the searched TLD + common TLDs (fire-and-forget)
      var searchedTld = domain.includes('.') ? domain.split('.').pop() : 'com';
      fetchPricing(searchedTld);

      if (!checkData.available) {
        fetchSuggestions(domain);
      }
    } catch (err) {
      loading.classList.add('hidden');
      showError('Lỗi kết nối — vui lòng thử lại.');
    } finally {
      btn.disabled = false;
    }
  });

  // --- Reset UI state ---
  function resetUI() {
    errorBox.classList.add('hidden');
    results.classList.add('hidden');
    details.classList.add('hidden');
    pricingCard.classList.add('hidden');
    suggestionsSection.classList.add('hidden');
    availability.innerHTML = '';
    detailsGrid.innerHTML = '';
    pricingTableWrap.innerHTML = '';
    tldSuggestions.innerHTML = '';
    keywordSuggestions.innerHTML = '';
  }

  // --- Show error ---
  function showError(msg) {
    errorMsg.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  // --- Render availability card ---
  function renderAvailability(data) {
    var isAvail = data.available;
    var badgeClass = isAvail ? 'available' : 'taken';
    var badgeIcon  = isAvail ? 'check_circle' : 'cancel';
    var badgeText  = isAvail ? 'Khả dụng' : 'Đã đăng ký';
    var msg        = isAvail
      ? 'Tên miền này còn trống — hãy đăng ký ngay!'
      : 'Tên miền này đã được đăng ký.';

    availability.innerHTML =
      '<div class="avail-domain">' + escapeHtml(data.domain) + '</div>' +
      '<span class="avail-badge ' + badgeClass + '">' +
        '<span class="material-symbols-outlined" style="font-size:1rem;vertical-align:middle">' + badgeIcon + '</span>' +
        badgeText +
      '</span>' +
      '<p class="avail-msg">' + msg + '</p>';
  }

  // --- Render registration details panel ---
  function renderDetails(d) {
    if (!d.registrar && !d.createdDate && !d.expiryDate) return;

    var items = [];

    if (d.registrar) {
      items.push(detailItem('Nhà đăng ký', d.registrar));
    }
    if (d.createdDate) {
      items.push(detailItem('Ngày tạo', formatDate(d.createdDate)));
    }
    if (d.expiryDate) {
      items.push(detailItem('Ngày hết hạn', formatDate(d.expiryDate)));
    }
    if (d.updatedDate) {
      items.push(detailItem('Cập nhật', formatDate(d.updatedDate)));
    }
    if (d.nameservers && d.nameservers.length) {
      items.push(detailItem('Nameservers', d.nameservers.join('\n')));
    }
    if (d.status && d.status.length) {
      items.push(detailItem('Trạng thái', d.status.join(', ')));
    }

    if (!items.length) return;

    detailsGrid.innerHTML = items.join('');
    details.classList.remove('hidden');
  }

  // --- Build a single detail inset card ---
  function detailItem(label, value) {
    return (
      '<div class="detail-item">' +
        '<div class="detail-label">' + escapeHtml(label) + '</div>' +
        '<div class="detail-value">' + escapeHtml(value) + '</div>' +
      '</div>'
    );
  }

  // --- Fetch and render pricing reference card ---
  async function fetchPricing(searchedTld) {
    // Always include common TLDs; prepend the searched TLD so it appears first
    var commonTlds = ['com', 'net', 'org', 'io', 'dev', 'vn'];
    var tldList = [searchedTld].concat(
      commonTlds.filter(function (t) { return t !== searchedTld; })
    );

    try {
      var res = await fetch('/api/pricing?tlds=' + encodeURIComponent(tldList.join(',')));
      if (!res.ok) return;
      var data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      renderPricingCard(data);
    } catch (err) {
      // Pricing is non-critical — silently hide the section on error
    }
  }

  // --- Build pricing table HTML and show the card ---
  function renderPricingCard(items) {
    var rows = items.map(function (item) {
      return (
        '<tr>' +
          '<td class="pricing-tld">' + escapeHtml(item.tld) + '</td>' +
          '<td>' + escapeHtml(item.registerDisplay) + '/năm</td>' +
          '<td>' + escapeHtml(item.renewDisplay) + '/năm</td>' +
        '</tr>'
      );
    }).join('');

    pricingTableWrap.innerHTML =
      '<table class="pricing-table">' +
        '<thead>' +
          '<tr>' +
            '<th>TLD</th>' +
            '<th>Đăng ký</th>' +
            '<th>Gia hạn</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';

    pricingCard.classList.remove('hidden');
  }

  // --- Fetch and render suggestions ---
  async function fetchSuggestions(domain) {
    suggestionsSection.classList.remove('hidden');
    var placeholder = '<p class="suggestions-placeholder">Đang tải gợi ý...</p>';
    tldSuggestions.innerHTML = placeholder;
    keywordSuggestions.innerHTML = placeholder;

    try {
      var res = await fetch('/api/suggest?domain=' + encodeURIComponent(domain));
      var data = await res.json();

      if (!res.ok || !data.suggestions || !data.suggestions.length) {
        tldSuggestions.innerHTML = '<p class="suggestions-placeholder">Không có gợi ý.</p>';
        keywordSuggestions.innerHTML = '';
        return;
      }

      // Split: TLD variants share the same keyword root; keyword variants differ
      var baseName = domain.split('.')[0].toLowerCase();
      var tldItems = [];
      var kwItems  = [];

      data.suggestions.forEach(function (s) {
        var sBase = s.domain.split('.')[0].toLowerCase();
        if (sBase === baseName) {
          tldItems.push(s);
        } else {
          kwItems.push(s);
        }
      });

      tldSuggestions.innerHTML = tldItems.length
        ? tldItems.map(suggestionCard).join('')
        : '<p class="suggestions-placeholder">Không có biến thể TLD.</p>';

      keywordSuggestions.innerHTML = kwItems.length
        ? kwItems.map(suggestionCard).join('')
        : '<p class="suggestions-placeholder">Không có gợi ý từ khóa.</p>';

    } catch (err) {
      tldSuggestions.innerHTML = '<p class="suggestions-placeholder">Lỗi khi tải gợi ý.</p>';
      keywordSuggestions.innerHTML = '';
    }
  }

  // --- Build suggestion card HTML ---
  function suggestionCard(s) {
    var badgeClass = s.available === true ? 'available'
                   : s.available === false ? 'taken'
                   : 'unknown';
    var badgeText  = s.available === true ? 'Khả dụng'
                   : s.available === false ? 'Đã đăng ký'
                   : '?';
    return (
      '<div class="suggestion-card">' +
        '<span class="suggestion-name">' + escapeHtml(s.domain) + '</span>' +
        '<span class="mini-badge ' + badgeClass + '">' + badgeText + '</span>' +
      '</div>'
    );
  }

  // --- Click suggestion card → search that domain ---
  [tldSuggestions, keywordSuggestions].forEach(function (container) {
    container.addEventListener('click', function (e) {
      var card = e.target.closest('.suggestion-card');
      if (!card) return;
      var nameEl = card.querySelector('.suggestion-name');
      if (nameEl) {
        input.value = nameEl.textContent.trim();
        form.dispatchEvent(new Event('submit'));
      }
    });
  });

  // --- Date formatter ---
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  }

  // --- XSS-safe HTML escape ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // =============================================
  // SEARCH HISTORY (localStorage)
  // =============================================
  var HISTORY_KEY = 'domainsoft_history';
  var MAX_HISTORY = 20;
  var historySection = document.getElementById('history');
  var historyList = document.getElementById('history-list');
  var clearHistoryBtn = document.getElementById('clear-history');

  /** Save a search to localStorage history */
  function saveHistory(domain, available) {
    var history = loadHistory();
    // Remove duplicate if exists
    history = history.filter(function (h) { return h.domain !== domain; });
    // Add to front
    history.unshift({
      domain: domain,
      available: available,
      timestamp: new Date().toISOString()
    });
    // Limit size
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) { /* localStorage full or unavailable */ }
    renderHistory();
  }

  /** Load history from localStorage */
  function loadHistory() {
    try {
      var data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  /** Render history cards */
  function renderHistory() {
    if (!historySection || !historyList) return;
    var history = loadHistory();
    if (history.length === 0) {
      historySection.classList.add('hidden');
      return;
    }
    historySection.classList.remove('hidden');
    historyList.innerHTML = history.map(function (h) {
      var badgeClass = h.available ? 'available' : 'taken';
      var badgeText = h.available ? 'Khả dụng' : 'Đã đăng ký';
      var timeAgo = formatTimeAgo(h.timestamp);
      return (
        '<div class="history-item" data-domain="' + escapeHtml(h.domain) + '">' +
          '<div class="history-info">' +
            '<span class="history-domain">' + escapeHtml(h.domain) + '</span>' +
            '<span class="history-time">' + timeAgo + '</span>' +
          '</div>' +
          '<span class="mini-badge ' + badgeClass + '">' + badgeText + '</span>' +
        '</div>'
      );
    }).join('');
  }

  /** Format relative time (e.g. "5 phút trước") */
  function formatTimeAgo(iso) {
    var seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'Vừa xong';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' phút trước';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' giờ trước';
    var days = Math.floor(hours / 24);
    return days + ' ngày trước';
  }

  // Click history item → search that domain
  if (historyList) {
    historyList.addEventListener('click', function (e) {
      var item = e.target.closest('.history-item');
      if (!item) return;
      var domain = item.dataset.domain;
      if (domain) {
        input.value = domain;
        form.dispatchEvent(new Event('submit'));
      }
    });
  }

  // Clear history button
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', function () {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    });
  }

  // Render history on page load
  renderHistory();
})();
