import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConflictBadgeProps {
  onClick: () => void;
}

export function ConflictBadge({ onClick }: ConflictBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="destructive"
            className="cursor-pointer gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <AlertTriangle className="h-3 w-3" />
            Conflict
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>This prompt has a sync conflict. Click to resolve.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
