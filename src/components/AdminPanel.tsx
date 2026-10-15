"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CooperationItem } from "@/lib/cooperations";

type ViewState = "loading" | "login" | "ready";

export function AdminPanel() {
  const [view, setView] = useState<ViewState>("loading");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<CooperationItem[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadItems = useCallback(async () => {
    const response = await fetch("/api/admin/items", { cache: "no-store" });

    if (response.status === 401) {
      setView("login");
      return;
    }

    const result = (await response.json()) as {
      items?: CooperationItem[];
      message?: string;
    };

    if (!response.ok || !result.items) {
      setMessage(result.message || "No se pudo cargar el listado.");
      setView("login");
      return;
    }

    setItems(result.items);
    setNames(
      Object.fromEntries(
        result.items.map((item) => [item.id, item.student_name || ""]),
      ),
    );
    setView("ready");
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadItems());
  }, [loadItems]);

  const confirmedItems = useMemo(
    () => items.filter((item) => item.status === "confirmed"),
    [items],
  );

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      setMessage(result.message || "No se pudo iniciar sesión.");
      return;
    }

    setPassword("");
    await loadItems();
  };

  const updateItem = async (
    id: number,
    action: "reset" | "rename",
  ) => {
    if (
      action === "reset" &&
      !window.confirm("¿Seguro que quieres liberar esta cooperación?")
    ) {
      return;
    }

    setBusyId(id);
    setMessage("");
    const response = await fetch("/api/admin/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, studentName: names[id] }),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      setMessage(result.message || "No se pudo actualizar el cupo.");
      setBusyId(null);
      return;
    }

    await loadItems();
    setBusyId(null);
    setMessage(action === "reset" ? "Cupo liberado." : "Nombre actualizado.");
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setItems([]);
    setView("login");
  };

  const exportCsv = () => {
    const escape = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["N°", "Categoría", "Cooperación", "Alumno"],
      ...confirmedItems.map((item) => [
        item.position,
        item.category,
        item.description,
        item.student_name || "",
      ]),
    ];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cooperaciones-1ro-medio.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (view === "loading") {
    return <div className="admin-loading">Cargando administración…</div>;
  }

  if (view === "login") {
    return (
      <main className="admin-login-shell">
        <form className="admin-login-card" onSubmit={login}>
          <span className="admin-mark" aria-hidden="true">✦</span>
          <p className="admin-kicker">Convivencia 1° Medio</p>
          <h1>Administración</h1>
          <p>Ingresa la contraseña para corregir o exportar cooperaciones.</p>
          <label htmlFor="admin-password">Contraseña</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit">Ingresar</button>
          {message && <div className="admin-message error">{message}</div>}
          <Link href="/">Volver al listado</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">Convivencia 1° Medio</p>
          <h1>Cooperaciones confirmadas</h1>
          <p>{confirmedItems.length} de 45 cupos registrados</p>
        </div>
        <div className="admin-actions">
          <button type="button" onClick={exportCsv} disabled={confirmedItems.length === 0}>
            Exportar CSV
          </button>
          <button type="button" className="secondary" onClick={() => void logout()}>
            Salir
          </button>
        </div>
      </header>

      {message && <div className="admin-message">{message}</div>}

      <section className="admin-list" aria-label="Cooperaciones confirmadas">
        {confirmedItems.length === 0 ? (
          <div className="admin-empty">Todavía no hay cooperaciones confirmadas.</div>
        ) : (
          confirmedItems.map((item) => (
            <article className="admin-row" key={item.id}>
              <div className="admin-item-number">{item.position}</div>
              <div className="admin-item-copy">
                <strong>{item.description}</strong>
                <span>{item.category}</span>
              </div>
              <input
                aria-label={`Nombre del alumno para el cupo ${item.position}`}
                value={names[item.id] || ""}
                maxLength={80}
                onChange={(event) =>
                  setNames((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
              />
              <div className="admin-row-actions">
                <button
                  type="button"
                  onClick={() => void updateItem(item.id, "rename")}
                  disabled={busyId !== null || names[item.id] === item.student_name}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void updateItem(item.id, "reset")}
                  disabled={busyId !== null}
                >
                  Liberar
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
