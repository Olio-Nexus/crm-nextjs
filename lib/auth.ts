import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          parsed.data.password,
          user.password
        );
        if (!passwordMatch) return null;

        return {
          id:    String(user.id),
          name:  user.name,
          email: user.email,
          role:  user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fresh sign-in — trust what authorize() just returned.
        token.id   = user.id;
        token.role = (user as any).role;
        return token;
      }
      // Every later request: re-check the account against the DB. Because
      // sessions are stateless JWTs, this is what makes account changes take
      // effect on an *active* session — deleting a user invalidates their
      // session on their next request (return null), and a role change is
      // picked up live.
      if (token.id) {
        const u = await prisma.user.findUnique({
          where: { id: Number(token.id) },
          select: { role: true },
        });
        if (!u) return null; // account gone → sign them out
        token.role = u.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id        = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages:   { signIn: "/login" },
  session: { strategy: "jwt" },
});