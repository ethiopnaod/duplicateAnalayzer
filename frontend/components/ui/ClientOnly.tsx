"use client"

import { useHydration } from "@/hooks/useHydration"
import { ReactNode } from "react"

interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Component that only renders its children after hydration
 * Prevents hydration mismatches caused by browser extensions or client-only features
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isHydrated = useHydration()

  if (!isHydrated) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
