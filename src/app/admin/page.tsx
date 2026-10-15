import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Administración · Cooperaciones",
};

export default function AdminPage() {
  return <AdminPanel />;
}
