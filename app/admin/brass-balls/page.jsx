"use client";
import AdminGuard from "@/components/AdminGuard";
import BrassBallsAdminClient from "@/components/admin/brass-balls/BrassBallsAdminClient";
export default function AdminBrassBallsPage() { return <AdminGuard><BrassBallsAdminClient /></AdminGuard>; }
