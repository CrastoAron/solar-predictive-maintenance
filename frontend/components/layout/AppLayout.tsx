"use client";

import Sidebar from "./Sidebar";
import Header from "./Header";

interface AppLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppLayout({ title, description, actions, children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 min-w-0 transition-colors">
        <Header title={title} description={description} actions={actions} />
        <div className="animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
