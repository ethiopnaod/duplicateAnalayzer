import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

// Define spinner styles using cva
const spinnerVariants = cva(
    "animate-spin text-muted-foreground flex justify-center items-center",
    {
        variants: {
            size: {
                sm: "w-4 h-4",
                md: "w-6 h-6",
                lg: "w-8 h-8",
            },
            color: {
                primary: "text-primary",
                secondary: "text-secondary-foreground",
                accent: "text-accent-foreground",
                muted: "text-muted-foreground",
            },
        },
        defaultVariants: {
            size: "md",
            color: "muted",
        },
    }
);

// Props interface
interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
    className?: string;
    label?: string;
}

export function Spinner({ size, color, className, label = "Loading..." }: SpinnerProps) {
    return (
        <div className="flex flex-col items-center gap-2">
            <Loader2 className={spinnerVariants({ size, color, className })} aria-hidden="true" />
            {label && (
                <p className="text-sm text-muted-foreground" role="status">
                    {label}
                </p>
            )}
        </div>
    );
}