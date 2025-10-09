import React from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

const Spinner: React.FC<SpinnerProps> = ({ size = "md" }) => {
  const sizeClasses =
    size === "sm"
      ? "h-4 w-4 border-[2px]"
      : size === "lg"
      ? "h-8 w-8 border-[3px]"
      : "h-5 w-5 border-[2.5px]";

  return (
    <div
      className={`inline-block ${sizeClasses} border-current border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
};

export default Spinner;
