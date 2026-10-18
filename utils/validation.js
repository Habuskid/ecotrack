/**
 * EcoTrack Validation Utilities
 */

// Email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= 6;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Validates status transitions for waste reports according to the system workflow:
 * Pending -> Approved or Rejected
 * Approved -> In Progress or Rejected
 * In Progress -> Collected
 */
function isValidStatusTransition(currentStatus, newStatus) {
  const allowedTransitions = {
    'Pending': ['Approved', 'Rejected'],
    'Approved': ['In Progress', 'Rejected'],
    'In Progress': ['Collected'],
    'Rejected': ['Pending'], // Allows admin to reopen if needed
    'Collected': [] // Terminal state
  };

  if (!allowedTransitions[currentStatus]) {
    return false;
  }

  return allowedTransitions[currentStatus].includes(newStatus);
}

module.exports = {
  isValidEmail,
  isValidPassword,
  sanitizeString,
  isValidStatusTransition
};
