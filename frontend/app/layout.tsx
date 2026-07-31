import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AppProvider } from "@/lib/app-context";
import { ToastProvider } from "@/lib/toast-context";
import ToastContainer from "@/components/ui/Toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SolarShield — Predictive Maintenance",
  description: "Real-time solar panel monitoring and predictive maintenance dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0f1117] text-white antialiased`}>
        <AppProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
            <ToastContainer />
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}

