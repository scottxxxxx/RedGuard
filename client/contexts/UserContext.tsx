"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface UserContextType {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const userId = session?.user?.email || 'anonymous';
  const userName = session?.user?.name || null;
  const userEmail = session?.user?.email || null;
  const userImage = session?.user?.image || null;
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  return (
    <UserContext.Provider value={{
      userId,
      userName,
      userEmail,
      userImage,
      isLoading,
      isAuthenticated
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
