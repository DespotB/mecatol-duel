-- Mecatol Duel, online play: one row per game and an append-only move log.
--
-- The engine is deterministic: the same seed and the same moves produce the same board. So the server never
-- stores a game state, only the log, and every client replays it. That keeps the payload tiny, makes a game
-- auditable, and turns joining, reconnecting and refreshing into the same operation.
--
-- There are no accounts. A browser mints a random player id and keeps it in localStorage; holding a seat
-- means the game row carries that id. Anyone with the link can read a game, which is intended: the duel is
-- open information and spectators are welcome. Writing is what is guarded.

create table if not exists public.games (
  code          text primary key check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  created_at    timestamptz not null default now(),
  seed          integer not null,
  minutes       integer not null check (minutes between 1 and 180),
  config        jsonb not null,
  seat0_player  text,
  seat1_player  text,
  -- the last move's timestamp, kept on the row so a client can charge the clock without scanning the log
  last_move_at  timestamptz not null default now()
);

create table if not exists public.moves (
  code  text not null references public.games (code) on delete cascade,
  n     integer not null check (n >= 0),
  seat  smallint not null check (seat in (0, 1)),
  move  jsonb not null,
  at    timestamptz not null default now(),
  primary key (code, n)
);

create index if not exists moves_code_n_idx on public.moves (code, n);

alter table public.games enable row level security;
alter table public.moves enable row level security;

-- Reading is open to anyone holding the link: the code is the capability.
drop policy if exists games_read on public.games;
create policy games_read on public.games for select using (true);
drop policy if exists moves_read on public.moves;
create policy moves_read on public.moves for select using (true);

-- Writing never goes through a direct insert. Both paths below are security definer functions, so the
-- tables themselves stay closed to the anonymous role and every write is checked.
revoke insert, update, delete on public.games from anon, authenticated;
revoke insert, update, delete on public.moves from anon, authenticated;

-- Create a game. The caller takes one seat; the other stays open for whoever opens the link.
create or replace function public.create_game(
  p_code text, p_seed integer, p_minutes integer, p_config jsonb, p_player text, p_seat smallint
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_seat not in (0, 1) then
    raise exception 'seat must be 0 or 1';
  end if;
  if coalesce(length(p_player), 0) < 8 then
    raise exception 'player id too short';
  end if;
  insert into public.games (code, seed, minutes, config, seat0_player, seat1_player)
  values (
    p_code, p_seed, p_minutes, p_config,
    case when p_seat = 0 then p_player end,
    case when p_seat = 1 then p_player end
  );
end;
$$;

-- Take the free seat. Idempotent for the player who already holds one, so a refresh is harmless.
create or replace function public.claim_seat(p_code text, p_player text, p_seat smallint)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where code = p_code for update;
  if not found then
    raise exception 'no such game';
  end if;
  if p_seat = 0 then
    if g.seat0_player is not null and g.seat0_player <> p_player then
      return false;
    end if;
    update public.games set seat0_player = p_player where code = p_code;
  else
    if g.seat1_player is not null and g.seat1_player <> p_player then
      return false;
    end if;
    update public.games set seat1_player = p_player where code = p_code;
  end if;
  return true;
end;
$$;

-- Append one move. Two checks and nothing else: the caller holds the seat the move claims, and `n` is
-- exactly the next number. A client that loses a race gets false, refetches the log and tries again.
create or replace function public.append_move(
  p_code text, p_player text, p_seat smallint, p_n integer, p_move jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  g public.games%rowtype;
  next_n integer;
begin
  select * into g from public.games where code = p_code for update;
  if not found then
    raise exception 'no such game';
  end if;
  if (p_seat = 0 and g.seat0_player is distinct from p_player)
     or (p_seat = 1 and g.seat1_player is distinct from p_player) then
    return false;
  end if;
  select coalesce(max(n) + 1, 0) into next_n from public.moves where code = p_code;
  if p_n <> next_n then
    return false;
  end if;
  insert into public.moves (code, n, seat, move) values (p_code, p_n, p_seat, p_move);
  update public.games set last_move_at = now() where code = p_code;
  return true;
end;
$$;

grant execute on function public.create_game(text, integer, integer, jsonb, text, smallint) to anon, authenticated;
grant execute on function public.claim_seat(text, text, smallint) to anon, authenticated;
grant execute on function public.append_move(text, text, smallint, integer, jsonb) to anon, authenticated;

-- Realtime: a client subscribes to the moves of its own game and applies each new row as it arrives.
alter publication supabase_realtime add table public.moves;
