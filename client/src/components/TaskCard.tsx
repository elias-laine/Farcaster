import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Heart, Repeat2, UserPlus, Loader2, ExternalLink, MessageSquare } from "lucide-react";
import type { Task, TaskType, AdminTask } from "@shared/schema";

interface TaskCardProps {
  type: TaskType;
  task: Task | null;
  isLocked: boolean;
  isVerifying: boolean;
  onVerify: () => void;
  onOpenAction: () => void;
  taskConfig?: AdminTask;
  targetUsername?: string;
}

const defaultTaskConfig: Record<TaskType, {
  title: string;
  description: string;
  actionText: string;
  icon: typeof Heart;
}> = {
  like: {
    title: "Like the Cast",
    description: "Like our announcement cast to show your support",
    actionText: "Open & Like",
    icon: Heart,
  },
  recast: {
    title: "Recast",
    description: "Recast to spread the word to your followers",
    actionText: "Open & Recast",
    icon: Repeat2,
  },
  follow: {
    title: "Follow Account",
    description: "Follow us to stay updated with future campaigns",
    actionText: "Follow",
    icon: UserPlus,
  },
  cast: {
    title: "Post a Cast",
    description: "Post a cast to participate",
    actionText: "Post",
    icon: MessageSquare,
  },
};

export function TaskCard({
  type,
  task,
  isLocked,
  isVerifying,
  onVerify,
  onOpenAction,
  taskConfig,
  targetUsername,
}: TaskCardProps) {
  // Use custom config if provided, otherwise use defaults
  const defaultConfig = defaultTaskConfig[type];
  const title = taskConfig?.title || defaultConfig.title;
  const Icon = defaultConfig.icon;
  const isVerified = task?.status === "verified";
  
  let description = defaultConfig.description;
  if (type === "follow" && targetUsername) {
    description = `Follow @${targetUsername} to stay updated`;
  } else if (type === "cast" && taskConfig?.options?.castText) {
    description = taskConfig.options.castText;
  } else if (taskConfig?.options?.castText) {
    description = taskConfig.options.castText;
  }

  return (
    <Card 
      className={`border transition-colors ${
        isVerified 
          ? "border-success/30 bg-success/5" 
          : isLocked 
            ? "opacity-60" 
            : "border-border"
      }`}
      data-testid={`card-task-${type}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div 
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isVerified 
                ? "bg-success text-success-foreground" 
                : isLocked 
                  ? "bg-muted text-muted-foreground" 
                  : "bg-primary/10 text-primary"
            }`}
          >
            {isVerified ? (
              <Check className="h-5 w-5" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">
                {title}
              </h3>
              {isVerified && (
                <Badge 
                  variant="outline" 
                  className="bg-success/10 text-success border-success/30 text-xs"
                  data-testid={`badge-verified-${type}`}
                >
                  Verified
                </Badge>
              )}
              {isLocked && !isVerified && (
                <Badge 
                  variant="outline" 
                  className="text-muted-foreground text-xs"
                  data-testid={`badge-locked-${type}`}
                >
                  Locked
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
            
            {task?.verifiedAt && (
              <p className="mt-2 text-xs text-muted-foreground font-mono">
                Verified at {new Date(task.verifiedAt * 1000).toLocaleString()}
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-2 shrink-0">
            {!isVerified && !isLocked && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenAction}
                  className="gap-1"
                  data-testid={`button-open-${type}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {defaultConfig.actionText}
                </Button>
                <Button
                  size="sm"
                  onClick={onVerify}
                  disabled={isVerifying}
                  data-testid={`button-verify-${type}`}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Verifying...
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
