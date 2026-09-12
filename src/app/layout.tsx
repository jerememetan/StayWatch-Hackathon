import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StayWatch | Review workspace",
  description: "Safety-first potential indicator review for property operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
