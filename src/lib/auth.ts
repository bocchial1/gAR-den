import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeGardenUser } from "@/lib/auth-credentials";

export const authCallbacks: NonNullable<NextAuthConfig["callbacks"]> = {
  async jwt({ token, user }) {
    if (user?.id) {
      token.sub = user.id;
    }

    return token;
  },
  async session({ session, token }) {
    if (session.user && token.sub) {
      session.user.id = token.sub;
    }

    return session;
  },
};

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: authCallbacks,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      authorize: async (credentials) =>
        authorizeGardenUser({
          email:
            typeof credentials.email === "string"
              ? credentials.email
              : undefined,
          password:
            typeof credentials.password === "string"
              ? credentials.password
              : undefined,
        }),
    }),
  ],
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getSessionUserId() {
  return (await auth())?.user?.id ?? null;
}
