import React, { createContext, useContext, useState, ReactNode } from "react";

interface ActiveContextType {
  activeId: string | number | null;
  setActiveId: (id: string | number | null) => void;
}

const ActiveContext = createContext<ActiveContextType | undefined>(undefined);

export function ActiveProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | number | null>(null);

  return (
    <ActiveContext.Provider value={{ activeId, setActiveId }}>
      {children}
    </ActiveContext.Provider>
  );
}

export function useActive() {
  const context = useContext(ActiveContext);
  if (context === undefined) {
    throw new Error("useActive must be used within an ActiveProvider");
  }
  return context;
}
