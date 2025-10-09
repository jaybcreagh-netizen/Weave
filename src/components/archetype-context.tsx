import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { type Archetype } from "./types";

// The context will now hold the actual Archetype to show, or null
interface ArchetypeContextType {
  modalArchetype: Archetype | null;
  setModalArchetype: (archetype: Archetype | null) => void;
}

const ArchetypeContext = createContext<
  ArchetypeContextType | undefined
>(undefined);

export function ArchetypeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [modalArchetype, setModalArchetype] =
    useState<Archetype | null>(null);

  return (
    <ArchetypeContext.Provider
      value={{ modalArchetype, setModalArchetype }}
    >
      {children}
    </ArchetypeContext.Provider>
  );
}

// Renamed for clarity
export function useArchetypeModal() {
  const context = useContext(ArchetypeContext);
  if (context === undefined) {
    throw new Error(
      "useArchetypeModal must be used within an ArchetypeProvider",
    );
  }
  return context;
}