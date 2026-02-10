"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface UserContextType {
  userId: string;
  userName: string | null;
  setUserName: (name: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserNameState] = useState<string | null>(null);

  useEffect(() => {
    // Get or create user ID from localStorage
    let storedUserId = localStorage.getItem('redguard_user_id');

    if (!storedUserId) {
      storedUserId = uuidv4();
      localStorage.setItem('redguard_user_id', storedUserId);
    }

    setUserId(storedUserId);

    // Get username if set
    const storedName = localStorage.getItem('redguard_user_name');
    if (storedName) {
      setUserNameState(storedName);
    }
  }, []);

  const setUserName = (name: string) => {
    setUserNameState(name);
    localStorage.setItem('redguard_user_name', name);
  };

  return (
    <UserContext.Provider value={{ userId, userName, setUserName }}>
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
