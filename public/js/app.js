/**
 * EcoTrack — Core Frontend Client Application Logic
 */

// Toast notification helper
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `eco-toast toast-${type}`;

  let icon = 'bi-check-circle-fill text-success';
  if (type === 'error') icon = 'bi-exclamation-circle-fill text-danger';
  if (type === 'warning') icon = 'bi-exclamation-triangle-fill text-warning';
  if (type === 'info') icon = 'bi-info-circle-fill text-info';

  toast.innerHTML = `
    <i class="bi ${icon} fs-5"></i>
    <div class="flex-grow-1" style="font-size: 0.9rem;">${escapeHtml(message)}</div>
    <button type="button" class="btn-close btn-sm" aria-label="Close"></button>
  `;

  toast.querySelector('.btn-close').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// HTML escape helper to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Date formatter
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}

// Generate status badge HTML
function getStatusBadge(status) {
  const s = status || 'Pending';
  let badgeClass = 'badge-pending';
  let icon = 'bi-clock-history';

  switch (s) {
    case 'Approved':
      badgeClass = 'badge-approved';
      icon = 'bi-check2-circle';
      break;
    case 'In Progress':
      badgeClass = 'badge-in-progress';
      icon = 'bi-arrow-repeat';
      break;
    case 'Collected':
      badgeClass = 'badge-collected';
      icon = 'bi-check-all';
      break;
    case 'Rejected':
      badgeClass = 'badge-rejected';
      icon = 'bi-x-circle';
      break;
  }

  return `<span class="badge-status ${badgeClass}"><i class="bi ${icon}"></i>${escapeHtml(s)}</span>`;
}

// Global user session verify
async function checkAuth(requiredRole = null) {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (!data.success || !data.data || !data.data.authenticated) {
      window.location.href = '/login.html';
      return null;
    }

    const user = data.data;

    // Verify role if required
    if (requiredRole && user.role !== requiredRole) {
      if (user.role === 'admin') {
        window.location.href = '/admin/dashboard.html';
      } else {
        window.location.href = '/user/dashboard.html';
      }
      return null;
    }

    // Populate user profile info in navigation if elements exist
    const nameEls = document.querySelectorAll('.user-display-name');
    nameEls.forEach(el => el.textContent = user.fullName);

    const emailEls = document.querySelectorAll('.user-display-email');
    emailEls.forEach(el => el.textContent = user.email);

    const roleEls = document.querySelectorAll('.user-display-role');
    roleEls.forEach(el => el.textContent = user.role === 'admin' ? 'Administrator' : 'Citizen');

    const avatarEls = document.querySelectorAll('.user-display-initial');
    avatarEls.forEach(el => el.textContent = (user.fullName || 'U').charAt(0).toUpperCase());

    return user;
  } catch (err) {
    console.error('Session check error:', err);
    window.location.href = '/login.html';
    return null;
  }
}

// Global logout action
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout failed:', err);
    window.location.href = '/login.html';
  }
}

// Mobile sidebar drawer setup
function initSidebarToggle() {
  const toggleBtn = document.querySelector('.sidebar-toggle-btn');
  const sidebar = document.querySelector('.app-sidebar');
  let overlay = document.querySelector('.sidebar-overlay');

  if (toggleBtn && sidebar) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('show');
      overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }
});
