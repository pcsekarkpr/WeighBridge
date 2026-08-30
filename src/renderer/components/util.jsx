// util.jsx

/**
 * Formats various date/time representations into a standard "DD-MMM H:MMAM/PM" string (e.g., "25-Jul 5:04PM").
 * 
 * @param {Object|string|Date} dateInput - A transaction row object, raw date string, or Date instance.
 * @returns {string} Formatted date and time string.
 */
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '---';

  // Handle if dateInput is a transaction row object OR a direct date string/Date instance
  const rawDateTime = typeof dateInput === 'object' && !(dateInput instanceof Date)
    ? (dateInput.ticketDate || dateInput.weighing_date || dateInput.created_at || dateInput.ticket_date || dateInput.date_time)
    : dateInput;

  if (!rawDateTime) return '---';

  const dateObj = new Date(rawDateTime);
  if (isNaN(dateObj.getTime())) {
    return String(rawDateTime).substring(0, 16);
  }

  // Formats date part as "25-Jul"
  const datePart = dateObj.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short' 
  }).replace(' ', '-');

  // Formats time part as "5:04PM"
  const timePart = dateObj.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).replace(/\s+/g, '');

  return `${datePart} ${timePart}`;
};
// util.jsx

/**
 * Extracts and formats the date part as DD/MM/YYYY (e.g., "25/07/2026")
 * 
 * @param {Object|string|Date} dateInput 
 * @returns {string} Formatted date string
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '---';

  const rawDateTime = typeof dateInput === 'object' && !(dateInput instanceof Date)
    ? (dateInput.ticketDate || dateInput.weighing_date || dateInput.created_at || dateInput.ticket_date || dateInput.date_time)
    : dateInput;

  if (!rawDateTime) return '---';

  const dateObj = new Date(rawDateTime);
  if (isNaN(dateObj.getTime())) return '---';

  // Formats to DD/MM/YYYY in Indian standard locale
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Extracts and formats the time part as hh:mm AM/PM (e.g., "05:12 PM")
 * 
 * @param {Object|string|Date} dateInput 
 * @returns {string} Formatted time string
 */
export const formatTime = (dateInput) => {
  if (!dateInput) return '---';

  const rawDateTime = typeof dateInput === 'object' && !(dateInput instanceof Date)
    ? (dateInput.ticketDate || dateInput.weighing_date || dateInput.created_at || dateInput.ticket_date || dateInput.date_time)
    : dateInput;

  if (!rawDateTime) return '---';

  const dateObj = new Date(rawDateTime);
  if (isNaN(dateObj.getTime())) return '---';

  // Formats to 12-hour hh:mm AM/PM format
  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};