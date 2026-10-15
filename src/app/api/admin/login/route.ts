import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
  isAdminPasswordValid,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { password?: string }
    | null;

  if (!body?.password || !isAdminPasswordValid(body.password)) {
    return NextResponse.json(
      { message: "Contraseña incorrecta." },
      { status: 401 },
    );
  }

  const session = createAdminSession();
  if (!session) {
    return NextResponse.json(
      { message: "El acceso administrativo no está configurado." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, session.value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });

  return response;
}

