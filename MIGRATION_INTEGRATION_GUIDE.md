# Migration Integration Guide - Phase 4

## Overview
This guide shows how to integrate the migration system into your UI.

## Hook Usage: `useMigration()`

```typescript
import { useMigration } from '@/hooks/useMigration';

function MigrationFlow() {
  const migration = useMigration();
  
  // migration.state.phase: Current phase
  // migration.state.backup: Backup data if available
  // migration.state.importProgress: Real-time import progress
  // migration.state.importResult: Final import result
  
  // Actions:
  // - migration.checkMigrationNeeded()
  // - migration.downloadBackupFile()
  // - migration.registerUserDevice(deviceName)
  // - migration.importBackup()
  // - migration.skipMigration()
}
```

---

## UI Flow: Step-by-Step

### Step 1: Check Migration Needed (Auto)

The hook auto-checks on mount when user logs in.

```typescript
useEffect(() => {
  if (migration.state.phase === 'backup-ready') {
    // Show migration dialog
    setShowMigrationDialog(true);
  }
}, [migration.state.phase]);
```

---

### Step 2: Backup Dialog

When `phase === 'backup-ready'`:

```tsx
{migration.state.phase === 'backup-ready' && (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Backup Your Data</DialogTitle>
        <DialogDescription>
          We found {migration.state.backup?.manifest.totalPrompts} prompts in your browser.
          Download a backup before migrating to cloud storage.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This backup is your safety net. It contains:
            <ul className="mt-2 list-disc list-inside">
              <li>{migration.state.backup?.manifest.totalPrompts} prompts</li>
              <li>{migration.state.backup?.manifest.totalTags} tags</li>
              <li>Checksums for verification</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={() => migration.downloadBackupFile()}
          className="w-full"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Backup
        </Button>
        
        <Button 
          onClick={() => setShowDeviceRegistration(true)}
          variant="outline"
          className="w-full"
        >
          Continue to Import
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)}
```

---

### Step 3: Device Registration

```tsx
{showDeviceRegistration && (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Register This Device</DialogTitle>
        <DialogDescription>
          Give this device a name for sync tracking
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <Input
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="e.g., MacBook Pro, Work Laptop"
        />
        
        <Button 
          onClick={async () => {
            await migration.registerUserDevice(deviceName);
            setShowImportConfirmation(true);
          }}
          disabled={!deviceName.trim()}
        >
          Register Device
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)}
```

---

### Step 4: Import Confirmation

Before importing, show dry run results:

```tsx
{showImportConfirmation && (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Import Your Prompts?</DialogTitle>
        <DialogDescription>
          Ready to import {migration.state.backup?.manifest.totalPrompts} prompts
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>What will happen:</strong>
            <ul className="mt-2 list-disc list-inside">
              <li>Prompts will be uploaded to cloud storage</li>
              <li>Duplicates will be skipped automatically</li>
              <li>Your local backup remains safe</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              await migration.importBackup();
            }}
            className="flex-1"
          >
            Import Now
          </Button>
          
          <Button 
            onClick={() => migration.skipMigration()}
            variant="outline"
          >
            Skip
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
)}
```

---

### Step 5: Progress Display

While `phase === 'importing'`:

```tsx
{migration.state.phase === 'importing' && (
  <div className="space-y-4">
    <Progress value={
      (migration.state.importProgress?.current / 
       migration.state.importProgress?.total * 100) || 0
    } />
    
    <p className="text-sm text-muted-foreground">
      {migration.state.importProgress?.message}
    </p>
    
    <p className="text-xs">
      {migration.state.importProgress?.current} / {migration.state.importProgress?.total}
    </p>
  </div>
)}
```

---

### Step 6: Completion Summary

When `phase === 'complete'`:

```tsx
{migration.state.phase === 'complete' && migration.state.importResult && (
  <Alert>
    <CheckCircle className="h-4 w-4" />
    <AlertTitle>Import Complete!</AlertTitle>
    <AlertDescription>
      <ul className="mt-2 list-disc list-inside">
        <li>Imported: {migration.state.importResult.imported} prompts</li>
        <li>Skipped: {migration.state.importResult.skipped} duplicates</li>
        {migration.state.importResult.errors.length > 0 && (
          <li className="text-destructive">
            Errors: {migration.state.importResult.errors.length}
          </li>
        )}
      </ul>
    </AlertDescription>
  </Alert>
)}
```

---

## Error Handling

```tsx
{migration.state.phase === 'error' && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Migration Error</AlertTitle>
    <AlertDescription>
      {migration.state.error?.message}
    </AlertDescription>
  </Alert>
)}
```

---

## Complete Component Example

```tsx
import { useMigration } from '@/hooks/useMigration';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function MigrationDialog() {
  const migration = useMigration();
  const [deviceName, setDeviceName] = useState('');

  const handleRegisterAndImport = async () => {
    try {
      // Register device
      await migration.registerUserDevice(deviceName);
      toast.success('Device registered');
      
      // Import backup
      await migration.importBackup();
      toast.success('Import complete');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (migration.state.phase !== 'backup-ready') {
    return null;
  }

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome! Let's Migrate Your Data</DialogTitle>
        </DialogHeader>
        
        {/* Backup step */}
        <Alert>
          <AlertDescription>
            {migration.state.backup?.manifest.totalPrompts} prompts found
          </AlertDescription>
        </Alert>
        
        <Button onClick={migration.downloadBackupFile}>
          <Download className="mr-2 h-4 w-4" />
          Download Backup
        </Button>
        
        {/* Device registration */}
        <Input
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="Device name"
        />
        
        {/* Import progress */}
        {migration.state.phase === 'importing' && (
          <Progress value={
            (migration.state.importProgress?.current / 
             migration.state.importProgress?.total * 100) || 0
          } />
        )}
        
        {/* Action buttons */}
        <div className="flex gap-2">
          <Button onClick={handleRegisterAndImport}>
            Import to Cloud
          </Button>
          <Button variant="outline" onClick={migration.skipMigration}>
            Skip
          </Button>
        </div>
        
        {/* Result */}
        {migration.state.phase === 'complete' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Imported {migration.state.importResult?.imported} prompts
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Testing Checklist

- [ ] Backup downloads with correct filename
- [ ] Backup contains all localStorage prompts
- [ ] Device registration succeeds
- [ ] Import progress updates in real-time
- [ ] Duplicate prompts are skipped
- [ ] Import result shows correct counts
- [ ] Errors are displayed clearly
- [ ] Skip migration works without errors

---

## Next Phase

**Phase 5: Full UI Integration**
1. Add MigrationDialog to App.tsx
2. Style with design system
3. Add loading states
4. Test offline behavior
5. Handle edge cases
