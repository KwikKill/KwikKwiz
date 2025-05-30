import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: { params: { scope: "identify" } },
    }),
  ],
  callbacks: {
    async session({ session, token, user }) {
      // Add the user ID to the session
      if (session.user) {
        session.user.id = token.id as string;

        // Find the user in the database to check if they're an admin
        const dbUser = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider: "discord", providerAccountId: token.id as string } },
        });

        // Check if the Discord ID is in the admin list
        const adminIds = process.env.ADMIN_IDS?.split(",") || [];
        const isAdmin = adminIds.includes(token.id as string);

        // Get UserId
        if (dbUser) {
          session.user.userId = dbUser.userId;
        }

        // Add isAdmin to the session
        session.user.isAdmin = isAdmin;
      }
      return session;
    },
    async signIn({ profile, user }) {
      if (profile && "id" in profile) {
        const discordId = profile.id as string;

        // Check if the Discord ID is in the admin list
        const authorizedIds = process.env.AUTHORIZED_IDS?.split(",") || [];
        const isAuthorized = authorizedIds.includes(discordId);

        if (!isAuthorized) {
          // If the user is not authorized, prevent sign-in
          return false;
        }
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      // Add the access token and user ID to the JWT token
      if (account && profile) {
        token.accessToken = account.access_token
        if ("id" in profile) {
          token.id = (profile as { id: string }).id;
        }
      }

      // Check if the user is an admin
      const adminIds = process.env.ADMIN_IDS?.split(",") || [];
      token.isAdmin = adminIds.includes(token.id as string);

      return token
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
