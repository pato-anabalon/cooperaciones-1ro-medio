import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  isAdminSessionValid,
} from "@/lib/admin-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function isAuthorized() {
  const cookieStore = await cookies();
  return isAdminSessionValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return NextResponse.json(
      { message: "Supabase no está configurado." },
      { status: 503 },
    );
  }

  const { data, error } = await client
    .from("cooperation_items")
    .select(
      "id, position, category, description, status, student_name, hold_expires_at, updated_at",
    )
    .order("position");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

export async function PATCH(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: number; action?: "reset" | "rename"; studentName?: string }
    | null;

  if (!body?.id || !Number.isInteger(body.id)) {
    return NextResponse.json({ message: "Cupo inválido." }, { status: 400 });
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return NextResponse.json(
      { message: "Supabase no está configurado." },
      { status: 503 },
    );
  }

  if (body.action === "reset") {
    const { data, error } = await client.rpc("admin_reset_cooperation", {
      p_item_id: body.id,
    });

    if (error || !data) {
      return NextResponse.json(
        { message: error?.message || "No se pudo liberar el cupo." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "rename") {
    const studentName = body.studentName?.trim().replace(/\s+/g, " ") || "";
    if (studentName.length < 2 || studentName.length > 80) {
      return NextResponse.json(
        { message: "El nombre debe tener entre 2 y 80 caracteres." },
        { status: 400 },
      );
    }

    const { error } = await client
      .from("cooperation_items")
      .update({ student_name: studentName })
      .eq("id", body.id)
      .eq("status", "confirmed");

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Acción inválida." }, { status: 400 });
}
