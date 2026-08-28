import type { Metadata } from "next";

import { AuthProvider } from "@/components/AuthProvider";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETI Content",
  description: "Content management for etiedu.org",
  // the same mark the public site uses
  icons: { icon: "/eti-only-logo.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
