import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cooperaciones · Convivencia 1° Medio",
  description:
    "Listado de cooperaciones para la convivencia de 1° Medio por el Día del Profesor.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
