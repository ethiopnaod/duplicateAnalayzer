"use client"

import { motion } from "motion/react"

import { ArrowLeft, Building2, GitMerge, Sparkles } from "lucide-react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import DuplicateComparison from "./_components/DuplicateComparison"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import ErrorDisplay from "@/components/custom/ErrorDisplay"
import { Spinner } from "@/components/custom/Spinner"
import { PageHeader } from "@/components/custom/PageHeader"
import { sidebarStore } from "@/stores/sidebar"
import { Entity } from "@/types"
import { toast } from "sonner"
// Removed all mock hooks - using real backend data
import MergeDialog from "./_components/MergeDialog"

export default function DuplicateDetailPage() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const entityName = decodeURI(params["name"] as string)
    const entityType = searchParams.get("type") || "1"
    const searchTerm = searchParams.get("search") || ""

    // Real backend data - these will be replaced with actual API calls
    const [entities, setEntities] = useState<Entity[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)

    const { isOpen } = sidebarStore()

    // Fetch real data from backend
    useEffect(() => {
        const fetchEntityDetails = async () => {
            try {
                setIsLoading(true)
                // This will call your backend API to get entity details
                const response = await fetch(`/api/duplicates/details?name=${encodeURIComponent(entityName)}&type=${entityType}`)
                if (!response.ok) throw new Error('Failed to fetch entity details')
                const data = await response.json()
                setEntities(data.entities || [])
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data')
            } finally {
                setIsLoading(false)
            }
        }
        
        if (entityName) {
            fetchEntityDetails()
        }
    }, [entityName, entityType])

    // Removed mock AI analysis redirect

    // --- Loading State ---
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="flex flex-col items-center justify-center h-screen space-y-8">
                    <div className="relative">
                        <Spinner size="lg" label="" />
                    </div>
                    <div className="text-center space-y-3 max-w-md px-6">
                        <h2 className="text-2xl font-semibold text-foreground">Analyzing Duplicates</h2>
                        <p className="text-lg text-muted-foreground">
                            Deep scanning for{" "}
                            <span className="font-medium px-2 py-1 bg-muted rounded-md border">
                                {entityName}
                            </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Processing entity relationships and detecting conflicts...
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // --- Error State ---
    if (error) {
        return (
            <div className="flex justify-center items-center min-h-[80vh] ">
                <ErrorDisplay
                    title="Failed to Load Data"
                    message={error}
                    className="w-full"
                />
            </div>
        )
    }

    // --- Empty State ---
    if (entities.length === 0) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="flex justify-center items-center min-h-[70vh]">
                    <Card className="p-10 text-center max-w-lg shadow-md border">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                                <Building2 className="w-10 h-10 text-muted-foreground" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold mb-3 text-foreground">No Duplicates Found</h3>
                        <p className="text-muted-foreground mb-6 leading-relaxed">
                            No entities match the name{" "}
                            <span className="font-medium px-2 py-1 bg-muted rounded border">
                                {entityName}
                            </span>
                            .<br />
                            The system found no potential duplicates to analyze.
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                            className="gap-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Search
                        </Button>
                    </Card>
                </div>
            </div>
        )
    }

    // --- Main Page ---
    return (
        <main className="min-h-screen bg-background">
            <PageHeader
                onBack={true}
                showBack
                title="Duplicate Analysis"
                description={`Review and resolve conflicting entries for: ${entityName}`}
                actions={
                    <div className="isolate relative hidden md:flex gap-2">
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() => setIsMergeDialogOpen(true)}
                            className="gap-2 rounded-sm"
                        >
                            Manual Merge
                        </Button>
                        {/* Sleek floating container with smooth entry */}
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4, ease: 'backOut' }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Button
                                size="lg"
                                disabled={isLoading}
                                onClick={async () => {
                                    if (!entities.length) {
                                        console.warn('No entities to analyze');
                                        return;
                                    }
                                    // Real AI analysis - call backend
                                    try {
                                        const response = await fetch('/api/duplicates/analyze', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ entities, entityType })
                                        });
                                        if (response.ok) {
                                            router.push("/dashboard/duplicates/analyze");
                                        } else {
                                            toast.error('Failed to start AI analysis');
                                        }
                                    } catch (error) {
                                        toast.error('Failed to start AI analysis');
                                    }
                                }}
                                className="group relative bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary-dark text-primary-foreground gap-3 px-8 py-4 shadow-lg shadow-primary/20 font-medium transition-all duration-300 hover:shadow-xl hover:scale-105 rounded-sm flex items-center"
                            >
                                {/* Animated Icon with lift effect */}
                                <motion.div
                                    animate={
                                        isLoading
                                            ? {}
                                            : {
                                                y: [-2, 0, -2],
                                            }
                                    }
                                    transition={{
                                        y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
                                    }}
                                    className="flex-shrink-0"
                                >
                                    {isLoading ? (
                                        <Spinner label="" size="sm" />
                                    ) : (
                                        <GitMerge className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
                                    )}
                                </motion.div>

                                <span className="transition-colors duration-300">
                                    {isLoading ? 'Analyzing...' : 'Analyze With AI'}
                                </span>

                                {/* Sparkle accent (optional fun touch) */}
                                <motion.span
                                    initial={{ scale: 1, rotate: 0 }}
                                    animate={{ scale: 1.1, rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}
                                    className="absolute -right-2 -top-2 z-[99]"
                                >
                                    <Sparkles className="h-3 w-3 text-primary" />
                                </motion.span>

                                <motion.span
                                    initial={{ scale: 1, rotate: 0 }}
                                    animate={{ scale: 1.1, rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}
                                    className="absolute -left-2 -bottom-2 z-[99]"
                                >
                                    <Sparkles className="h-3 w-3 text-primary" />
                                </motion.span>
                            </Button>
                        </motion.div>
                    </div>
                }
            />

            <section className="mx-auto bg-neutral-50 py-6">
                <div className="fixed bottom-4 right-4 isolate block md:hidden">
                    <div className="mb-2 flex justify-end">
                        <Button size="lg" variant="outline" className="rounded-sm" onClick={() => setIsMergeDialogOpen(true)}>
                            Manual Merge
                        </Button>
                    </div>
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, ease: 'backOut' }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Button
                            size="lg"
                            disabled={isLoading}
                            onClick={async () => {
                                if (!entities.length) {
                                    console.warn('No entities to analyze');
                                    return;
                                }
                                // Real AI analysis - call backend
                                try {
                                    const response = await fetch('/api/duplicates/analyze', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ entities, entityType })
                                    });
                                    if (response.ok) {
                                        router.push("/dashboard/duplicates/analyze");
                                    } else {
                                        toast.error('Failed to start AI analysis');
                                    }
                                } catch (error) {
                                    toast.error('Failed to start AI analysis');
                                }
                            }}
                            className="group relative bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary-dark text-primary-foreground gap-3 px-8 py-4 shadow-lg shadow-primary/20 font-medium transition-all duration-300 hover:shadow-xl hover:scale-105 rounded-sm flex items-center"
                        >
                            {/* Animated Icon with lift effect */}
                            <motion.div
                                animate={
                                    isLoading
                                        ? {}
                                        : {
                                            y: [-2, 0, -2],
                                        }
                                }
                                transition={{
                                    y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
                                }}
                                className="flex-shrink-0"
                            >
                                {isLoading ? (
                                    <Spinner label="" size="sm" />
                                ) : (
                                    <GitMerge className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
                                )}
                            </motion.div>

                            <span className="transition-colors duration-300">
                                {isLoading ? 'Analyzing...' : 'Analyze With AI'}
                            </span>

                            {/* Sparkle accent (optional fun touch) */}
                            <motion.span
                                initial={{ scale: 1, rotate: 0 }}
                                animate={{ scale: 1.1, rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}
                                className="absolute -right-2 -top-2 z-[99]"
                            >
                                <Sparkles className="h-3 w-3 text-primary" />
                            </motion.span>

                            <motion.span
                                initial={{ scale: 1, rotate: 0 }}
                                animate={{ scale: 1.1, rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}
                                className="absolute -left-2 -bottom-2 z-[99]"
                            >
                                <Sparkles className="h-3 w-3 text-primary" />
                            </motion.span>
                        </Button>
                    </motion.div>
                </div>



                {/* Duplicate Comparison Section */}
                <section
                    className="h-[calc(100vh-6rem)] overflow-auto pl-4 pr-6"
                    // style={{
                    //     width: isOpen ? "calc(100vw - 330px)" : "calc(100vw - 120px)"
                    // }}
                >
                    <DuplicateComparison entities={entities} searchTerm={searchTerm} />
                </section>
            </section>
            <MergeDialog 
                open={isMergeDialogOpen} 
                onOpenChange={setIsMergeDialogOpen} 
                entities={[]} 
                onConfirm={(mergeName) => {
                    console.log('Merge confirmed:', mergeName);
                    setIsMergeDialogOpen(false);
                }}
            />
        </main>
    )
}