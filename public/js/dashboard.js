/**
 * EcoTrack — User Dashboard Controller Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth('user');
  if (!user) return;

  loadUserDashboard();
});

async function loadUserDashboard() {
  try {
    const res = await fetch('/api/reports/stats/summary');
    const json = await res.json();

    if (!json.success) {
      showToast('Failed to load dashboard metrics.', 'error');
      return;
    }

    const { stats, recentReports } = json.data;

    // Populate stat counters
    document.getElementById('stat-total-reports').textContent = stats.total;
    document.getElementById('stat-pending-reports').textContent = stats.pending;
    document.getElementById('stat-inprogress-reports').textContent = stats.inProgress;
    document.getElementById('stat-collected-reports').textContent = stats.collected;

    // Render Recent Reports table
    const tableBody = document.getElementById('recent-reports-body');
    const emptyState = document.getElementById('recent-reports-empty');
    const tableContainer = document.getElementById('recent-reports-table-container');

    if (!recentReports || recentReports.length === 0) {
      tableContainer.classList.add('d-none');
      emptyState.classList.remove('d-none');
      return;
    }

    tableContainer.classList.remove('d-none');
    emptyState.classList.add('d-none');

    tableBody.innerHTML = recentReports.map(report => `
      <tr>
        <td class="fw-semibold">#${report.id}</td>
        <td>
          <span class="badge bg-light text-dark border">
            ${escapeHtml(report.category_name)}
          </span>
        </td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-geo-alt text-eco-primary"></i>
            <span class="text-truncate" style="max-width: 200px;">${escapeHtml(report.location)}</span>
          </div>
        </td>
        <td>${formatDate(report.created_at)}</td>
        <td>${getStatusBadge(report.status)}</td>
        <td class="text-end">
          <a href="/user/report-details.html?id=${report.id}" class="btn btn-sm btn-outline-secondary">
            <i class="bi bi-eye me-1"></i>View
          </a>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Network error loading dashboard statistics.', 'error');
  }
}
