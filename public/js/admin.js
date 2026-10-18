/**
 * EcoTrack — Administrator Management Script
 * Controls Admin Dashboard, Chart.js metrics, Reports, Users, Categories, and Collections.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth('admin');
  if (!user) return;

  if (document.getElementById('admin-dashboard-container')) {
    initAdminDashboard();
  } else if (document.getElementById('admin-reports-container')) {
    initAdminReports();
  } else if (document.getElementById('admin-users-container')) {
    initAdminUsers();
  } else if (document.getElementById('admin-categories-container')) {
    initAdminCategories();
  } else if (document.getElementById('admin-collections-container')) {
    initAdminCollections();
  }
});

// 1. Admin Dashboard Metrics & Chart.js
let categoryChartInstance = null;
let statusChartInstance = null;

async function initAdminDashboard() {
  try {
    const res = await fetch('/api/admin/dashboard');
    const json = await res.json();

    if (!json.success) {
      showToast('Failed to load administrator dashboard data.', 'error');
      return;
    }

    const { summary, charts, recentReports, recentUsers } = json.data;

    // Stat Counters
    document.getElementById('admin-stat-users').textContent = summary.totalUsers;
    document.getElementById('admin-stat-reports').textContent = summary.totalReports;
    document.getElementById('admin-stat-pending').textContent = summary.pending;
    document.getElementById('admin-stat-inprogress').textContent = summary.inProgress;
    document.getElementById('admin-stat-collected').textContent = summary.collected;

    // Render Recent Reports
    const reportsTable = document.getElementById('admin-recent-reports-body');
    if (reportsTable) {
      if (recentReports.length === 0) {
        reportsTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No reports registered in the database yet.</td></tr>';
      } else {
        reportsTable.innerHTML = recentReports.map(r => `
          <tr>
            <td class="fw-bold">#${r.id}</td>
            <td>
              <div class="fw-semibold">${escapeHtml(r.reporter_name)}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(r.category_name)}</span></td>
            <td><span class="text-truncate d-inline-block" style="max-width: 180px;">${escapeHtml(r.location)}</span></td>
            <td>${getStatusBadge(r.status)}</td>
            <td class="text-end">
              <a href="/admin/report-details.html?id=${r.id}" class="btn btn-sm btn-outline-secondary">
                <i class="bi bi-eye me-1"></i>Review
              </a>
            </td>
          </tr>
        `).join('');
      }
    }

    // Render Recent Users
    const usersTable = document.getElementById('admin-recent-users-body');
    if (usersTable) {
      if (recentUsers.length === 0) {
        usersTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No registered users yet.</td></tr>';
      } else {
        usersTable.innerHTML = recentUsers.map(u => `
          <tr>
            <td class="fw-semibold">${escapeHtml(u.full_name)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>
              <span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">
                ${escapeHtml(u.status)}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    // Render Chart 1: Reports by Category
    const catCanvas = document.getElementById('chart-reports-by-category');
    if (catCanvas && window.Chart) {
      if (categoryChartInstance) categoryChartInstance.destroy();

      const catLabels = charts.categories.map(c => c.name);
      const catCounts = charts.categories.map(c => Number(c.count));

      categoryChartInstance = new Chart(catCanvas, {
        type: 'doughnut',
        data: {
          labels: catLabels.length ? catLabels : ['No Data'],
          datasets: [{
            data: catCounts.length && catCounts.some(c => c > 0) ? catCounts : [1],
            backgroundColor: [
              '#15803D',
              '#10B981',
              '#0284C7',
              '#F59E0B',
              '#8B5CF6',
              '#EC4899'
            ],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    // Render Chart 2: Reports by Status
    const statusCanvas = document.getElementById('chart-reports-by-status');
    if (statusCanvas && window.Chart) {
      if (statusChartInstance) statusChartInstance.destroy();

      const statusLabels = charts.statuses.map(s => s.status);
      const statusCounts = charts.statuses.map(s => Number(s.count));

      statusChartInstance = new Chart(statusCanvas, {
        type: 'bar',
        data: {
          labels: statusLabels.length ? statusLabels : ['No Reports'],
          datasets: [{
            label: 'Total Reports',
            data: statusCounts.length ? statusCounts : [0],
            backgroundColor: '#15803D',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    showToast('Failed to load dashboard metrics.', 'error');
  }
}

// 2. Admin Reports Management
async function initAdminReports() {
  const searchInput = document.getElementById('admin-search-reports');
  const statusFilter = document.getElementById('admin-filter-status');
  const categoryFilter = document.getElementById('admin-filter-category');
  const sortFilter = document.getElementById('admin-filter-sort');
  const tableBody = document.getElementById('admin-reports-body');
  const tableContainer = document.getElementById('admin-reports-table-container');
  const emptyState = document.getElementById('admin-reports-empty-state');

  // Load Categories into Filter
  try {
    const catRes = await fetch('/api/categories');
    const catJson = await catRes.json();
    if (catJson.success && catJson.data) {
      categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
        catJson.data.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load categories filter:', err);
  }

  async function loadReports() {
    const params = new URLSearchParams();
    if (statusFilter.value !== 'all') params.append('status', statusFilter.value);
    if (categoryFilter.value !== 'all') params.append('categoryId', categoryFilter.value);
    if (searchInput.value.trim()) params.append('search', searchInput.value.trim());
    if (sortFilter.value) params.append('sort', sortFilter.value);

    try {
      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        showToast('Failed to load reports.', 'error');
        return;
      }

      const reports = json.data;

      if (!reports || reports.length === 0) {
        tableContainer.classList.add('d-none');
        emptyState.classList.remove('d-none');
        return;
      }

      tableContainer.classList.remove('d-none');
      emptyState.classList.add('d-none');

      tableBody.innerHTML = reports.map(r => `
        <tr>
          <td class="fw-bold">#${r.id}</td>
          <td>
            <img src="${escapeHtml(r.image_path)}" alt="Photo" 
                 class="rounded border" style="width: 44px; height: 44px; object-fit: cover;">
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(r.reporter_name)}</div>
            <div class="small text-muted">${escapeHtml(r.reporter_email)}</div>
          </td>
          <td>
            <span class="badge bg-light text-dark border">${escapeHtml(r.category_name)}</span>
            <div class="small text-muted text-truncate" style="max-width: 180px;">${escapeHtml(r.description)}</div>
          </td>
          <td>
            <span class="text-truncate d-inline-block" style="max-width: 160px;">
              <i class="bi bi-geo-alt text-eco-primary me-1"></i>${escapeHtml(r.location)}
            </span>
          </td>
          <td>${formatDate(r.created_at)}</td>
          <td>${getStatusBadge(r.status)}</td>
          <td class="text-end">
            <div class="dropdown d-inline-block">
              <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                Actions
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                <li>
                  <a class="dropdown-item" href="/admin/report-details.html?id=${r.id}">
                    <i class="bi bi-eye me-2"></i>Full Details
                  </a>
                </li>
                ${renderStatusActions(r)}
              </ul>
            </div>
          </td>
        </tr>
      `).join('');

      // Attach action event handlers
      attachReportActionHandlers();

    } catch (err) {
      console.error('Error fetching admin reports:', err);
      showToast('Failed to fetch reports list.', 'error');
    }
  }

  function renderStatusActions(r) {
    let items = '<li><hr class="dropdown-divider"></li>';
    if (r.status === 'Pending') {
      items += `
        <li><a class="dropdown-item text-primary btn-transition" href="#" data-id="${r.id}" data-action="Approved"><i class="bi bi-check2-circle me-2"></i>Approve</a></li>
        <li><a class="dropdown-item text-danger btn-transition" href="#" data-id="${r.id}" data-action="Rejected"><i class="bi bi-x-circle me-2"></i>Reject</a></li>
      `;
    } else if (r.status === 'Approved') {
      items += `
        <li><a class="dropdown-item text-primary btn-transition" href="#" data-id="${r.id}" data-action="In Progress"><i class="bi bi-arrow-repeat me-2"></i>Mark In Progress</a></li>
        <li><a class="dropdown-item text-danger btn-transition" href="#" data-id="${r.id}" data-action="Rejected"><i class="bi bi-x-circle me-2"></i>Reject</a></li>
      `;
    } else if (r.status === 'In Progress') {
      items += `
        <li><a class="dropdown-item text-success btn-transition" href="#" data-id="${r.id}" data-action="Collected"><i class="bi bi-check-all me-2"></i>Mark Collected</a></li>
      `;
    } else if (r.status === 'Rejected') {
      items += `
        <li><a class="dropdown-item text-secondary btn-transition" href="#" data-id="${r.id}" data-action="Pending"><i class="bi bi-arrow-counterclockwise me-2"></i>Reopen as Pending</a></li>
      `;
    } else if (r.status === 'Collected') {
      items += `<li><span class="dropdown-item-text text-muted small"><i class="bi bi-check-circle me-2"></i>Collection completed</span></li>`;
    }
    return items;
  }

  function attachReportActionHandlers() {
    document.querySelectorAll('.btn-transition').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const reportId = btn.getAttribute('data-id');
        const targetStatus = btn.getAttribute('data-action');

        const note = prompt(`Enter optional note for changing status to '${targetStatus}':`, `Approved/Updated by admin`);
        if (note === null) return; // User pressed Cancel

        try {
          const res = await fetch(`/api/admin/reports/${reportId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus, note })
          });

          const result = await res.json();
          if (result.success) {
            showToast(result.message || 'Status updated successfully!', 'success');
            loadReports();
          } else {
            showToast(result.message || 'Failed to update status.', 'error');
          }
        } catch (err) {
          console.error('Status transition error:', err);
          showToast('Network error updating status.', 'error');
        }
      });
    });
  }

  statusFilter.addEventListener('change', loadReports);
  categoryFilter.addEventListener('change', loadReports);
  sortFilter.addEventListener('change', loadReports);

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadReports, 300);
  });

  loadReports();
}

// 3. Admin Users Management
async function initAdminUsers() {
  const searchInput = document.getElementById('search-users');
  const roleFilter = document.getElementById('filter-user-role');
  const statusFilter = document.getElementById('filter-user-status');
  const tableBody = document.getElementById('users-table-body');
  const emptyState = document.getElementById('users-empty-state');
  const tableContainer = document.getElementById('users-table-container');

  async function loadUsers() {
    const params = new URLSearchParams();
    if (roleFilter.value !== 'all') params.append('role', roleFilter.value);
    if (statusFilter.value !== 'all') params.append('status', statusFilter.value);
    if (searchInput.value.trim()) params.append('search', searchInput.value.trim());

    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        showToast('Failed to load users.', 'error');
        return;
      }

      const users = json.data;

      if (!users || users.length === 0) {
        tableContainer.classList.add('d-none');
        emptyState.classList.remove('d-none');
        return;
      }

      tableContainer.classList.remove('d-none');
      emptyState.classList.add('d-none');

      tableBody.innerHTML = users.map(u => `
        <tr>
          <td class="fw-bold">#${u.id}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(u.full_name)}</div>
          </td>
          <td>${escapeHtml(u.email)}</td>
          <td>
            <span class="badge ${u.role === 'admin' ? 'bg-primary' : 'bg-light text-dark border'}">
              ${escapeHtml(u.role)}
            </span>
          </td>
          <td>
            <span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">
              ${escapeHtml(u.status)}
            </span>
          </td>
          <td>
            <span class="badge bg-secondary-subtle text-secondary border">
              ${u.report_count} reports
            </span>
          </td>
          <td>${formatDate(u.created_at)}</td>
          <td class="text-end">
            <button class="btn btn-sm ${u.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'} btn-toggle-user"
                    data-id="${u.id}" 
                    data-status="${u.status === 'active' ? 'inactive' : 'active'}"
                    data-name="${escapeHtml(u.full_name)}">
              <i class="bi ${u.status === 'active' ? 'bi-person-x' : 'bi-person-check'} me-1"></i>
              ${u.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.btn-toggle-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-id');
          const newStatus = btn.getAttribute('data-status');
          const name = btn.getAttribute('data-name');

          if (!confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} user ${name}?`)) {
            return;
          }

          try {
            const res = await fetch(`/api/admin/users/${userId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
            });

            const result = await res.json();
            if (result.success) {
              showToast(result.message, 'success');
              loadUsers();
            } else {
              showToast(result.message || 'Operation failed.', 'error');
            }
          } catch (err) {
            console.error('Error toggling user status:', err);
            showToast('Network error updating user.', 'error');
          }
        });
      });

    } catch (err) {
      console.error('Error fetching users:', err);
      showToast('Failed to retrieve users.', 'error');
    }
  }

  roleFilter.addEventListener('change', loadUsers);
  statusFilter.addEventListener('change', loadUsers);

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadUsers, 300);
  });

  loadUsers();
}

// 4. Admin Categories Management
async function initAdminCategories() {
  const tableBody = document.getElementById('categories-table-body');
  const formAdd = document.getElementById('form-add-category');
  const modalAddEl = document.getElementById('modal-add-category');
  let modalAdd = null;
  if (modalAddEl && window.bootstrap) {
    modalAdd = new bootstrap.Modal(modalAddEl);
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/admin/categories');
      const json = await res.json();

      if (!json.success) {
        showToast('Failed to load categories.', 'error');
        return;
      }

      const categories = json.data;

      tableBody.innerHTML = categories.map(c => `
        <tr>
          <td class="fw-bold">#${c.id}</td>
          <td class="fw-semibold">${escapeHtml(c.name)}</td>
          <td>
            <div class="small text-muted" style="max-width: 250px;">
              ${escapeHtml(c.description || '—')}
            </div>
          </td>
          <td>
            <div class="small" style="max-width: 280px;">
              ${escapeHtml(c.disposal_method || '—')}
            </div>
          </td>
          <td>
            <span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-inactive'}">
              ${escapeHtml(c.status)}
            </span>
          </td>
          <td>
            <span class="badge bg-light text-dark border">
              ${c.report_count} reports
            </span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger btn-delete-cat" 
                    data-id="${c.id}" 
                    data-name="${escapeHtml(c.name)}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.addEventListener('click', async () => {
          const catId = btn.getAttribute('data-id');
          const catName = btn.getAttribute('data-name');

          if (!confirm(`Are you sure you want to delete or deactivate category "${catName}"?`)) {
            return;
          }

          try {
            const res = await fetch(`/api/admin/categories/${catId}`, {
              method: 'DELETE'
            });
            const result = await res.json();

            if (result.success) {
              showToast(result.message, 'success');
              loadCategories();
            } else {
              showToast(result.message || 'Failed to delete category.', 'error');
            }
          } catch (err) {
            console.error('Delete category error:', err);
            showToast('Network error deleting category.', 'error');
          }
        });
      });

    } catch (err) {
      console.error('Error fetching categories:', err);
      showToast('Failed to fetch categories list.', 'error');
    }
  }

  // Add category form submit
  if (formAdd) {
    formAdd.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('cat-name').value.trim();
      const description = document.getElementById('cat-description').value.trim();
      const disposalMethod = document.getElementById('cat-disposal').value.trim();

      if (!name || !disposalMethod) {
        showToast('Category name and disposal recommendation are required.', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, disposalMethod })
        });

        const result = await res.json();

        if (result.success) {
          showToast('New category added successfully!', 'success');
          formAdd.reset();
          if (modalAdd) modalAdd.hide();
          loadCategories();
        } else {
          showToast(result.message || 'Failed to add category.', 'error');
        }
      } catch (err) {
        console.error('Error adding category:', err);
        showToast('Network error adding category.', 'error');
      }
    });
  }

  loadCategories();
}

// 5. Admin Collections Management
async function initAdminCollections() {
  const tableBody = document.getElementById('collections-table-body');
  const filterStatus = document.getElementById('filter-collection-status');
  const modalScheduleEl = document.getElementById('modal-schedule-collection');
  let modalSchedule = null;
  if (modalScheduleEl && window.bootstrap) {
    modalSchedule = new bootstrap.Modal(modalScheduleEl);
  }

  async function loadCollections() {
    const status = filterStatus ? filterStatus.value : 'all';
    try {
      const res = await fetch(`/api/collections?status=${status}`);
      const json = await res.json();

      if (!json.success) {
        showToast('Failed to load collection records.', 'error');
        return;
      }

      const records = json.data;

      if (!records || records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No collection records found.</td></tr>';
        return;
      }

      tableBody.innerHTML = records.map(c => `
        <tr>
          <td class="fw-bold">#${c.report_id}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(c.category_name)}</div>
            <div class="small text-muted text-truncate" style="max-width: 200px;">${escapeHtml(c.description)}</div>
          </td>
          <td>
            <i class="bi bi-geo-alt text-eco-primary me-1"></i>
            <span class="text-truncate d-inline-block" style="max-width: 180px;">${escapeHtml(c.location)}</span>
          </td>
          <td>
            <div class="fw-semibold">${c.scheduled_date ? new Date(c.scheduled_date).toLocaleDateString() : '<span class="text-warning">Not Scheduled</span>'}</div>
            <div class="small text-muted">${c.collection_notes ? escapeHtml(c.collection_notes) : '—'}</div>
          </td>
          <td>${getStatusBadge(c.report_status)}</td>
          <td>${c.completed_at ? formatDate(c.completed_at) : '<span class="text-muted">Pending</span>'}</td>
          <td class="text-end">
            ${c.report_status !== 'Collected' ? `
              <button class="btn btn-sm btn-outline-primary btn-open-schedule me-1" 
                      data-id="${c.report_id}"
                      data-date="${c.scheduled_date ? c.scheduled_date.substring(0, 10) : ''}"
                      data-notes="${escapeHtml(c.collection_notes || '')}">
                <i class="bi bi-calendar-event me-1"></i>Schedule
              </button>
              <button class="btn btn-sm btn-success btn-mark-complete" data-id="${c.report_id}">
                <i class="bi bi-check-all me-1"></i>Collected
              </button>
            ` : `
              <span class="badge bg-success-subtle text-success border">Completed</span>
            `}
          </td>
        </tr>
      `).join('');

      // Attach schedule modal trigger
      document.querySelectorAll('.btn-open-schedule').forEach(btn => {
        btn.addEventListener('click', () => {
          const reportId = btn.getAttribute('data-id');
          const date = btn.getAttribute('data-date');
          const notes = btn.getAttribute('data-notes');

          document.getElementById('sched-report-id').value = reportId;
          document.getElementById('sched-report-id-display').textContent = reportId;
          document.getElementById('sched-date').value = date || new Date().toISOString().substring(0, 10);
          document.getElementById('sched-notes').value = notes || '';

          if (modalSchedule) modalSchedule.show();
        });
      });

      // Attach mark complete handler
      document.querySelectorAll('.btn-mark-complete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const reportId = btn.getAttribute('data-id');
          if (!confirm(`Mark report #${reportId} collection as fully completed?`)) return;

          try {
            const res = await fetch(`/api/collections/${reportId}/complete`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes: 'Waste collection verified and finished.' })
            });
            const result = await res.json();
            if (result.success) {
              showToast(result.message, 'success');
              loadCollections();
            } else {
              showToast(result.message || 'Failed to complete collection.', 'error');
            }
          } catch (err) {
            console.error('Error completing collection:', err);
            showToast('Network error updating collection.', 'error');
          }
        });
      });

    } catch (err) {
      console.error('Error loading collections:', err);
      showToast('Failed to retrieve collection records.', 'error');
    }
  }

  // Handle schedule form submit
  const formSchedule = document.getElementById('form-schedule-collection');
  if (formSchedule) {
    formSchedule.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reportId = document.getElementById('sched-report-id').value;
      const scheduledDate = document.getElementById('sched-date').value;
      const notes = document.getElementById('sched-notes').value.trim();

      if (!scheduledDate) {
        showToast('Please specify a collection date.', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, scheduledDate, notes })
        });
        const result = await res.json();

        if (result.success) {
          showToast(result.message, 'success');
          if (modalSchedule) modalSchedule.hide();
          loadCollections();
        } else {
          showToast(result.message || 'Failed to schedule collection.', 'error');
        }
      } catch (err) {
        console.error('Error scheduling collection:', err);
        showToast('Network error scheduling collection.', 'error');
      }
    });
  }

  if (filterStatus) {
    filterStatus.addEventListener('change', loadCollections);
  }

  loadCollections();
}
