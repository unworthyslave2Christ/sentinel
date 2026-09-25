import "./globals.css";

export const metadata = {
  title: "Sentinel — Organizational Compliance Workforce",
  description: "Evidence-backed organizational compliance workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
