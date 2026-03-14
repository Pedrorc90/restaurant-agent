const FORBIDDEN_PATTERNS = [
  "</",
  "<instructions",
  "<system",
  "<restaurant_data",
  "<extra_context",
];

/**
 * Sanitizes a tenant-supplied string field before embedding it in the system prompt.
 * Applied at use-time (not on ingestion) so legacy DB data is also covered.
 */
export function sanitizeTenantField(value: string): string {
  // Trim whitespace
  let s = value.trim();

  // Strip control characters (except \t \n \r)
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");

  // Collapse more than 2 consecutive newlines to a single newline
  s = s.replace(/\n{3,}/g, "\n");

  // Reject if it contains XML injection patterns targeting our structure
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (s.includes(pattern)) {
      throw new Error(`Field contains forbidden pattern: "${pattern}"`);
    }
  }

  return s;
}
