"use client";
import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';

interface NextThemesProviderProps {
  readonly children: ReactNode;
}

export default function NextThemesProvider({ children }: NextThemesProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={["light", "dark"]}
      storageKey="ts-theme"
    >
      {children}
    </ThemeProvider>
  );
}
