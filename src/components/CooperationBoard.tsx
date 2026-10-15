"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import {
  categories,
  type CooperationItem,
  createInitialItems,
  EVENT_SUBTITLE,
  EVENT_TITLE,
  TOTAL_ITEMS,
} from "@/lib/cooperations";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const SESSION_KEY = "convivencia-session-token";
const NAME_KEY = "convivencia-student-name";
const SELECTION_KEY = "convivencia-selected-items";

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

function isExpired(item: CooperationItem, now: number) {
  return Boolean(
    item.status === "held" &&
      item.hold_expires_at &&
      new Date(item.hold_expires_at).getTime() <= now,
  );
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function CooperationBoard() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const [items, setItems] = useState<CooperationItem[]>(createInitialItems);
  const [studentName, setStudentName] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [restored, setRestored] = useState(false);
  const [loading, setLoading] = useState(configured && !demoMode);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [now, setNow] = useState(0);

  const showNotice = useCallback((nextNotice: Notice) => {
    setNotice(nextNotice);
    window.setTimeout(() => setNotice(null), 5200);
  }, []);

  const loadItems = useCallback(async () => {
    if (demoMode) {
      setLoading(false);
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setLoading(false);
      return;
    }

    await client.rpc("expire_cooperation_holds");
    const { data, error } = await client
      .from("cooperation_items")
      .select(
        "id, position, category, description, status, student_name, hold_expires_at, updated_at",
      )
      .order("position");

    if (error) {
      setLoading(false);
      showNotice({
        tone: "error",
        message: "No pudimos actualizar el listado. Intentaremos nuevamente.",
      });
      return;
    }

    setItems((data ?? []) as CooperationItem[]);
    setLoading(false);
  }, [demoMode, showNotice]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const storedToken = window.localStorage.getItem(SESSION_KEY);
      const token = storedToken || window.crypto.randomUUID();
      const storedName = window.localStorage.getItem(NAME_KEY) || "";
      const storedSelection = window.localStorage.getItem(SELECTION_KEY);

      if (!storedToken) {
        window.localStorage.setItem(SESSION_KEY, token);
      }

      setSessionToken(token);
      setStudentName(storedName);

      if (storedSelection) {
        try {
          const parsed = JSON.parse(storedSelection) as number[];
          setSelectedIds(new Set(parsed.filter(Number.isInteger)));
        } catch {
          window.localStorage.removeItem(SELECTION_KEY);
        }
      }

      setRestored(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(NAME_KEY, studentName);
  }, [restored, studentName]);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(
      SELECTION_KEY,
      JSON.stringify(Array.from(selectedIds)),
    );
  }, [restored, selectedIds]);

  useEffect(() => {
    queueMicrotask(() => void loadItems());

    if (demoMode || !configured) return;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    const channel = client
      .channel("cooperation-items-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cooperation_items",
        },
        () => void loadItems(),
      )
      .subscribe();

    const fallbackRefresh = window.setInterval(() => void loadItems(), 12000);

    return () => {
      window.clearInterval(fallbackRefresh);
      void client.removeChannel(channel);
    };
  }, [configured, demoMode, loadItems]);

  useEffect(() => {
    const tick = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      setSelectedIds((current) => {
        const expiredIds = items
          .filter((item) => current.has(item.id) && isExpired(item, nextNow))
          .map((item) => item.id);

        if (expiredIds.length === 0) return current;

        const next = new Set(current);
        expiredIds.forEach((id) => next.delete(id));
        return next;
      });
    };
    const kickoff = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [items]);

  const confirmedCount = items.filter(
    (item) => item.status === "confirmed",
  ).length;
  const availableCount = items.filter(
    (item) => item.status === "available" || isExpired(item, now),
  ).length;
  const progress = Math.round((confirmedCount / TOTAL_ITEMS) * 100);

  const ownExpiry = useMemo(() => {
    const expiries = items
      .filter((item) => selectedIds.has(item.id) && item.hold_expires_at)
      .map((item) => new Date(item.hold_expires_at as string).getTime());

    return expiries.length > 0 ? Math.min(...expiries) : null;
  }, [items, selectedIds]);

  const toggleItem = async (item: CooperationItem) => {
    if (busyId !== null || confirming || !sessionToken) return;

    const selected = selectedIds.has(item.id);

    if (!selected && studentName.trim().length < 2) {
      document.getElementById("student-name")?.focus();
      showNotice({
        tone: "info",
        message: "Primero escribe el nombre del alumno.",
      });
      return;
    }

    setBusyId(item.id);

    if (demoMode) {
      const baseNow = now || window.performance.timeOrigin + window.performance.now();
      const expiresAt = new Date(baseNow + 5 * 60 * 1000).toISOString();
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                status: selected ? "available" : "held",
                hold_expires_at: selected ? null : expiresAt,
              }
            : currentItem,
        ),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        if (selected) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      setBusyId(null);
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      showNotice({
        tone: "error",
        message: "La base de datos todavía no está configurada.",
      });
      setBusyId(null);
      return;
    }

    const procedure = selected
      ? "release_cooperation_item"
      : "reserve_cooperation_item";
    const { data, error } = await client.rpc(procedure, {
      p_item_id: item.id,
      p_session_token: sessionToken,
    });

    if (error || !data?.ok) {
      showNotice({
        tone: "error",
        message:
          data?.message ||
          "Ese cupo acaba de ser reservado. Por favor elige otro.",
      });
      await loadItems();
      setBusyId(null);
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    await loadItems();
    setBusyId(null);
  };

  const confirmSelection = async () => {
    const cleanName = studentName.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || selectedIds.size === 0 || !sessionToken) return;

    setConfirming(true);

    if (demoMode) {
      setItems((current) =>
        current.map((item) =>
          selectedIds.has(item.id)
            ? {
                ...item,
                status: "confirmed",
                student_name: cleanName,
                hold_expires_at: null,
              }
            : item,
        ),
      );
      const total = selectedIds.size;
      setSelectedIds(new Set());
      setConfirming(false);
      showNotice({
        tone: "success",
        message: `${total} ${total === 1 ? "cooperación registrada" : "cooperaciones registradas"}. ¡Muchas gracias!`,
      });
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setConfirming(false);
      return;
    }

    const total = selectedIds.size;
    const { data, error } = await client.rpc("confirm_cooperations", {
      p_item_ids: Array.from(selectedIds),
      p_session_token: sessionToken,
      p_student_name: cleanName,
    });

    if (error || !data?.ok) {
      showNotice({
        tone: "error",
        message:
          data?.message ||
          "No pudimos confirmar la selección. Revisa los cupos e intenta nuevamente.",
      });
      await loadItems();
      setConfirming(false);
      return;
    }

    setSelectedIds(new Set());
    await loadItems();
    setConfirming(false);
    showNotice({
      tone: "success",
      message: `${total} ${total === 1 ? "cooperación registrada" : "cooperaciones registradas"}. ¡Muchas gracias!`,
    });
  };

  return (
    <main>
      <section className="hero-shell">
        <div className="hero-decoration hero-decoration-one" aria-hidden="true" />
        <div className="hero-decoration hero-decoration-two" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-topline">
            <div className="eyebrow">Organización de curso</div>
            <Image
              className="school-logo"
              src="/logo.png"
              alt="Saint Louis School Chile"
              width={70}
              height={119}
              priority
            />
          </div>
          <h1>{EVENT_TITLE}</h1>
          <p className="event-date">{EVENT_SUBTITLE}</p>
          <p className="hero-copy">
            Elige una o más opciones para compartir. Cada cupo corresponde a
            una cooperación completa del listado.
          </p>

          <div
            className="progress-card"
            aria-label={`${confirmedCount} de ${TOTAL_ITEMS} cooperaciones confirmadas`}
          >
            <div className="progress-summary">
              <div>
                <strong>{confirmedCount}</strong>
                <span> confirmadas</span>
              </div>
              <div className="available-summary">{availableCount} disponibles</div>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-value" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell">
        {!configured && !demoMode && (
          <div className="configuration-notice" role="status">
            <strong>Configuración pendiente.</strong> El listado estará activo
            cuando se conecte la base de datos de Supabase.
          </div>
        )}

        <section className="name-card" aria-labelledby="student-name-heading">
          <div className="step-number" aria-hidden="true">1</div>
          <div className="name-content">
            <label id="student-name-heading" htmlFor="student-name">
              Nombre del alumno
            </label>
            <p>Lo escribes una sola vez para todas tus selecciones.</p>
            <input
              id="student-name"
              type="text"
              autoComplete="name"
              maxLength={80}
              placeholder="Ej. Martina González"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
            />
          </div>
        </section>

        <section className="list-heading" aria-labelledby="options-heading">
          <div className="step-number" aria-hidden="true">2</div>
          <div>
            <h2 id="options-heading">Elige cómo cooperar</h2>
            <p>Puedes seleccionar todos los cupos que quieras.</p>
          </div>
        </section>

        <div className="status-legend" aria-label="Estados de los cupos">
          <span><i className="legend-dot available" />Disponible</span>
          <span><i className="legend-dot held" />En proceso</span>
          <span><i className="legend-dot confirmed" />Confirmado</span>
        </div>

        {loading ? (
          <div className="loading-grid" aria-label="Cargando cooperaciones">
            {Array.from({ length: 12 }, (_, index) => (
              <div className="loading-card" key={index} />
            ))}
          </div>
        ) : (
          <div className="category-list">
            {categories.map((category) => {
              const categoryItems = items.filter(
                (item) => item.category === category.key,
              );
              const categoryConfirmed = categoryItems.filter(
                (item) => item.status === "confirmed",
              ).length;

              return (
                <section
                  className="category-card"
                  key={category.key}
                  style={{ "--category-accent": category.accent } as CSSProperties}
                  aria-labelledby={`category-${category.key}`}
                >
                  <header className="category-header">
                    <div className="category-icon" aria-hidden="true">
                      {category.icon}
                    </div>
                    <div>
                      <h3 id={`category-${category.key}`}>{category.name}</h3>
                      <p>{category.description}</p>
                    </div>
                    <span className="category-count">
                      {categoryConfirmed}/{category.count}
                    </span>
                  </header>

                  <div className="slots-grid">
                    {categoryItems.map((item, categoryIndex) => {
                      const expired = isExpired(item, now);
                      const selected = selectedIds.has(item.id) && !expired;
                      const effectiveStatus = expired ? "available" : item.status;
                      const heldByOther = effectiveStatus === "held" && !selected;
                      const unavailable = effectiveStatus === "confirmed" || heldByOther;
                      const disabled =
                        unavailable ||
                        busyId !== null ||
                        confirming ||
                        (!configured && !demoMode);

                      return (
                        <button
                          type="button"
                          className={`slot-card status-${effectiveStatus} ${selected ? "is-selected" : ""}`}
                          key={item.id}
                          disabled={disabled}
                          aria-pressed={selected}
                          onClick={() => void toggleItem(item)}
                        >
                          <span className="slot-topline">
                            <span>Cupo {categoryIndex + 1}</span>
                            <span className="slot-number">N° {item.position}</span>
                          </span>
                          <span className="slot-status">
                            {busyId === item.id
                              ? "Actualizando…"
                              : selected
                                ? "Reservado para ti"
                                : effectiveStatus === "confirmed"
                                  ? "Confirmado"
                                  : heldByOther
                                    ? "Alguien lo está eligiendo"
                                    : "Disponible"}
                          </span>
                          {effectiveStatus === "confirmed" && item.student_name && (
                            <span className="student-name">{item.student_name}</span>
                          )}
                          {selected && item.hold_expires_at && (
                            <span className="slot-expiry">
                              Confirma en {formatCountdown(new Date(item.hold_expires_at).getTime() - now)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <footer className="page-footer">
          <span aria-hidden="true">✦</span>
          Gracias por ayudarnos a preparar esta convivencia.
          <span aria-hidden="true">✦</span>
        </footer>
      </div>

      {selectedIds.size > 0 && (
        <aside className="selection-bar" aria-label="Resumen de selección">
          <div className="selection-bar-inner">
            <div>
              <strong>
                {selectedIds.size} {selectedIds.size === 1 ? "cooperación" : "cooperaciones"}
              </strong>
              {ownExpiry && (
                <span>Reserva por {formatCountdown(ownExpiry - now)}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void confirmSelection()}
              disabled={confirming || studentName.trim().length < 2}
            >
              {confirming ? "Confirmando…" : "Confirmar selección"}
            </button>
          </div>
        </aside>
      )}

      {notice && (
        <div className={`toast toast-${notice.tone}`} role="status" aria-live="polite">
          {notice.message}
        </div>
      )}
    </main>
  );
}
