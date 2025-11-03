/**
 * Unit tests for import logic with deduplication
 * Mocks Supabase to test pure logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackupData } from '../backup';

// Create proper mock chain
const createMockChain = () => {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };
  return chain;
};

const mockSupabase = createMockChain();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Import after mocking
import { importPromptsFromBackup, dryRunImport } from '../importer';

describe('importer logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock chain
    Object.assign(mockSupabase, createMockChain());
  });

  describe('deduplication logic', () => {
    it('should skip prompts with existing checksums', async () => {
      const backup: BackupData = {
        manifest: {
          version: 1,
          exportedAt: '2024-01-01T00:00:00Z',
          totalPrompts: 2,
          totalTags: 0,
          checksums: {
            'prompt-1': 'checksum-1',
            'prompt-2': 'checksum-2',
          },
          source: 'localStorage',
        },
        prompts: [
          {
            id: 'prompt-1',
            title: 'Prompt 1',
            content: 'Content 1',
            tags: [],
            isPinned: false,
            order: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'prompt-2',
            title: 'Prompt 2',
            content: 'Content 2',
            tags: [],
            isPinned: false,
            order: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      // Mock: prompt-1 already exists
      mockSupabase.in.mockResolvedValueOnce({
        data: [{ id: 'existing-1', checksum: 'checksum-1' }],
        error: null,
      });

      // Mock: tag query (none exist)
      mockSupabase.in.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock: successful inserts
      mockSupabase.insert.mockResolvedValue({ data: null, error: null });

      const result = await importPromptsFromBackup(backup, 'user-1', 'device-1');

      // Should skip prompt-1, import prompt-2
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should import all when no duplicates exist', async () => {
      const backup: BackupData = {
        manifest: {
          version: 1,
          exportedAt: '2024-01-01T00:00:00Z',
          totalPrompts: 3,
          totalTags: 0,
          checksums: {
            'prompt-1': 'checksum-1',
            'prompt-2': 'checksum-2',
            'prompt-3': 'checksum-3',
          },
          source: 'localStorage',
        },
        prompts: [
          {
            id: 'prompt-1',
            title: 'Prompt 1',
            content: 'Content 1',
            tags: [],
            isPinned: false,
            order: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'prompt-2',
            title: 'Prompt 2',
            content: 'Content 2',
            tags: [],
            isPinned: false,
            order: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'prompt-3',
            title: 'Prompt 3',
            content: 'Content 3',
            tags: [],
            isPinned: false,
            order: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      // Mock: no existing checksums
      mockSupabase.in.mockResolvedValue({
        data: [],
        error: null,
      });
      mockSupabase.insert.mockResolvedValue({ data: null, error: null });

      const result = await importPromptsFromBackup(backup, 'user-1', 'device-1');

      expect(result.imported).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should collect errors for missing checksums', async () => {
      const backup: BackupData = {
        manifest: {
          version: 1,
          exportedAt: '2024-01-01T00:00:00Z',
          totalPrompts: 1,
          totalTags: 0,
          checksums: {},
          source: 'localStorage',
        },
        prompts: [
          {
            id: 'prompt-1',
            title: 'Prompt 1',
            content: 'Content 1',
            tags: [],
            isPinned: false,
            order: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockSupabase.in.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await importPromptsFromBackup(backup, 'user-1', 'device-1');

      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing checksum');
    });

    it('should handle database errors gracefully', async () => {
      const backup: BackupData = {
        manifest: {
          version: 1,
          exportedAt: '2024-01-01T00:00:00Z',
          totalPrompts: 1,
          totalTags: 0,
          checksums: { 'prompt-1': 'checksum-1' },
          source: 'localStorage',
        },
        prompts: [
          {
            id: 'prompt-1',
            title: 'Prompt 1',
            content: 'Content 1',
            tags: [],
            isPinned: false,
            order: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      // Mock: checksum query fails
      mockSupabase.in.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        importPromptsFromBackup(backup, 'user-1', 'device-1')
      ).rejects.toThrow('Failed to check existing prompts');
    });
  });

  describe('dryRunImport', () => {
    it('should preview import without writing', async () => {
      const backup: BackupData = {
        manifest: {
          version: 1,
          exportedAt: '2024-01-01T00:00:00Z',
          totalPrompts: 3,
          totalTags: 0,
          checksums: {
            'prompt-1': 'checksum-1',
            'prompt-2': 'checksum-2',
            'prompt-3': 'checksum-3',
          },
          source: 'localStorage',
        },
        prompts: [
          {
            id: 'prompt-1',
            title: 'Prompt 1',
            content: 'Content 1',
            tags: [],
            isPinned: false,
            order: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'prompt-2',
            title: 'Prompt 2',
            content: 'Content 2',
            tags: [],
            isPinned: false,
            order: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'prompt-3',
            title: 'Prompt 3',
            content: 'Content 3',
            tags: [],
            isPinned: false,
            order: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      // Mock: prompt-1 exists
      mockSupabase.in.mockResolvedValueOnce({
        data: [{ checksum: 'checksum-1' }],
        error: null,
      });

      const result = await dryRunImport(backup, 'user-1');

      expect(result.wouldImport).toBe(2);
      expect(result.wouldSkip).toBe(1);
      expect(result.errors).toHaveLength(0);
      
      // Should not call insert
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });
  });

  describe('deterministic behavior', () => {
    it('should generate new UUIDs for each import', async () => {
      const backup: BackupData = {
        manifest: {
          version: 1,
          exportedAt: '2024-01-01T00:00:00Z',
          totalPrompts: 1,
          totalTags: 0,
          checksums: { 'old-id-1': 'checksum-1' },
          source: 'localStorage',
        },
        prompts: [
          {
            id: 'old-id-1',
            title: 'Prompt 1',
            content: 'Content 1',
            tags: [],
            isPinned: false,
            order: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockSupabase.in.mockResolvedValue({ data: [], error: null });
      mockSupabase.insert.mockResolvedValue({ data: null, error: null });

      const result = await importPromptsFromBackup(backup, 'user-1', 'device-1');

      expect(result.promptIdMap).toHaveProperty('old-id-1');
      expect(result.promptIdMap['old-id-1']).not.toBe('old-id-1');
      expect(result.promptIdMap['old-id-1']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });
});
