import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

interface ProgressIndicatorProps {
  completedTasks: number;
  totalTasks: number;
}

export function ProgressIndicator({ completedTasks, totalTasks }: ProgressIndicatorProps) {
  const percentage = (completedTasks / totalTasks) * 100;
  const isComplete = completedTasks === totalTasks;

  return (
    <div className="mb-8" data-testid="progress-indicator">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            Task Progress
          </span>
          {isComplete && (
            <CheckCircle2 className="h-4 w-4 text-success" />
          )}
        </div>
        <span 
          className={`text-sm font-mono ${
            isComplete ? "text-success" : "text-muted-foreground"
          }`}
          data-testid="text-progress-count"
        >
          {completedTasks} of {totalTasks} completed
        </span>
      </div>
      <Progress 
        value={percentage} 
        className="h-2"
        data-testid="progress-bar"
      />
    </div>
  );
}
