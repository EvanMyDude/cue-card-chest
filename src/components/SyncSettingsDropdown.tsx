import { useRef } from 'react';
import { Download, Upload, CloudOff, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Prompt } from '@/types/prompt';
import { exportPromptsToJSON, importPromptsFromJSON, dedupeByChecksum } from '@/utils/jsonExport';
import { toast } from 'sonner';

interface SyncSettingsDropdownProps {
  prompts: Prompt[];
  onImport: (newPrompts: Prompt[]) => void;
  onDisconnectSync: () => void;
  syncEnabled: boolean;
}

export function SyncSettingsDropdown({
  prompts,
  onImport,
  onDisconnectSync,
  syncEnabled,
}: SyncSettingsDropdownProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (prompts.length === 0) {
      toast.info('No prompts to export');
      return;
    }
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
      const { prompts: imported, errors } = await importPromptsFromJSON(file);
      
      if (errors.length > 0) {
        errors.forEach(err => toast.error(err));
      }

      if (imported.length === 0) {
        toast.error('No valid prompts found in file');
        return;
      }

      // Deduplicate against existing prompts
      const { toAdd, duplicates } = dedupeByChecksum(prompts, imported);

      if (toAdd.length === 0) {
        toast.info('All prompts already exist (no duplicates imported)');
        return;
      }

      onImport(toAdd);
      
      let message = `Imported ${toAdd.length} prompt${toAdd.length > 1 ? 's' : ''}`;
      if (duplicates > 0) {
        message += ` (${duplicates} duplicate${duplicates > 1 ? 's' : ''} skipped)`;
      }
      toast.success(message);
    } catch (err) {
      toast.error('Failed to import file');
    }

    // Reset input
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            Import from JSON
          </DropdownMenuItem>
          
          {syncEnabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDisconnectSync}
                className="text-destructive focus:text-destructive"
              >
                <CloudOff className="mr-2 h-4 w-4" />
                Disconnect sync
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
