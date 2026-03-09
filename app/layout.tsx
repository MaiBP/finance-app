// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Finance App",
  description: "Personal & Household Finance Manager",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
