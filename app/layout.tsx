import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "./providers";
import { Sidebar } from "../components/Sidebar";
import { TopNav } from "../components/TopNav";

export const metadata: Metadata = {
  title: "Vegas POS - Owner's Dashboard",
  description: "Mobile-responsive dashboard for Vegas POS system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen w-full flex bg-background text-foreground transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <TopNav />
            <main className="flex-1 overflow-y-auto scroll-smooth">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
