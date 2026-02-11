"use client";

import { SessionProvider } from "next-auth/react";
import { UserProvider } from "@/contexts/UserContext";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <UserProvider>
        {children}
      </UserProvider>
    </SessionProvider>
  );
}
