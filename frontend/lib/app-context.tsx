"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type ConnectionStatus = "live" | "offline" | "connecting";

interface AppContextValue {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;
  criticalAlertCount: number;
  setCriticalAlertCount: (n: number) => void;
}

const AppContext = createContext<AppContextValue>({
  connectionStatus: "connecting",
  setConnectionStatus: () => {},
  criticalAlertCount: 0,
  setCriticalAlertCount: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);

  return (
    <AppContext.Provider
      value={{ connectionStatus, setConnectionStatus, criticalAlertCount, setCriticalAlertCount }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
