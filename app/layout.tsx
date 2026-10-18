import type { ReactNode } from "react";

export const metadata = { title: "WeRoad search assistant" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
