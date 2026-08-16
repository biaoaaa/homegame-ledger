# Homegame Ledger

一个给微信群 homegame 用的德扑输赢记录小网页。

## 本地预览

```bash
npm run serve
```

然后打开 `http://127.0.0.1:8000`。

## 当前数据存储

第一版使用浏览器 `localStorage`，适合先看交互和流程。这个模式的数据只存在当前手机或电脑浏览器里，微信群多人同时使用时不会同步。

## 上线建议

正式发微信群建议用：

- 前端：Cloudflare Pages 或 Vercel
- 数据库：Supabase Postgres
- 访问控制：一个固定房间码，后续可给每个玩家加 PIN

推荐数据表：

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'locked')),
  room_code text not null,
  created_at timestamptz not null default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  amount integer not null default 0,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);
```
