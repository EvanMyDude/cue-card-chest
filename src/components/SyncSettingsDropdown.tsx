import { useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Settings, Download, Upload, LogOut, Monitor, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { exportPromptsToJSON, importPromptsFromJSON, mergeImportedPrompts } from '@/utils/jsonExport';
import type { Prompt } from '@/types/prompt';

interface SyncSettingsDropdownProps {
  prompts: Prompt[];
  onImport: (prompts: Prompt[]) => void;
  onSignOut: () => void;
  onManualSync?: () => Promise<void>;
  deviceName: string;
  userEmail?: string;
}

export function SyncSettingsDropdown({
  prompts,
  onImport,
  onSignOut,
  onManualSync,
  deviceName,
  userEmail,
}: SyncSettingsDropdownProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!onManualSync) return;
    setIsSyncing(true);
    try {
      await onManualSync();
      toast.success('Sync complete');
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    exportPromptsToJSON(prompts);
    toast.success(`Exported ${prompts.length} prompts`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importPromptsFromJSON(file);
      const { merged, newCount, duplicateCount } = mergeImportedPrompts(prompts, imported);
      
      onImport(merged);
      
      if (newCount > 0) {
        toast.success(`Imported ${newCount} new prompts${duplicateCount > 0 ? `, ${duplicateCount} duplicates skipped` : ''}`);
      } else if (duplicateCount > 0) {
        toast.info(`All ${duplicateCount} prompts were duplicates`);
      } else {
        toast.info('No prompts found in file');
      }
    } catch (error) {
      toast.error('Failed to import prompts. Make sure the file is valid JSON.');
    }

    // Reset input
    e.target.value = '';
  };

  const handleSignOut = async () => {
    await onSignOut();
    toast.success('Signed out successfully');
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {userEmail && (
            <>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userEmail}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Monitor className="h-3 w-3" />
                    {deviceName}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}

          {userEmail && onManualSync && (
            <DropdownMenuItem onClick={handleManualSync} disabled={isSyncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
          </DropdownMenuItem>

          {userEmail && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
