/**
 * EcoTrack — Reports Management Script (Submission, Listing, Details)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  // Check which page we are on
  if (document.getElementById('form-report-waste')) {
    initReportForm();
  } else if (document.getElementById('my-reports-container')) {
    initMyReports();
  } else if (document.getElementById('report-details-container')) {
    initReportDetails(user);
  }
});

// 1. Report Submission Form
async function initReportForm() {
  const form = document.getElementById('form-report-waste');
  const categorySelect = document.getElementById('categoryId');
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('waste-image-input');
  const previewContainer = document.getElementById('preview-container');
  const previewImg = document.getElementById('preview-img');
  const removeBtn = document.getElementById('btn-remove-preview');
  const locationInput = document.getElementById('location');
  const btnGeolocate = document.getElementById('btn-geolocate');

  let selectedFile = null;

  // Load active categories from API
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (json.success && json.data) {
      categorySelect.innerHTML = '<option value="">-- Select Waste Category --</option>' +
        json.data.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join('');

      // Check if URL parameters have prefill info from AI recognition
      const urlParams = new URLSearchParams(window.location.search);
      const prefillCatId = urlParams.get('categoryId');
      const prefillCatName = urlParams.get('categoryName');
      const recognitionId = urlParams.get('recognitionId');
      const tempImagePath = urlParams.get('imagePath');

      if (prefillCatId) {
        categorySelect.value = prefillCatId;
      } else if (prefillCatName) {
        for (let opt of categorySelect.options) {
          if (opt.text.toLowerCase() === prefillCatName.toLowerCase()) {
            opt.selected = true;
            break;
          }
        }
      }

      if (recognitionId) {
        document.getElementById('recognitionId').value = recognitionId;
      }

      // If an image was previously uploaded in recognition flow, show a hint
      if (tempImagePath) {
        const hintEl = document.getElementById('ai-image-notice');
        if (hintEl) {
          hintEl.innerHTML = `<i class="bi bi-info-circle me-1"></i>Recognition image attached. You may also upload a clearer photo below.`;
          hintEl.classList.remove('d-none');
        }
      }
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
    showToast('Failed to load waste categories.', 'error');
  }

  // Drag and Drop & File Picker Handling
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  function handleFileSelection(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Please select a valid image file (JPEG, PNG, or WebP).', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must not exceed 5MB.', 'error');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewContainer.classList.remove('d-none');
      dropzone.classList.add('d-none');
    };
    reader.readAsDataURL(file);
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFile = null;
      fileInput.value = '';
      previewImg.src = '';
      previewContainer.classList.add('d-none');
      dropzone.classList.remove('d-none');
    });
  }

  // Geolocation quick button
  if (btnGeolocate && locationInput) {
    btnGeolocate.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'warning');
        return;
      }
      btnGeolocate.disabled = true;
      btnGeolocate.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btnGeolocate.disabled = false;
          btnGeolocate.innerHTML = '<i class="bi bi-geo-alt"></i> Location Found';
          locationInput.value = `Lat: ${pos.coords.latitude.toFixed(5)}, Long: ${pos.coords.longitude.toFixed(5)}`;
          showToast('GPS coordinates captured.', 'info');
        },
        (err) => {
          btnGeolocate.disabled = false;
          btnGeolocate.innerHTML = '<i class="bi bi-crosshair"></i> Current Location';
          showToast('Could not access GPS location. Please enter your address manually.', 'warning');
        },
        { timeout: 8000 }
      );
    });
  }

  // Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const categoryId = categorySelect.value;
    const description = document.getElementById('description').value.trim();
    const location = locationInput.value.trim();
    const recognitionId = document.getElementById('recognitionId')?.value;

    if (!categoryId) {
      showToast('Please select a waste category.', 'warning');
      return;
    }

    if (!description || description.length < 5) {
      showToast('Please provide a description (at least 5 characters).', 'warning');
      return;
    }

    if (!location || location.length < 3) {
      showToast('Please enter a location or street address.', 'warning');
      return;
    }

    if (!selectedFile) {
      showToast('Please upload a photo of the waste.', 'warning');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting report...';

    const formData = new FormData();
    formData.append('categoryId', categoryId);
    formData.append('description', description);
    formData.append('location', location);
    formData.append('image', selectedFile);
    if (recognitionId) {
      formData.append('recognitionId', recognitionId);
    }

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      if (result.success) {
        showToast('Report submitted successfully!', 'success');
        setTimeout(() => {
          window.location.href = `/user/report-details.html?id=${result.data.id}`;
        }, 1000);
      } else {
        showToast(result.message || 'Submission failed.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Network error while submitting report.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// 2. User My Reports Listing
async function initMyReports() {
  const searchInput = document.getElementById('search-reports');
  const statusFilter = document.getElementById('filter-status');
  const categoryFilter = document.getElementById('filter-category');
  const sortFilter = document.getElementById('filter-sort');
  const tableBody = document.getElementById('my-reports-body');
  const tableContainer = document.getElementById('reports-table-container');
  const emptyState = document.getElementById('reports-empty-state');

  // Load category options into filter
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

  async function fetchAndRenderReports() {
    const params = new URLSearchParams();
    if (statusFilter.value !== 'all') params.append('status', statusFilter.value);
    if (categoryFilter.value !== 'all') params.append('categoryId', categoryFilter.value);
    if (searchInput.value.trim()) params.append('search', searchInput.value.trim());
    if (sortFilter.value) params.append('sort', sortFilter.value);

    try {
      const res = await fetch(`/api/reports?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        showToast('Failed to fetch reports.', 'error');
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
            <img src="${escapeHtml(r.image_path)}" alt="Waste Photo" 
                 class="rounded border" style="width: 48px; height: 48px; object-fit: cover;">
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(r.category_name)}</div>
            <div class="text-muted small text-truncate" style="max-width: 220px;">${escapeHtml(r.description)}</div>
          </td>
          <td>
            <div class="d-flex align-items-center gap-1">
              <i class="bi bi-geo-alt text-eco-primary"></i>
              <span class="text-truncate" style="max-width: 180px;">${escapeHtml(r.location)}</span>
            </div>
          </td>
          <td>${formatDate(r.created_at)}</td>
          <td>${getStatusBadge(r.status)}</td>
          <td class="text-end">
            <a href="/user/report-details.html?id=${r.id}" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-eye me-1"></i>Details
            </a>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error fetching reports:', err);
      showToast('Error loading reports list.', 'error');
    }
  }

  // Filter Event Listeners
  statusFilter.addEventListener('change', fetchAndRenderReports);
  categoryFilter.addEventListener('change', fetchAndRenderReports);
  sortFilter.addEventListener('change', fetchAndRenderReports);

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchAndRenderReports, 300);
  });

  fetchAndRenderReports();
}

// 3. Report Details View
async function initReportDetails(user) {
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');

  if (!reportId) {
    showToast('Report ID is missing.', 'error');
    setTimeout(() => {
      window.location.href = user.role === 'admin' ? '/admin/reports.html' : '/user/my-reports.html';
    }, 1200);
    return;
  }

  try {
    const res = await fetch(`/api/reports/${reportId}`);
    const json = await res.json();

    if (!json.success) {
      showToast(json.message || 'Report could not be retrieved.', 'error');
      document.getElementById('report-details-container').innerHTML = `
        <div class="alert alert-danger my-5 p-4 text-center">
          <i class="bi bi-shield-x fs-1 d-block mb-2"></i>
          <h4>${escapeHtml(json.message || 'Access Denied')}</h4>
          <p class="mb-3">You do not have permission to view this report or it does not exist.</p>
          <a href="${user.role === 'admin' ? '/admin/reports.html' : '/user/my-reports.html'}" class="btn btn-eco-primary">
            Back to Reports
          </a>
        </div>
      `;
      return;
    }

    const report = json.data;

    // Populate Report Fields
    document.getElementById('detail-id').textContent = report.id;
    document.getElementById('detail-status-badge').innerHTML = getStatusBadge(report.status);
    document.getElementById('detail-category').textContent = report.category_name;
    document.getElementById('detail-date').textContent = formatDate(report.created_at);
    document.getElementById('detail-location').textContent = report.location;
    document.getElementById('detail-description').textContent = report.description;
    document.getElementById('detail-image').src = report.image_path;

    // Disposal guide info
    if (document.getElementById('detail-disposal-method')) {
      document.getElementById('detail-disposal-method').textContent = report.disposal_method || 'Standard disposal protocol applies.';
    }

    // Reporter Info
    if (document.getElementById('detail-reporter-name')) {
      document.getElementById('detail-reporter-name').textContent = report.reporter_name;
      document.getElementById('detail-reporter-email').textContent = report.reporter_email;
    }

    // Admin Note
    const adminNoteCard = document.getElementById('detail-admin-note-card');
    const adminNoteText = document.getElementById('detail-admin-note');
    if (adminNoteCard && adminNoteText) {
      if (report.admin_note) {
        adminNoteText.textContent = report.admin_note;
        adminNoteCard.classList.remove('d-none');
      } else {
        adminNoteCard.classList.add('d-none');
      }
    }

    // Collection Schedule Info
    const collectionCard = document.getElementById('detail-collection-card');
    if (collectionCard) {
      if (report.collection) {
        collectionCard.classList.remove('d-none');
        document.getElementById('collection-date').textContent = report.collection.scheduled_date ? new Date(report.collection.scheduled_date).toLocaleDateString() : 'Pending schedule';
        document.getElementById('collection-completed').textContent = report.collection.completed_at ? formatDate(report.collection.completed_at) : 'In Progress';
        document.getElementById('collection-notes').textContent = report.collection.notes || 'No specific instructions provided.';
      } else {
        collectionCard.classList.add('d-none');
      }
    }

    // Status Timeline History
    const timelineContainer = document.getElementById('detail-timeline');
    if (timelineContainer && report.history) {
      if (report.history.length === 0) {
        timelineContainer.innerHTML = '<p class="text-muted small">No history recorded yet.</p>';
      } else {
        timelineContainer.innerHTML = report.history.map(item => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-eco-primary">
                  ${item.old_status ? `${escapeHtml(item.old_status)} → ` : ''}${escapeHtml(item.new_status)}
                </span>
                <span class="timeline-date">${formatDate(item.created_at)}</span>
              </div>
              <p class="small text-muted mb-1">${escapeHtml(item.note || 'Status updated.')}</p>
              <div class="small text-secondary" style="font-size: 0.78rem;">
                <i class="bi bi-person me-1"></i>Updated by: <strong>${escapeHtml(item.changer_name)}</strong> (${escapeHtml(item.changer_role)})
              </div>
            </div>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    console.error('Error fetching report details:', err);
    showToast('Failed to load report details.', 'error');
  }
}
