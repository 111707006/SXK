/**
 * Date and Age calculation utilities for children developmental assessments
 */

/**
 * Calculates child's age in months based on a birth date string (YYYY-MM-DD).
 * Reference date defaults to the current date (July 8, 2026).
 */
export function calculateAgeMonth(birthDateStr: string, referenceDateStr: string = '2026-07-08'): number {
  if (!birthDateStr) return 36;
  
  const birth = new Date(birthDateStr);
  const ref = new Date(referenceDateStr);
  
  if (isNaN(birth.getTime())) return 36;
  
  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();
  let totalMonths = years * 12 + months;
  
  // Adjust if day of month is not reached yet
  if (ref.getDate() < birth.getDate()) {
    totalMonths--;
  }
  
  // Return minimum 0 months
  return Math.max(0, totalMonths);
}

/**
 * Formats a given number of months into "X岁X月" format.
 */
export function formatAge(ageMonth: number): string {
  if (ageMonth < 0) return '0岁';
  
  const years = Math.floor(ageMonth / 12);
  const months = ageMonth % 12;
  
  if (years === 0) {
    return `${months}个月`;
  }
  if (months === 0) {
    return `${years}岁`;
  }
  return `${years}岁${months}个月`;
}

/**
 * Generates a default birth date string (YYYY-MM-DD) based on a given number of months.
 * Subtracts months from the reference date (July 8, 2026).
 */
export function getBirthDateFromAgeMonth(ageMonth: number, referenceDateStr: string = '2026-07-08'): string {
  const ref = new Date(referenceDateStr);
  // Subtract ageMonth months from reference date
  ref.setMonth(ref.getMonth() - ageMonth);
  
  const year = ref.getFullYear();
  const month = String(ref.getMonth() + 1).padStart(2, '0');
  const day = String(ref.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
