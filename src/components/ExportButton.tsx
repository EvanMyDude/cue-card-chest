import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportPromptsToPDF } from '@/utils/pdfExport';
import type { Prompt } from '@/types/prompt';
import { toast } from 'sonner';

interface ExportButtonProps {
  prompts: Prompt[];
}

export const ExportButton = ({ prompts }: ExportButtonProps) => {
  const handleExport = () => {
    if (prompts.length === 0) {
      toast.error('No prompts to export');
      return;
    }
    
    try {
      exportPromptsToPDF(prompts);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Export as PDF
    </Button>
  );
};
