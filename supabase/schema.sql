create extension if not exists pgcrypto;

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Homegame',
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  date date not null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'locked')),
  created_at timestamptz not null default now()
);

create table game_participants (
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  amount integer not null default 0,
  donation_amount integer not null default 0,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create index games_room_date_idx on games(room_id, date desc, created_at desc);
create unique index players_room_lower_name_idx on players(room_id, lower(name));
create index participants_player_idx on game_participants(player_id);
create index entries_player_idx on entries(player_id);

insert into rooms (code, name)
values ('biao-homegame', 'Homegame Ledger')
on conflict (code) do nothing;

insert into players (room_id, name)
select id, player_name
from rooms
cross join (values ('Biao'), ('Jiarou')) as seed_players(player_name)
where code = 'biao-homegame'
on conflict do nothing;
