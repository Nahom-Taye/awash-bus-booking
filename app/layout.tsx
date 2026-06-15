import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/app/providers";

export const metadata: Metadata = {
  title: "Awash Bus",
  description: "Book your bus tickets online with Awash Bus",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}