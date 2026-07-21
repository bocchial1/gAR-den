import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeGardenUser } from "@/lib/auth-credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
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
});
