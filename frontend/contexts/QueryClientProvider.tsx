"use client"

import React, { ReactNode } from 'react'

import {
    QueryClient,
    QueryClientProvider as TQueryClientProvider,
} from '@tanstack/react-query'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
        },
    },
})

type Props = {
    children: ReactNode
}

const QueryClientProvider = ({ children }: Props) => {
    return (
        <TQueryClientProvider client={queryClient}>{children}</TQueryClientProvider>
    )
}

export default QueryClientProvider