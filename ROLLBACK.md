# Rollback and Safety System

## Overview

The rollback system provides a comprehensive data recovery mechanism with multiple safety gates to protect user data during migrations, imports, and destructive operations.

## Features

### 1. Rollback Script (`src/lib/rollback.ts`)

Core utilities for data recovery:

- **Backup Parsing**: Load and validate backup files
- **localStorage Restoration**: Restore prompts to localStorage
- **Supabase Cleanup**: Clear cloud data with proper cascading
- **IndexedDB Cleanup**: Clear local database
- **Audit Logging**: Track all rollback operations with timestamps

### 2. Safety Components

#### RollbackDialog (`src/components/RollbackDialog.tsx`)
- File upload for backup selection
- Configurable recovery options
- Destructive operation confirmation (requires typing "ROLLBACK")
- Progress feedback and error handling

#### SyncStatusBanner (`src/components/SyncStatusBanner.tsx`)
- Persistent header banner showing sync state
- Real-time status updates (idle, syncing, offline, error, conflicts)
- Conflict count and resolution actions
- Parked items indicator with retry option

#### ConfirmationDialog (`src/components/ConfirmationDialog.tsx`)
- Generic confirmation for destructive operations
- Visual warning indicators
- Customizable messaging

### 3. Hooks

#### useRollback (`src/hooks/useRollback.ts`)
- Manages rollback state and operations
- Toast notifications for user feedback
- Audit log access
- Backup file parsing

## Usage

### Rollback Dialog

```tsx
import { RollbackDialog } from '@/components/RollbackDialog';
import { useState } from 'react';

function MyComponent() {
  const [showRollback, setShowRollback] = useState(false);

  return (
    <>
      <button onClick={() => setShowRollback(true)}>
        Rollback to Backup
      </button>
      
      <RollbackDialog
        open={showRollback}
        onOpenChange={setShowRollback}
        onComplete={() => {
          console.log('Rollback completed');
        }}
      />
    </>
  );
}
```

### Sync Status Banner

```tsx
import { SyncStatusBanner } from '@/components/SyncStatusBanner';
import { usePrompts } from '@/hooks/usePrompts';

function Header() {
  const { syncStatus, conflicts } = usePrompts();

  return (
    <header>
      <SyncStatusBanner
        status={syncStatus}
        conflictCount={conflicts.length}
        onResolveConflicts={() => {
          // Open conflict resolution UI
        }}
      />
      {/* Rest of header */}
    </header>
  );
}
```

### Programmatic Rollback

```tsx
import { useRollback } from '@/hooks/useRollback';
import { useState } from 'react';

function AdminPanel() {
  const { rollback, parseBackup, isProcessing } = useRollback();
  const [backup, setBackup] = useState(null);

  const handleFileUpload = async (file: File) => {
    const parsed = await parseBackup(file);
    setBackup(parsed);
  };

  const handleRollback = async () => {
    if (!backup) return;

    const result = await rollback(backup, {
      clearSupabase: true,
      clearIndexedDB: true,
      restoreToLocalStorage: true,
    });

    if (result.success) {
      console.log('Rollback successful');
      window.location.reload();
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleFileUpload(e.target.files[0])} />
      <button onClick={handleRollback} disabled={isProcessing}>
        Execute Rollback
      </button>
    </div>
  );
}
```

## Safety Gates

### 1. Confirmation Requirements

All destructive operations require explicit user confirmation:

- **Text Confirmation**: User must type "ROLLBACK" for destructive operations
- **Checkbox Confirmation**: User must check acknowledgment boxes
- **Modal Warnings**: Clear visual warnings with AlertTriangle icons

### 2. Auto-Backup Points

System automatically creates backups before:

- First sync operation
- Import operations that may overwrite data
- Destructive migrations

### 3. Audit Logging

All rollback operations are logged with:

```typescript
{
  timestamp: "2025-01-15T10:30:00Z",
  action: "rollback" | "backup" | "clear",
  details: {
    restoredCount: 42,
    clearedSupabase: true,
    clearedIndexedDB: false,
    backupDate: "2025-01-14T08:00:00Z"
  }
}
```

Access logs via:
```typescript
import { getRollbackLogs } from '@/lib/rollback';

const logs = getRollbackLogs();
console.log(logs); // Last 50 events
```

## Rollback Options

### `RollbackOptions` Interface

```typescript
interface RollbackOptions {
  clearSupabase?: boolean;        // Delete all cloud data
  clearIndexedDB?: boolean;       // Delete local database
  restoreToLocalStorage?: boolean; // Restore to localStorage
}
```

### Common Scenarios

#### 1. Full Reset to Backup
```typescript
{
  clearSupabase: true,
  clearIndexedDB: true,
  restoreToLocalStorage: true
}
```
**Use case**: Complete rollback to previous state

#### 2. Local Recovery Only
```typescript
{
  clearSupabase: false,
  clearIndexedDB: false,
  restoreToLocalStorage: true
}
```
**Use case**: Restore localStorage without affecting sync

#### 3. Cloud Cleanup Only
```typescript
{
  clearSupabase: true,
  clearIndexedDB: false,
  restoreToLocalStorage: false
}
```
**Use case**: Remove all cloud data but keep local state

## Error Handling

All rollback operations include comprehensive error handling:

