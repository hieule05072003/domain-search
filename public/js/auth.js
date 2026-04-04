// DomainSoft — client-side auth state (fetches /auth/user, updates header)
(function () {
  'use strict';

  var authArea = document.querySelector('.auth-area');
  if (!authArea) return;

  // Google SVG icon for login button
  var googleSvg =
    '<svg class="google-icon" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z" fill="#4285F4"/>' +
      '<path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>' +
      '<path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z" fill="#FBBC05"/>' +
      '<path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>' +
    '</svg>';

  fetch('/auth/user')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.user) {
        var photoHtml = data.user.photo
          ? '<img src="' + data.user.photo + '" alt="avatar" class="user-avatar">'
          : '';
        authArea.innerHTML =
          '<div class="user-info">' +
            photoHtml +
            '<span class="user-name">' + escapeHtml(data.user.name) + '</span>' +
          '</div>' +
          '<a href="/auth/logout" class="auth-logout-link">Đăng xuất</a>';
      } else {
        authArea.innerHTML =
          '<a href="/auth/google" class="auth-btn neumorphic-raised">' +
            googleSvg +
            'Đăng nhập với Google' +
          '</a>';
      }
    })
    .catch(function () {
      // Auth check failed — show login button as fallback
      authArea.innerHTML =
        '<a href="/auth/google" class="auth-btn neumorphic-raised">' +
          googleSvg +
          'Đăng nhập với Google' +
        '</a>';
    });

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
})();
