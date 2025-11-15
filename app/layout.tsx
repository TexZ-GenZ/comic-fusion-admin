import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComicFusion Admin Panel — Manage S3 Examples",
  description: "Admin panel for managing example images on ComicFusion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
