// --- Helper functions to format time and date ---

/**
 * Formats a Date object into HH.MM.SS string.
 * @param date The Date object to format.
 * @returns Formatted time string.
 */
export function formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}.${minutes}.${seconds}`;
}

/**
 * Formats a Date object into YYYY.MMM.D • DAY string.
 * @param date The Date object to format.
 * @returns Formatted date string.
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = monthNames[date.getMonth()];
    const dayOfMonth = date.getDate();
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const dayOfWeek = dayNames[date.getDay()];
    return `${year}.${month}.${dayOfMonth} • ${dayOfWeek}`;
} 