import { create } from "zustand";
import { persist } from "zustand/middleware";

type EntityType = {
    type: "1" | "2";
};

type Actions = {
    setType: (type: EntityType["type"]) => void;
};

export const entityTypeStore = create<EntityType & Actions>()(
    persist(
        (set) => ({
            type: "1",
            setType: (type: EntityType["type"]) => set({ type }),
        }),
        {
            name: "entity-type-storage", // unique name for localStorage key
        }
    )
);

// Custom hooks
export const useSetEntityType = () => entityTypeStore.getState().setType;
export const useEntityType = () => entityTypeStore((state) => state.type);