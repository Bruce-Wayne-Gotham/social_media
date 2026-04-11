import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "SocialHub",
  description: "Publish to multiple social platforms from one dashboard."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

