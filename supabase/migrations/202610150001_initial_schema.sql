create extension if not exists pgcrypto with schema extensions;

create table public.cooperation_items (
  id smallint primary key,
  position smallint not null unique,
  category text not null check (
    category in ('leches', 'jugos', 'sandwiches', 'magdalenas', 'compotas', 'galletas')
  ),
  description text not null,
  status text not null default 'available' check (
    status in ('available', 'held', 'confirmed')
  ),
  student_name text check (
    student_name is null or char_length(student_name) between 2 and 80
  ),
  hold_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint cooperation_item_state_is_valid check (
    (status = 'available' and student_name is null and hold_expires_at is null)
    or (status = 'held' and student_name is null and hold_expires_at is not null)
    or (status = 'confirmed' and student_name is not null and hold_expires_at is null)
  )
);

create table public.cooperation_holds (
  item_id smallint primary key references public.cooperation_items(id) on delete cascade,
  token_hash bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cooperation_items enable row level security;
alter table public.cooperation_holds enable row level security;

create policy "Anyone can read cooperation availability"
on public.cooperation_items
for select
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select on public.cooperation_items to anon, authenticated;

insert into public.cooperation_items (id, position, category, description)
select number, number, 'leches', '1 pack de 6 leches individuales'
from generate_series(1, 8) as number;

insert into public.cooperation_items (id, position, category, description)
select number, number, 'jugos', '1 pack de 6 jugos individuales'
from generate_series(9, 16) as number;

insert into public.cooperation_items (id, position, category, description)
select number, number, 'sandwiches', '6 sándwiches'
from generate_series(17, 24) as number;

insert into public.cooperation_items (id, position, category, description)
select number, number, 'magdalenas', '1 bolsa de 6 magdalenas (queques)'
from generate_series(25, 32) as number;

insert into public.cooperation_items (id, position, category, description)
select number, number, 'compotas', '1 pack de 6 compotas de fruta'
from generate_series(33, 40) as number;

insert into public.cooperation_items (id, position, category, description)
select number, number, 'galletas', '2 paquetes de galletas grandes'
from generate_series(41, 45) as number;

create or replace function public.set_cooperation_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_cooperation_items_updated_at
before update on public.cooperation_items
for each row execute function public.set_cooperation_updated_at();

create trigger set_cooperation_holds_updated_at
before update on public.cooperation_holds
for each row execute function public.set_cooperation_updated_at();

create or replace function public.reserve_cooperation_item(
  p_item_id smallint,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.cooperation_items%rowtype;
  v_token_hash bytea;
  v_current_hash bytea;
  v_expires_at timestamptz := now() + interval '5 minutes';
begin
  if p_session_token is null or char_length(p_session_token) not between 16 and 200 then
    return jsonb_build_object('ok', false, 'message', 'La sesión no es válida. Recarga la página.');
  end if;

  v_token_hash := extensions.digest(p_session_token, 'sha256');

  select *
  into v_item
  from public.cooperation_items
  where id = p_item_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'El cupo no existe.');
  end if;

  if v_item.status = 'confirmed' then
    return jsonb_build_object('ok', false, 'message', 'Este cupo ya fue confirmado.');
  end if;

  if v_item.status = 'held' and v_item.hold_expires_at > now() then
    select token_hash
    into v_current_hash
    from public.cooperation_holds
    where item_id = p_item_id;

    if v_current_hash is null or v_current_hash <> v_token_hash then
      return jsonb_build_object(
        'ok', false,
        'message', 'Otro apoderado está eligiendo este cupo.'
      );
    end if;
  end if;

  insert into public.cooperation_holds (item_id, token_hash)
  values (p_item_id, v_token_hash)
  on conflict (item_id) do update
  set token_hash = excluded.token_hash,
      updated_at = now();

  update public.cooperation_items
  set status = 'held',
      student_name = null,
      hold_expires_at = v_expires_at
  where id = p_item_id;

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.release_cooperation_item(
  p_item_id smallint,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_token_hash bytea;
  v_current_hash bytea;
begin
  if p_session_token is null or char_length(p_session_token) not between 16 and 200 then
    return jsonb_build_object('ok', false, 'message', 'La sesión no es válida.');
  end if;

  v_token_hash := extensions.digest(p_session_token, 'sha256');

  select status
  into v_status
  from public.cooperation_items
  where id = p_item_id
  for update;

  if not found or v_status = 'confirmed' then
    return jsonb_build_object('ok', false, 'message', 'Este cupo no puede liberarse.');
  end if;

  select token_hash
  into v_current_hash
  from public.cooperation_holds
  where item_id = p_item_id
  for update;

  if v_current_hash is null or v_current_hash <> v_token_hash then
    return jsonb_build_object('ok', false, 'message', 'Esta reserva pertenece a otra sesión.');
  end if;

  delete from public.cooperation_holds where item_id = p_item_id;

  update public.cooperation_items
  set status = 'available',
      student_name = null,
      hold_expires_at = null
  where id = p_item_id;

  return jsonb_build_object('ok', true, 'item_id', p_item_id);
end;
$$;

create or replace function public.confirm_cooperations(
  p_item_ids smallint[],
  p_session_token text,
  p_student_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean_name text;
  v_token_hash bytea;
  v_distinct_count integer;
  v_owned_count integer;
begin
  v_clean_name := trim(regexp_replace(coalesce(p_student_name, ''), '\s+', ' ', 'g'));

  if char_length(v_clean_name) not between 2 and 80 then
    return jsonb_build_object('ok', false, 'message', 'Ingresa un nombre válido.');
  end if;

  if p_session_token is null or char_length(p_session_token) not between 16 and 200 then
    return jsonb_build_object('ok', false, 'message', 'La sesión no es válida. Recarga la página.');
  end if;

  if p_item_ids is null or cardinality(p_item_ids) not between 1 and 45 then
    return jsonb_build_object('ok', false, 'message', 'Selecciona al menos una cooperación.');
  end if;

  select count(distinct item_id)
  into v_distinct_count
  from unnest(p_item_ids) as item_id;

  if v_distinct_count <> cardinality(p_item_ids) then
    return jsonb_build_object('ok', false, 'message', 'La selección contiene cupos repetidos.');
  end if;

  perform id
  from public.cooperation_items
  where id = any(p_item_ids)
  order by id
  for update;

  v_token_hash := extensions.digest(p_session_token, 'sha256');

  select count(*)
  into v_owned_count
  from public.cooperation_items as item
  join public.cooperation_holds as hold on hold.item_id = item.id
  where item.id = any(p_item_ids)
    and item.status = 'held'
    and item.hold_expires_at > now()
    and hold.token_hash = v_token_hash;

  if v_owned_count <> cardinality(p_item_ids) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Uno de los cupos expiró o fue reservado por otra persona.'
    );
  end if;

  update public.cooperation_items
  set status = 'confirmed',
      student_name = v_clean_name,
      hold_expires_at = null
  where id = any(p_item_ids);

  delete from public.cooperation_holds
  where item_id = any(p_item_ids);

  return jsonb_build_object(
    'ok', true,
    'confirmed_count', cardinality(p_item_ids)
  );
end;
$$;

create or replace function public.expire_cooperation_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_count integer;
begin
  with expired_items as (
    delete from public.cooperation_holds as hold
    using public.cooperation_items as item
    where hold.item_id = item.id
      and item.status = 'held'
      and item.hold_expires_at <= now()
    returning hold.item_id
  )
  update public.cooperation_items
  set status = 'available',
      student_name = null,
      hold_expires_at = null
  where id in (select item_id from expired_items);

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

create or replace function public.admin_reset_cooperation(p_item_id smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform id
  from public.cooperation_items
  where id = p_item_id
  for update;

  if not found then
    return false;
  end if;

  delete from public.cooperation_holds where item_id = p_item_id;

  update public.cooperation_items
  set status = 'available',
      student_name = null,
      hold_expires_at = null
  where id = p_item_id;

  return true;
end;
$$;

revoke all on function public.reserve_cooperation_item(smallint, text) from public;
revoke all on function public.release_cooperation_item(smallint, text) from public;
revoke all on function public.confirm_cooperations(smallint[], text, text) from public;
revoke all on function public.expire_cooperation_holds() from public;
revoke all on function public.admin_reset_cooperation(smallint) from public;

grant execute on function public.reserve_cooperation_item(smallint, text) to anon, authenticated;
grant execute on function public.release_cooperation_item(smallint, text) to anon, authenticated;
grant execute on function public.confirm_cooperations(smallint[], text, text) to anon, authenticated;
grant execute on function public.expire_cooperation_holds() to anon, authenticated;
grant execute on function public.admin_reset_cooperation(smallint) to service_role;

alter publication supabase_realtime add table public.cooperation_items;
