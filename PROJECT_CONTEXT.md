# Project Context

## Objetivo

Coordinar las cooperaciones para **Convivencia 1° Medio — Día del Profesor · lunes 19 de octubre**. La aplicación prioriza una experiencia rápida en celular y evita reservas duplicadas bajo concurrencia.

## Inventario canónico

| Posiciones | Categoría | Cupos | Unidad por cupo |
|---|---|---:|---|
| 1–8 | Leches | 8 | 1 pack de 6 leches individuales |
| 9–16 | Jugos | 8 | 1 pack de 6 jugos individuales |
| 17–24 | Sándwiches | 8 | 6 sándwiches |
| 25–32 | Magdalenas | 8 | 1 bolsa de 6 magdalenas (queques) |
| 33–40 | Compotas | 8 | 1 pack de 6 compotas de fruta |
| 41–45 | Galletas | 5 | 2 paquetes de galletas grandes |

Total: **45 cupos**.

## Arquitectura

- `src/components/CooperationBoard.tsx`: flujo público, reserva, confirmación y suscripción Realtime.
- `src/components/AdminPanel.tsx`: gestión protegida y exportación CSV.
- `src/lib/cooperations.ts`: contenido y tipos canónicos del listado.
- `src/lib/supabase/`: clientes de navegador y servidor.
- `src/app/api/admin/`: sesión administrativa y mutaciones privadas.
- `supabase/migrations/`: esquema, carga inicial, RLS y funciones transaccionales.

## Reglas críticas

- El nombre del alumno es público una vez confirmada la cooperación.
- Un clic reserva un cupo durante cinco minutos.
- `reserve_cooperation_item` bloquea la fila antes de decidir quién obtiene el cupo.
- `confirm_cooperations` valida y confirma todos los cupos juntos; si uno expiró, no confirma ninguno.
- El navegador nunca puede leer los hashes de las sesiones de reserva.
- No habilitar escrituras directas para los roles `anon` o `authenticated`.

## Verificación mínima

1. Dos sesiones intentan reservar el mismo cupo; una sola obtiene `ok: true`.
2. Un cupo expirado vuelve a estar disponible.
3. Una misma sesión confirma varios cupos con un único nombre.
4. Los demás navegadores reciben el cambio por Realtime o por el sondeo de respaldo.
5. El panel administrativo puede renombrar, liberar y exportar cooperaciones.
6. La interfaz funciona a 320 px y con teclado.
