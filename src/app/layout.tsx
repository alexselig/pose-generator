import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/AppHeader";
import { ToastProvider } from "@/components/Toast";
import { SidebarProvider } from "@/components/SidebarNav";

export const metadata: Metadata = {
  title: "PoseForge - Illustrated Character Poses for Godot",
  description: "Generate consistent, static pose sets for illustrated video game characters. Export Godot-ready assets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full overflow-hidden">
        <ToastProvider>
          <SidebarProvider>
            <div className="flex h-full">
              <Sidebar />
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <AppHeader />
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
              </div>
            </div>
          </SidebarProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
