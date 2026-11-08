import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Where's Waldo",
  description: "A photo tagging game. Find every character as fast as you can.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="py-4 border-t border-t-[#333] text-center">
          Made by <a className="underline" href="https://arnplsrz.com" target="_blank" rel="noopener noreferrer">arnplsrz</a>
        </footer>
      </body>
    </html>
  );
}
