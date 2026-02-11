"use client";

import { signIn, signOut } from "next-auth/react";
import { useUser } from "@/contexts/UserContext";

export default function AuthButton() {
  const { isAuthenticated, isLoading, userName, userEmail, userImage } = useUser();

  // Don't show anything when loading or not authenticated
  // The SignInGate component handles unauthenticated state
  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {userImage && (
          <img
            src={userImage}
            alt={userName || "User"}
            className="w-8 h-8 rounded-full"
          />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {userName}
          </span>
          <span className="text-xs text-[var(--foreground-muted)]">
            {userEmail}
          </span>
        </div>
      </div>
      <button
        onClick={() => signOut()}
        className="px-3 py-1.5 text-sm font-medium text-[var(--foreground-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--border-focus)] rounded-lg transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