1. **Validation Errors**: Invalid backup format, missing data
2. **Permission Errors**: User not authenticated
3. **Database Errors**: Foreign key constraints, network issues
4. **Partial Success**: Some operations succeed, others fail

Example error handling:

```typescript
const result = await executeRollback(backup, options);

if (!result.success) {
  console.error('Rollback failed:', result.error);
  
  // Check what succeeded
  if (result.clearedSupabase) {
    console.log('Cloud data was cleared');
  }
  
  if (result.restoredCount > 0) {
    console.log(`Restored ${result.restoredCount} items before failure`);
  }
}
```

## Best Practices

### 1. Always Backup Before Destructive Operations
```typescript
import { exportLocalStorageBackup, downloadBackup } from '@/lib/backup';
import { logRollbackEvent } from '@/lib/rollback';

// Before destructive operation
const backup = await exportLocalStorageBackup();
if (backup) {
  downloadBackup(backup);
  logRollbackEvent('backup', {
    promptCount: backup.prompts.length,
    reason: 'pre-migration-safety',
  });
}
```

### 2. Show Status During Operations
```tsx
const [status, setStatus] = useState('idle');

const performDestructiveOp = async () => {
  setStatus('backing-up');
  await createBackup();
  
  setStatus('processing');
  await performOperation();
  
  setStatus('complete');
};

return <SyncStatusBanner status={status} />;
```

### 3. Provide Clear User Feedback
```typescript
import { useToast } from '@/hooks/use-toast';

const { toast } = useToast();

// Success
toast({
  title: 'Rollback Complete',
  description: `Restored ${count} prompts successfully`,
});

// Error
toast({
  title: 'Rollback Failed',
  description: error.message,
  variant: 'destructive',
});
```

### 4. Log All Critical Operations
```typescript
import { logRollbackEvent } from '@/lib/rollback';

// After any destructive operation
logRollbackEvent('clear', {
  target: 'supabase',
  itemCount: count,
  reason: 'user-requested',
});
```

## Integration with Migration Flow

The rollback system integrates seamlessly with the migration flow:

1. **Pre-Migration**: Auto-backup localStorage data
2. **During Import**: Option to rollback if issues occur
3. **Post-Migration**: Backup created before clearing localStorage
4. **Conflict Resolution**: Rollback to pre-conflict state if needed

See `MIGRATION_INTEGRATION_GUIDE.md` for migration-specific rollback scenarios.

## Testing Rollback

### Manual Testing Checklist

1. **Basic Rollback**
   - [ ] Upload valid backup file
   - [ ] Select restore options
   - [ ] Execute rollback
   - [ ] Verify data restored

2. **Destructive Operations**
   - [ ] Attempt destructive op without confirmation
   - [ ] Verify confirmation required
   - [ ] Type incorrect confirmation text
   - [ ] Type correct confirmation and execute

3. **Error Scenarios**
   - [ ] Upload invalid backup file
   - [ ] Test with unauthenticated user
   - [ ] Simulate network failure during clear

4. **Audit Logging**
   - [ ] Perform multiple rollback operations
   - [ ] Verify all logged correctly
   - [ ] Check log retention (max 50 events)

### Automated Tests

```typescript
import { describe, it, expect } from 'vitest';
import { executeRollback, parseBackupFile } from '@/lib/rollback';

describe('Rollback System', () => {
  it('should parse valid backup files', async () => {
    const backup = await parseBackupFile(validBackupJson);
    expect(backup.prompts).toBeDefined();
    expect(backup.manifest).toBeDefined();
  });

  it('should reject invalid backup files', async () => {
    await expect(parseBackupFile('invalid')).rejects.toThrow();
  });

  it('should restore to localStorage', async () => {
    const result = await executeRollback(mockBackup, {
      restoreToLocalStorage: true,
    });
    
    expect(result.success).toBe(true);
    expect(result.restoredCount).toBeGreaterThan(0);
  });
});
```

## Troubleshooting

### Common Issues

**Problem**: "Failed to clear cloud data"
- **Cause**: User not authenticated or network error
- **Solution**: Verify auth state and retry

**Problem**: "Invalid backup format"
- **Cause**: Corrupted or incompatible backup file
- **Solution**: Use backup created by same app version

**Problem**: Rollback succeeds but data not visible
- **Cause**: Page needs refresh to load restored data
- **Solution**: System auto-reloads after successful rollback

**Problem**: Partial success in rollback
- **Cause**: Some operations failed mid-execution
- **Solution**: Check result object for details, retry failed parts

## Security Considerations

1. **Authentication**: All Supabase operations require valid user session
2. **RLS Policies**: Rollback respects row-level security
3. **Audit Trail**: All operations logged for accountability
4. **Confirmation Gates**: Multiple checks prevent accidental data loss
5. **No Silent Deletions**: All destructive ops require explicit user action

## Future Enhancements

- [ ] Scheduled auto-backups
- [ ] Cloud backup storage option
- [ ] Rollback preview before execution
- [ ] Incremental rollback (selective prompts)
- [ ] Rollback undo capability
- [ ] Email notifications for destructive operations

## Support

For issues or questions:
1. Check audit logs: `getRollbackLogs()`
2. Review TESTING.md for verification steps
3. Consult MIGRATION_INTEGRATION_GUIDE.md for migration-specific scenarios
