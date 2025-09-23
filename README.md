# Redlite Academy – Full Starter (React + Vite + Tailwind + Supabase)

Sections: News · League (Leaders/Standings/Games + Box Score) · Tournaments · Sponsors · Logger · Admin

## Run locally/in browser
- Install deps: `npm i`
- Copy env: `cp .env.example .env` and paste your Supabase URL + anon key
- Dev: `npm run dev`

## Supabase
Open `supabase_schema.sql` and paste into Supabase SQL Editor. Add your user to `admins` after signing in via magic link:

```
insert into admins (user_id) values ('YOUR_AUTH_UID');
```