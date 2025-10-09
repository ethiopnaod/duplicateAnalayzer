import { create } from "zustand";

export const sidebarStore = create<{
    isOpen: boolean,
    toggle: () => void
}>()((set) => ({
    isOpen: false,
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
