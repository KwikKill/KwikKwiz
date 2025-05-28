'use client';

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { SocketProvider } from "@/components/socket-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <SocketProvider>
          {children}
        </SocketProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}