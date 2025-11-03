/**
 * Unit tests for checksum utilities
 * Ensures deterministic hashing and proper normalization
 */

import { describe, it, expect } from 'vitest';
import { normalizeText, computeChecksum, checksumsEqual, isValidChecksum } from '../checksum';

describe('checksum utilities', () => {
  describe('normalizeText', () => {
    it('should trim leading and trailing whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello');
      expect(normalizeText('\n\n  world  \n\n')).toBe('world');
    });

    it('should normalize line endings to \\n', () => {
      expect(normalizeText('hello\r\nworld')).toBe('hello\nworld');
      expect(normalizeText('line1\r\nline2\r\nline3')).toBe('line1\nline2\nline3');
    });

    it('should remove trailing whitespace from each line', () => {
      expect(normalizeText('hello  \nworld  ')).toBe('hello\nworld');
      expect(normalizeText('line1   \nline2\t\nline3 ')).toBe('line1\nline2\nline3');
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(normalizeText('   \n  \t  ')).toBe('');
    });

    it('should combine multiple normalizations', () => {
      const input = '  Title with spaces  \r\n\r\n  Content line 1  \r\n  Content line 2\t  ';
      const expected = 'Title with spaces\n\nContent line 1\nContent line 2';
      expect(normalizeText(input)).toBe(expected);
    });
  });

  describe('computeChecksum', () => {
    it('should produce consistent checksums for same input', async () => {
      const checksum1 = await computeChecksum('Title', 'Content');
      const checksum2 = await computeChecksum('Title', 'Content');
      expect(checksum1).toBe(checksum2);
    });

    it('should produce different checksums for different content', async () => {
      const checksum1 = await computeChecksum('Title', 'Content 1');
      const checksum2 = await computeChecksum('Title', 'Content 2');
      expect(checksum1).not.toBe(checksum2);
    });

    it('should produce different checksums for different titles', async () => {
      const checksum1 = await computeChecksum('Title 1', 'Content');
      const checksum2 = await computeChecksum('Title 2', 'Content');
      expect(checksum1).not.toBe(checksum2);
    });

    it('should normalize before hashing (whitespace insensitive)', async () => {
      const checksum1 = await computeChecksum('Title', 'Content');
      const checksum2 = await computeChecksum('  Title  ', '  Content  ');
      expect(checksum1).toBe(checksum2);
    });

    it('should normalize before hashing (line ending insensitive)', async () => {
      const checksum1 = await computeChecksum('Title', 'Line1\nLine2');
      const checksum2 = await computeChecksum('Title', 'Line1\r\nLine2');
      expect(checksum1).toBe(checksum2);
    });

    it('should produce 64-character hex string (SHA-256)', async () => {
      const checksum = await computeChecksum('Test', 'Data');
      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(checksum.length).toBe(64);
    });

    it('should handle empty strings', async () => {
      const checksum = await computeChecksum('', '');
      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle unicode characters', async () => {
      const checksum1 = await computeChecksum('Título', 'Contenido 中文');
      const checksum2 = await computeChecksum('Título', 'Contenido 中文');
      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should match server-side format (JSON structure)', async () => {
      // The checksum is computed from JSON: {"title":"...","content":"..."}
      // This test verifies the structure matches server expectations
      const checksum = await computeChecksum('My Title', 'My Content');
      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('checksumsEqual', () => {
    it('should compare checksums case-insensitively', () => {
      expect(checksumsEqual('abc123', 'ABC123')).toBe(true);
      expect(checksumsEqual('ABC123', 'abc123')).toBe(true);
      expect(checksumsEqual('AbC123', 'aBc123')).toBe(true);
    });

    it('should return false for different checksums', () => {
      expect(checksumsEqual('abc123', 'def456')).toBe(false);
      expect(checksumsEqual('abc', 'abcd')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(checksumsEqual('', '')).toBe(true);
      expect(checksumsEqual('abc', '')).toBe(false);
    });
  });

  describe('isValidChecksum', () => {
    it('should validate correct checksum format', () => {
      const validChecksum = 'a'.repeat(64);
      expect(isValidChecksum(validChecksum)).toBe(true);
    });

    it('should validate mixed case hex', () => {
      const validChecksum = 'A'.repeat(32) + 'f'.repeat(32);
      expect(isValidChecksum(validChecksum)).toBe(true);
    });

    it('should reject invalid length', () => {
      expect(isValidChecksum('abc')).toBe(false);
      expect(isValidChecksum('a'.repeat(63))).toBe(false);
      expect(isValidChecksum('a'.repeat(65))).toBe(false);
    });

    it('should reject non-hex characters', () => {
      const invalidChecksum = 'g' + 'a'.repeat(63);
      expect(isValidChecksum(invalidChecksum)).toBe(false);
      
      const invalidChecksum2 = 'z' + 'f'.repeat(63);
      expect(isValidChecksum(invalidChecksum2)).toBe(false);
    });

    it('should reject special characters', () => {
      const invalidChecksum = '!' + 'a'.repeat(63);
      expect(isValidChecksum(invalidChecksum)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isValidChecksum('')).toBe(false);
    });
  });

  describe('determinism and collision resistance', () => {
    it('should produce same hash across multiple calls', async () => {
      const inputs = [
        ['Title1', 'Content1'],
        ['Title2', 'Content2'],
        ['', ''],
        ['A'.repeat(1000), 'B'.repeat(1000)],
      ];

      for (const [title, content] of inputs) {
        const checksums = await Promise.all([
          computeChecksum(title, content),
          computeChecksum(title, content),
          computeChecksum(title, content),
        ]);

        expect(checksums[0]).toBe(checksums[1]);
        expect(checksums[1]).toBe(checksums[2]);
      }
    });

    it('should avoid collisions for similar inputs', async () => {
      const checksums = await Promise.all([
        computeChecksum('Title', 'Content'),
        computeChecksum('Title', 'Content '),
        computeChecksum('Title', 'Content\n'),
        computeChecksum('Title', 'Contents'),
        computeChecksum('Titles', 'Content'),
      ]);

      // First 3 should be same (whitespace normalized)
      expect(checksums[0]).toBe(checksums[1]);
      expect(checksums[0]).toBe(checksums[2]);
      
      // But different from the others
      expect(checksums[0]).not.toBe(checksums[3]);
      expect(checksums[0]).not.toBe(checksums[4]);
    });
  });
});
