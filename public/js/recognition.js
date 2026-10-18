/**
 * EcoTrack — AI Waste Recognition Client Logic
 * Interfaces with the backend AI identification service.
 * Never fakes or generates random predictions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth('user');
  if (!user) return;

  const dropzone = document.getElementById('recognition-dropzone');
  const fileInput = document.getElementById('waste-file-input');
  const cameraInput = document.getElementById('waste-camera-input');
  const btnCamera = document.getElementById('btn-camera-trigger');
  const previewContainer = document.getElementById('recognition-preview-container');
  const previewImg = document.getElementById('recognition-preview-img');
  const removeBtn = document.getElementById('btn-remove-recognition-preview');
  const btnAnalyze = document.getElementById('btn-analyze-waste');
  const loadingState = document.getElementById('recognition-loading');
  const resultCard = document.getElementById('recognition-result-card');
  const unavailableCard = document.getElementById('recognition-unavailable-card');

  let selectedFile = null;

  // File picker triggers
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
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  // Camera trigger
  if (btnCamera && cameraInput) {
    btnCamera.addEventListener('click', (e) => {
      e.stopPropagation();
      cameraInput.click();
    });

    cameraInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  function handleFileSelect(file) {
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      showToast('Please select a valid image file (JPEG, PNG, or WebP).', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must not exceed 5MB.', 'error');
      return;
    }

    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewContainer.classList.remove('d-none');
      dropzone.classList.add('d-none');
      btnAnalyze.classList.remove('d-none');
      resultCard.classList.add('d-none');
      unavailableCard.classList.add('d-none');
    };
    reader.readAsDataURL(file);
  }

  // Remove preview
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetUploadState();
    });
  }

  function resetUploadState() {
    selectedFile = null;
    fileInput.value = '';
    if (cameraInput) cameraInput.value = '';
    previewImg.src = '';
    previewContainer.classList.add('d-none');
    dropzone.classList.remove('d-none');
    btnAnalyze.classList.add('d-none');
    resultCard.classList.add('d-none');
    unavailableCard.classList.add('d-none');
    loadingState.classList.add('d-none');
  }

  // Analyze Button Action
  btnAnalyze.addEventListener('click', async () => {
    if (!selectedFile) {
      showToast('Please select or capture a photo first.', 'warning');
      return;
    }

    btnAnalyze.disabled = true;
    loadingState.classList.remove('d-none');
    resultCard.classList.add('d-none');
    unavailableCard.classList.add('d-none');

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('/api/recognition', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      loadingState.classList.add('d-none');
      btnAnalyze.disabled = false;

      // Handle Genuine AI Result
      if (result.success && result.available && result.data) {
        const data = result.data;
        document.getElementById('result-category-name').textContent = data.category;
        document.getElementById('result-disposal-recommendation').textContent = data.disposalMethod || 'Follow standard recycling protocol.';
        document.getElementById('result-explanation').textContent = data.explanation || 'Analyzed with AI waste classification.';

        const confidenceEl = document.getElementById('result-confidence-badge');
        if (data.confidence) {
          confidenceEl.textContent = `${data.confidence}% Confidence`;
          confidenceEl.classList.remove('d-none');
        } else {
          confidenceEl.classList.add('d-none');
        }

        // Setup proceed button to report form with prefill
        const btnConfirm = document.getElementById('btn-confirm-report');
        btnConfirm.href = `/user/report-waste.html?categoryId=${data.categoryId || ''}&categoryName=${encodeURIComponent(data.category)}&recognitionId=${data.recognitionId || ''}&imagePath=${encodeURIComponent(data.imagePath || '')}`;

        const btnManual = document.getElementById('btn-change-manual');
        btnManual.href = `/user/report-waste.html?imagePath=${encodeURIComponent(data.imagePath || '')}`;

        resultCard.classList.remove('d-none');
        showToast('Waste recognized successfully!', 'success');
      } else {
        // Genuine Model is unconfigured or unavailable
        const messageText = result.message || 'Waste recognition is currently unavailable. Please select the waste category manually.';
        document.getElementById('unavailable-message-text').textContent = messageText;

        const btnProceedManual = document.getElementById('btn-proceed-manual');
        const imgPath = result.data?.imagePath || '';
        btnProceedManual.href = `/user/report-waste.html?imagePath=${encodeURIComponent(imgPath)}`;

        unavailableCard.classList.remove('d-none');
        showToast('AI recognition unavailable. You can proceed with manual selection.', 'info');
      }

    } catch (err) {
      console.error('Recognition network error:', err);
      loadingState.classList.add('d-none');
      btnAnalyze.disabled = false;

      document.getElementById('unavailable-message-text').textContent = 'Waste recognition is currently unavailable. Please select the waste category manually.';
      document.getElementById('btn-proceed-manual').href = '/user/report-waste.html';
      unavailableCard.classList.remove('d-none');
    }
  });
});
