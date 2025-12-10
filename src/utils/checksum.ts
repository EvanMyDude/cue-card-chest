/**
 * Compute SHA-256 checksum for prompt content.
 * Matches the Supabase compute_checksum() function.
 */
export async function computeChecksum(title: string, content: string): Promise<string> {
  const data = JSON.stringify({
    title: title.trim(),
    content: content.trim(),
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Synchronous checksum using simple hash (for non-critical comparisons)
 * For critical operations, use computeChecksum which uses SHA-256
 */
export function computeChecksumSync(title: string, content: string): string {
  const data = JSON.stringify({
    title: title.trim(),
    content: content.trim(),
  });
  
  // Simple hash for quick comparisons
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
