import "./globals.css";

export const metadata = {
  title: "SocialHub",
  description: "Publish to multiple social platforms from one dashboard."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

