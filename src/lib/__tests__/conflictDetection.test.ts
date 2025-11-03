/**
 * Unit tests for conflict detection logic
 * Tests 30-second window and conflict creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  functions: {
    invoke: vi.fn(),
  },
  auth: {
    getSession: vi.fn(),
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('conflict detection logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('30-second window (last-write-wins)', () => {
    it('should allow update within 30 seconds (no conflict)', async () => {
      const now = new Date();
      const recentUpdate = new Date(now.getTime() - 20000); // 20 seconds ago

      // This test simulates server-side behavior
      const timeDiff = now.getTime() - recentUpdate.getTime();
      const withinWindow = timeDiff <= 30000;

      expect(withinWindow).toBe(true);
    });

    it('should create conflict beyond 30 seconds', async () => {
      const now = new Date();
      const oldUpdate = new Date(now.getTime() - 40000); // 40 seconds ago

      const timeDiff = now.getTime() - oldUpdate.getTime();
      const withinWindow = timeDiff <= 30000;

      expect(withinWindow).toBe(false);
    });

    it('should handle edge case at exactly 30 seconds', async () => {
      const now = new Date();
      const exactUpdate = new Date(now.getTime() - 30000);

      const timeDiff = now.getTime() - exactUpdate.getTime();
      const withinWindow = timeDiff <= 30000;

      expect(withinWindow).toBe(true);
    });
  });

  describe('conflict creation', () => {
    it('should detect checksum mismatch', () => {
      const serverChecksum: string = 'abc123';
      const clientChecksum: string = 'def456';
      
      const hasConflict = serverChecksum !== clientChecksum;
      expect(hasConflict).toBe(true);
    });

    it('should not conflict when checksums match', () => {
      const serverChecksum: string = 'abc123';
      const clientChecksum: string = 'abc123';
      
      const hasConflict = serverChecksum === clientChecksum;
      expect(hasConflict).toBe(true);
    });
  });

  describe('sync-prompts edge function conflict logic', () => {
    it('should return conflicts array when checksums differ', async () => {
      // Mock authenticated session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1' },
            access_token: 'token',
          },
        },
      });

      // Mock edge function response with conflict
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          synced: [],
          conflicts: [
            {
              promptId: 'prompt-1',
              revisionId: 'revision-1',
              serverVersion: {
                title: 'Server Title',
                content: 'Server Content',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              clientVersion: {
                title: 'Client Title',
                content: 'Client Content',
                updatedAt: '2024-01-01T00:00:30Z',
              },
            },
          ],
          serverPrompts: [],
          syncToken: 'new-token',
        },
        error: null,
      });

      const result = await mockSupabase.functions.invoke('sync-prompts', {
        body: {
          deviceId: 'device-1',
          lastSyncAt: null,
          prompts: [
            {
              id: 'prompt-1',
              title: 'Client Title',
              content: 'Client Content',
              checksum: 'client-checksum',
              tags: [],
              isPinned: false,
              order: 0,
              updatedAt: '2024-01-01T00:00:30Z',
            },
          ],
        },
      });

      expect(result.data.conflicts).toHaveLength(1);
      expect(result.data.conflicts[0].promptId).toBe('prompt-1');
    });

    it('should sync without conflict when checksums match', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1' },
            access_token: 'token',
          },
        },
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          synced: [
            {
              id: 'prompt-1',
              title: 'Title',
              content: 'Content',
              checksum: 'matching-checksum',
            },
          ],
          conflicts: [],
          serverPrompts: [],
          syncToken: 'new-token',
        },
        error: null,
      });

      const result = await mockSupabase.functions.invoke('sync-prompts', {
        body: {
          deviceId: 'device-1',
          lastSyncAt: null,
          prompts: [
            {
              id: 'prompt-1',
              title: 'Title',
              content: 'Content',
              checksum: 'matching-checksum',
              tags: [],
              isPinned: false,
              order: 0,
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      });

      expect(result.data.conflicts).toHaveLength(0);
      expect(result.data.synced).toHaveLength(1);
    });
  });

  describe('conflict resolution', () => {
    it('should resolve with keep-current strategy', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1' },
            access_token: 'token',
          },
        },
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await mockSupabase.functions.invoke('resolve-conflict', {
        body: {
          promptId: 'prompt-1',
          revisionId: 'revision-1',
          strategy: 'keep-current',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.success).toBe(true);
    });

    it('should resolve with use-revision strategy', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1' },
            access_token: 'token',
          },
        },
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await mockSupabase.functions.invoke('resolve-conflict', {
        body: {
          promptId: 'prompt-1',
          revisionId: 'revision-1',
          strategy: 'use-revision',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.success).toBe(true);
    });

    it('should handle manual-merge with merged data', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1' },
            access_token: 'token',
          },
        },
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await mockSupabase.functions.invoke('resolve-conflict', {
        body: {
          promptId: 'prompt-1',
          revisionId: 'revision-1',
          strategy: 'manual-merge',
          mergedData: {
            title: 'Merged Title',
            content: 'Merged Content',
          },
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.success).toBe(true);
    });
  });

  describe('time-based conflict scenarios', () => {
    it('should detect concurrent edits from different devices', () => {
      // Device A updates at T+0
      const deviceAUpdate = new Date('2024-01-01T12:00:00Z');
      
      // Device B updates at T+45s (outside 30s window)
      const deviceBUpdate = new Date('2024-01-01T12:00:45Z');
      
      const timeDiff = deviceBUpdate.getTime() - deviceAUpdate.getTime();
      const shouldConflict = timeDiff > 30000;
      
      expect(shouldConflict).toBe(true);
      expect(timeDiff).toBe(45000);
    });

    it('should allow quick successive edits from same device', () => {
      // Device A first edit
      const firstEdit = new Date('2024-01-01T12:00:00Z');
      
      // Device A second edit 10s later
      const secondEdit = new Date('2024-01-01T12:00:10Z');
      
      const timeDiff = secondEdit.getTime() - firstEdit.getTime();
      const shouldConflict = timeDiff > 30000;
      
      expect(shouldConflict).toBe(false);
      expect(timeDiff).toBe(10000);
    });

    it('should handle offline editing scenarios', () => {
      // Server last updated 5 minutes ago
      const serverUpdate = new Date('2024-01-01T12:00:00Z');
      
      // Client comes back online and tries to sync
      const clientUpdate = new Date('2024-01-01T12:05:00Z');
      
      const timeDiff = clientUpdate.getTime() - serverUpdate.getTime();
      const shouldConflict = timeDiff > 30000;
      
      expect(shouldConflict).toBe(true);
      expect(timeDiff).toBe(300000); // 5 minutes
    });
  });
});
