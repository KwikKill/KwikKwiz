import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Always include Discord provider
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: { params: { scope: "identify" } },
    }),
    // Add credentials provider only in development
    ...(process.env.NODE_ENV === "development" ? [
      CredentialsProvider({
        id: "dev-login",
        name: "Development Login",
        credentials: {
          username: { label: "Username", type: "text", placeholder: "Enter any username" },
          isAdmin: { label: "Admin", type: "checkbox" }
        },
        async authorize(credentials) {
          if (!credentials?.username) {
            return null;
          }

          // In development, create or find user by username
          let user = await prisma.user.findFirst({
            where: { name: credentials.username }
          });

          if (!user) {
            // Create new user for development
            user = await prisma.user.create({
              data: {
                name: credentials.username,
                email: `${credentials.username.toLowerCase()}@dev.local`,
                isAdmin: credentials.isAdmin === "true",
              }
            });
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        }
      })
    ] : [])
  ],
  callbacks: {
    async session({ session, token, user }) {
      // Add the user ID to the session
      if (session.user) {
        session.user.id = token.id as string;

        if (process.env.NODE_ENV === "development" && token.provider === "dev-login") {
          // For development login, get user info from database
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });

          if (dbUser) {
            session.user.userId = dbUser.id;
            session.user.isAdmin = dbUser.isAdmin;
          }
        } else {
          // Discord provider logic
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
      }
      return session;
    },
    async signIn({ profile, user, account }) {
      if (process.env.NODE_ENV === "development" && account?.provider === "dev-login") {
        // Always allow development login
        return true;
      }

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
    async jwt({ token, account, profile, user }) {
      // Add the access token and user ID to the JWT token
      if (account && profile) {
        token.accessToken = account.access_token;
        token.provider = account.provider;

        if ("id" in profile) {
          token.id = (profile as { id: string }).id;
        }
      }

      if (account && user && account.provider === "dev-login") {
        // For development login, use the user ID directly
        token.id = user.id;
        token.provider = "dev-login";
      }

      // Check if the user is an admin
      if (process.env.NODE_ENV === "development" && token.provider === "dev-login") {
        // For development, get admin status from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        token.isAdmin = dbUser?.isAdmin || false;
      } else {
        // For Discord, check environment variable
        const adminIds = process.env.ADMIN_IDS?.split(",") || [];
        token.isAdmin = adminIds.includes(token.id as string);
      }

      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
