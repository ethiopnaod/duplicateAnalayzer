"use client"
import { cn } from "@/lib/utils"
import { AlertTriangle, X, RefreshCw, AlertCircle } from "lucide-react"


interface ErrorDisplayProps {
  message: string
  title?: string
  variant?: "default" | "compact" | "inline"
  severity?: "error" | "warning" | "critical"
  dismissible?: boolean
  onDismiss?: () => void
  onRetry?: () => void
  retryLabel?: string
  className?: string
  showIcon?: boolean
  fullWidth?: boolean
}

const ErrorDisplay = ({
  message,
  title,
  variant = "default",
  severity = "error",
  dismissible = false,
  onDismiss,
  onRetry,
  retryLabel = "Try again",
  className,
  showIcon = true,
  fullWidth = false,
}: ErrorDisplayProps) => {
  const severityConfig = {
    error: {
      bgColor: "bg-red-50 dark:bg-red-950/20",
      borderColor: "border-red-200 dark:border-red-800",
      textColor: "text-red-800 dark:text-red-200",
      iconColor: "text-red-500 dark:text-red-400",
      icon: AlertCircle,
    },
    warning: {
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      borderColor: "border-amber-200 dark:border-amber-800",
      textColor: "text-amber-800 dark:text-amber-200",
      iconColor: "text-amber-500 dark:text-amber-400",
      icon: AlertTriangle,
    },
    critical: {
      bgColor: "bg-red-100 dark:bg-red-950/30",
      borderColor: "border-red-300 dark:border-red-700",
      textColor: "text-red-900 dark:text-red-100",
      iconColor: "text-red-600 dark:text-red-300",
      icon: AlertTriangle,
    },
  }

  const config = severityConfig[severity]
  const IconComponent = config.icon

  const baseClasses = cn(
    "rounded-lg border transition-all duration-200",
    config.bgColor,
    config.borderColor,
    fullWidth ? "w-full" : "max-w-2xl",
    className,
  )

  if (variant === "compact") {
    return (
      <div className={cn(baseClasses, "p-3")}>
        <div className="flex items-center gap-2">
          {showIcon && <IconComponent className={cn("h-4 w-4 flex-shrink-0", config.iconColor)} />}
          <p className={cn("text-sm font-medium", config.textColor)}>{message}</p>
          {dismissible && onDismiss && (
            <button
              onClick={onDismiss}
              className={cn(
                "ml-auto flex-shrink-0 rounded-sm p-1 hover:bg-black/5 dark:hover:bg-white/5",
                config.textColor,
              )}
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2">
        {showIcon && <IconComponent className={cn("h-4 w-4 flex-shrink-0", config.iconColor)} />}
        <span className={cn("text-sm", config.textColor)}>{message}</span>
      </div>
    )
  }

  return (
    <div className={cn(baseClasses, "p-4 shadow-sm")}>
      <div className="flex items-start gap-3">
        {showIcon && (
          <div className="flex-shrink-0">
            <IconComponent className={cn("h-5 w-5", config.iconColor)} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {title && <h3 className={cn("text-sm font-semibold mb-1", config.textColor)}>{title}</h3>}
          <p className={cn("text-sm leading-relaxed", config.textColor)}>{message}</p>

          {onRetry && (
            <button
              onClick={onRetry}
              className={cn(
                "mt-3 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
                "border border-current/20 hover:bg-current/5 transition-colors",
                config.textColor,
              )}
            >
              <RefreshCw className="h-3 w-3" />
              {retryLabel}
            </button>
          )}
        </div>

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className={cn(
              "flex-shrink-0 rounded-sm p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
              config.textColor,
            )}
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default ErrorDisplay
export type { ErrorDisplayProps }
