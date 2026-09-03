# Supabase setup

The online transport needs one Supabase project. Everything the app talks to is created by the migration in
`migrations/`, and the app itself needs two values at build time.

## Once, in the Supabase dashboard

1. Open the project, go to **SQL Editor**, paste the whole of `migrations/0001_games_and_moves.sql` and run it.
   It creates the `games` and `moves` tables, the row-level security policies, the three functions the client
   calls and the realtime publication. Running it twice is safe.
2. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

The anon key belongs in the browser and is meant to be public: every write goes through a security definer
function that checks the caller holds the seat it claims, and the tables themselves are closed to it.

## In the app

Local development reads `.env.local` (git-ignored):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Production reads the same two names from the Vercel project's environment variables.

With neither set, the app runs exactly as it does today: hot-seat games, saved in the browser, no network.
