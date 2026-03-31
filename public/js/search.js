// Domain Search — browser-side vanilla JS
(function () {
  const form = document.getElementById('search-form');
  const input = document.getElementById('domain-input');
  const btn = document.getElementById('search-btn');
  const loading = document.getElementById('loading');
  const errorBox = document.getElementById('error');
  const results = document.getElementById('results');
  const availability = document.getElementById('availability');
  const details = document.getElementById('details');
  const detailsBody = document.querySelector('#details-table tbody');
  const suggestionsSection = document.getElementById('suggestions');
  const suggestionsGrid = document.getElementById('suggestions-grid');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let domain = input.value.trim();
    if (!domain) return;

    // Auto-append .com if no TLD
    if (!domain.includes('.')) domain = domain + '.com';

    // Reset UI
    hideAll();
    loading.classList.remove('hidden');
    btn.disabled = true;

    try {
      // Fetch availability + details in one call
      const checkRes = await fetch('/api/check?domain=' + encodeURIComponent(domain));
      const checkData = await checkRes.json();

      loading.classList.add('hidden');

      if (!checkRes.ok) {
        showError(checkData.error || 'Lookup failed');
        return;
      }

      // Show results
      results.classList.remove('hidden');
      renderAvailability(checkData);

      if (!checkData.available && checkData.details) {
        renderDetails(checkData.details);
      }

      // Fetch suggestions in parallel (only for taken domains)
      if (!checkData.available) {
        fetchSuggestions(domain);
      }
    } catch (err) {
      loading.classList.add('hidden');
      showError('Network error — please try again');
    } finally {
      btn.disabled = false;
    }
  });

  function hideAll() {
    errorBox.classList.add('hidden');
    results.classList.add('hidden');
    details.classList.add('hidden');
    suggestionsSection.classList.add('hidden');
    availability.innerHTML = '';
    detailsBody.innerHTML = '';
    suggestionsGrid.innerHTML = '';
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function renderAvailability(data) {
    const isAvail = data.available;
    availability.className = 'availability-card ' + (isAvail ? 'available' : 'taken');
    availability.innerHTML =
      '<div class="domain-name">' + escapeHtml(data.domain) + '</div>' +
      '<span class="badge ' + (isAvail ? 'available' : 'taken') + '">' +
      (isAvail ? 'Kha dung!' : 'Da dang ky') + '</span>';
  }

  function renderDetails(d) {
    if (!d.registrar && !d.createdDate) return;

    var rows = [];
    if (d.registrar) rows.push(row('Nha dang ky', d.registrar));
    if (d.createdDate) rows.push(row('Ngay tao', formatDate(d.createdDate)));
    if (d.expiryDate) rows.push(row('Ngay het han', formatDate(d.expiryDate)));
    if (d.updatedDate) rows.push(row('Cap nhat', formatDate(d.updatedDate)));
    if (d.nameservers && d.nameservers.length) {
      rows.push(row('Nameservers', d.nameservers.join(', ')));
    }
    if (d.status && d.status.length) {
      rows.push(row('Trang thai', d.status.join(', ')));
    }

    detailsBody.innerHTML = rows.join('');
    details.classList.remove('hidden');
  }

  function row(label, value) {
    return '<tr><td>' + escapeHtml(label) + '</td><td>' + escapeHtml(value) + '</td></tr>';
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  async function fetchSuggestions(domain) {
    suggestionsSection.classList.remove('hidden');
    suggestionsGrid.innerHTML = '<p style="color:#6b7280">Dang tai goi y...</p>';

    try {
      const res = await fetch('/api/suggest?domain=' + encodeURIComponent(domain));
      const data = await res.json();

      if (!res.ok || !data.suggestions) {
        suggestionsGrid.innerHTML = '<p style="color:#6b7280">Khong the tai goi y</p>';
        return;
      }

      suggestionsGrid.innerHTML = data.suggestions.map(function (s) {
        var badgeClass = s.available === true ? 'available' : s.available === false ? 'taken' : 'unknown';
        var badgeText = s.available === true ? 'Kha dung' : s.available === false ? 'Da dang ky' : '?';
        return '<div class="suggestion-card">' +
          '<span class="name">' + escapeHtml(s.domain) + '</span>' +
          '<span class="mini-badge ' + badgeClass + '">' + badgeText + '</span>' +
          '</div>';
      }).join('');
    } catch {
      suggestionsGrid.innerHTML = '<p style="color:#6b7280">Loi khi tai goi y</p>';
    }
  }

  // Click on suggestion card to search that domain
  suggestionsGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.suggestion-card');
    if (!card) return;
    var name = card.querySelector('.name');
    if (name) {
      input.value = name.textContent;
      form.dispatchEvent(new Event('submit'));
    }
  });

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
