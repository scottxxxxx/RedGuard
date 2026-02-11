import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Add user ID (email) to session
      if (session.user && token.email) {
        session.user.id = token.email;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      // Persist email in token
      if (account && profile) {
        token.email = profile.email;
      }
      return token;
    },
  },
  pages: {
    signIn: "/", // Redirect to home page for sign in
  },
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
