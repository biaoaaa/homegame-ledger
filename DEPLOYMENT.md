# Homegame Ledger Deployment

## Recommended Setup

- Frontend: Cloudflare Pages
- Database: Supabase Postgres
- Access control: one private room code shared in the WeChat group

The current local preview uses browser `localStorage`, so every phone has its own copy. For the WeChat version, move reads and writes to Supabase so everyone sees the same games, participants, entries, and leaderboard.

## Database Model

Use `supabase/schema.sql`.

Tables:

- `rooms`: one homegame group, protected by a room code
- `players`: Biao, Jiarou, and future players
- `games`: each session, such as `2026-08-16 对局一`
- `game_participants`: who entered each game
- `entries`: each participant's win/loss amount

## Supabase Steps

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Keep these values for deployment:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ROOM_CODE`, initially `biao-homegame`

Do not put the service role key in frontend JavaScript. Use it only in Cloudflare Pages Functions or another server-side API.

## Cloudflare Pages Steps

1. Push this repo to GitHub.
2. Create a Cloudflare Pages project from that GitHub repo.
3. Build settings for the current static app:
   - Build command: `npm run build`
   - Build output directory: `public`
4. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ROOM_CODE`
5. Deploy.

## API Shape To Add Next

Add Cloudflare Pages Functions under `functions/api/`:

- `GET /api/state`: load players, games, participants, entries
- `POST /api/players`: add player
- `POST /api/games`: create today's next numbered game
- `POST /api/games/:id/join`: enter game
- `POST /api/entries`: save amount
- `POST /api/games/:id/lock`: lock/unlock
- `DELETE /api/games/:id`: delete game and its entries

Then replace `src/storage.js` with API-backed storage.

## Practical Access Model

For a homegame, the simplest workable rule is:

- anyone with the WeChat link can open the ledger
- writes go through server-side API
- the API only accepts the configured `ROOM_CODE`

This is enough for a private friend group. If the link spreads too far later, add per-player PINs.
