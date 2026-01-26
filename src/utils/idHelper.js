/**
 * src/utils/idHelper.js
 * * Central utility to standardize Audit IDs and prevent data inconsistencies.
 * Usage: import { normalizeAuditID } from '../utils/idHelper';
 */

export const normalizeAuditID = (input) => {
  if (!input) return '';

  // 1. Convert to String (safety), Trim whitespace, Force Uppercase
  let cleanId = String(input).trim().toUpperCase();

  // 2. Remove internal spaces (e.g., "IQAN 25087" -> "IQAN25087")
  cleanId = cleanId.replace(/\s+/g, '');

  // 3. Remove accidental suffixes like (a), (A), (1) at the end of the string
  // Regex explanation: 
  // \(: Matches '('
  // [A-Z0-9]: Matches any single letter or number
  // \): Matches ')'
  // $: Ensures it is at the very end of the string
  cleanId = cleanId.replace(/\([A-Z0-9]\)$/, '');

  return cleanId;
};

/**
 * Optional: Validator to check if ID meets standard format
 * Standard Format: 9 Characters (e.g., IQAN25001)
 */
export const isValidAuditID = (id) => {
  if (!id) return false;
  const normalized = normalizeAuditID(id);
  
  // Check if it starts with 'IQAN' or 'IARN' and is exactly 9 chars long
  const formatRegex = /^(IQAN|IARN)[0-9]{5}$/; 
  return formatRegex.test(normalized);
};