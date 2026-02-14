import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import FocusModeToggle from "@/components/FocusModeToggle";
import SplashScreen from "@/components/SplashScreen";
import LayoutClient from "./LayoutClient";

export const metadata = {
  title: "TraderMind - 交易者之心",
  description: "专业交易日志与 AI 交易教练终端"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-100 safe-area-inset">
        <SplashScreen />
        <div className="mx-auto max-w-md px-4 py-4 pb-safe">
          <header className="mb-4 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 py-3 -mx-4 px-4 gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight">
                TraderMind
              </h1>
              <p className="mt-0.5 text-xs text-slate-400">
                交易者之心
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <FocusModeToggle />
              <Link
                href="/settings"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                title="设置"
              >
                <Settings className="h-5 w-5" />
              </Link>
            </div>
          </header>
          <LayoutClient />
          {children}
        </div>
      </body>
    </html>
  );
}
