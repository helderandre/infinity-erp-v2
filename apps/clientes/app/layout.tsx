import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infinity Clientes",
  description: "Portal de clientes Infinity Group.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
