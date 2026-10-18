/**
 * EcoTrack — Auth Page Scripts (Login & Register)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Password Visibility Toggle
  const toggleButtons = document.querySelectorAll('.password-toggle-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = btn.querySelector('i');

      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
      }
    });
  });

  // Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showToast('Please enter both email and password.', 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
          showToast('Login successful! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = result.data.redirectUrl;
          }, 800);
        } else {
          showToast(result.message || 'Login failed. Please check your credentials.', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Registration Form Submission
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;

      const fullName = document.getElementById('fullName').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (!fullName || !email || !password || !confirmPassword) {
        showToast('Please fill in all required fields.', 'warning');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'warning');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, email, password, confirmPassword })
        });

        const result = await response.json();

        if (result.success) {
          showToast('Account created successfully! Redirecting to your dashboard...', 'success');
          setTimeout(() => {
            window.location.href = '/user/dashboard.html';
          }, 1000);
        } else {
          showToast(result.message || 'Registration failed.', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      } catch (err) {
        showToast('Network error during registration.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }
});
