/**
 * Checksum utilities for content-based versioning and conflict detection
 * Uses SHA-256 to compute deterministic hashes of prompt data
 */

/**
 * Normalize text content for consistent checksumming
 * - Trims whitespace
 * - Normalizes line endings to \n
 * - Removes trailing whitespace from each line
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

/**
 * Compute SHA-256 checksum of prompt title and content
 * This matches the server-side compute_checksum function
 * 
 * @param title - Prompt title
 * @param content - Prompt content
 * @returns Hex-encoded SHA-256 hash
 */
export async function computeChecksum(title: string, content: string): Promise<string> {
  // Normalize inputs to match server behavior
  const normalizedTitle = normalizeText(title);
  const normalizedContent = normalizeText(content);
  
  // Create JSON structure matching server's jsonb_build_object
  const data = JSON.stringify({
    title: normalizedTitle,
    content: normalizedContent,
  });
  
  // Compute SHA-256 hash
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Compare two checksums for equality
 */
export function checksumsEqual(checksum1: string, checksum2: string): boolean {
  return checksum1.toLowerCase() === checksum2.toLowerCase();
}

/**
 * Validate checksum format (64-character hex string)
 */
export function isValidChecksum(checksum: string): boolean {
  return /^[0-9a-f]{64}$/i.test(checksum);
}
