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
    async session({ session, user }) {
      // Add the user ID to the session
      if (session.user) {
        session.user.id = user.id;
        
        // Find the user in the database to check if they're an admin
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        
        // Add isAdmin to the session
        session.user.isAdmin = dbUser?.isAdmin || false;
      }
      return session;
    },
    async signIn({ profile, user }) {
      if (profile && "id" in profile) {
        const discordId = profile.id as string;
        
        // Check if the Discord ID is in the admin list
        const adminIds = process.env.ADMIN_IDS?.split(",") || [];
        const isAdmin = adminIds.includes(discordId);
        
        // Update the user with Discord ID and admin status
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            discordId,
            isAdmin 
          },
        });
      }
      
      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};