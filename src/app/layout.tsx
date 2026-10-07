import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "My Projects — Shaxsiy ish maydoni",
  description: "Loyihalar, g‘oyalar va havolalaringiz bir joyda.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
