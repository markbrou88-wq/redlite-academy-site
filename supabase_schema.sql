-- Core tables
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  name text not null,
  jersey int,
  created_at timestamptz default now()
);
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  game_code text not null,
  game_date timestamptz not null,
  team_home text not null,
  team_away text not null,
  score_home int default 0,
  score_away int default 0,
  location text,
  status text default 'final'
);
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  team text not null,
  period int,
  time_mmss text,
  goals int default 0,
  assists int default 0,
  shots int default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

-- News
create table if not exists news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  body_md text not null,
  published_at timestamptz default now(),
  author text
);

-- Tournaments
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  start_date date,
  end_date date,
  location text,
  description_md text,
  status text default 'upcoming'
);
create table if not exists tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  team_name text not null
);
create table if not exists tournament_games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  game_code text,
  game_date timestamptz,
  team_home text,
  team_away text,
  score_home int default 0,
  score_away int default 0,
  bracket_round text
);

-- Standings view (2-1-0 points)
with params as (select 2::int as win_pts, 1::int as tie_pts, 0::int as loss_pts),
team_games as (
  select g.id as game_id,g.game_date,g.team_home as team,g.team_away as opp,g.score_home as gf,g.score_away as ga,
    case when g.score_home>g.score_away then 'W' when g.score_home<g.score_away then 'L' else 'T' end as result
  from games g
  union all
  select g.id,g.game_date,g.team_away,g.team_home,g.score_away,g.score_home,
    case when g.score_away>g.score_home then 'W' when g.score_away<g.score_home then 'L' else 'T' end
  from games g
),
agg as (
  select team,count(*) gp,sum((result='W')::int) w,sum((result='L')::int) l,sum((result='T')::int) t,sum(gf) gf,sum(ga) ga,sum(gf)-sum(ga) gd
  from team_games group by team
)
create or replace view team_standings as
select a.team,a.gp,a.w,a.l,a.t,a.gf,a.ga,a.gd,
  (select win_pts from params)*a.w + (select tie_pts from params)*a.t + (select loss_pts from params)*a.l as pts,
  case when a.gp=0 then 0 else round((((select win_pts from params)*a.w + (select tie_pts from params)*a.t)::numeric) / ((select win_pts from params)*a.gp)::numeric,3) end as pts_pct
from agg a order by pts desc, gd desc, gf desc, team asc;

-- Player stats view
create or replace view player_stats as
select
  p.id as player_id, p.team, p.name, p.jersey,
  coalesce(count(distinct e.game_id),0) as gp,
  coalesce(sum(e.goals),0) as goals,
  coalesce(sum(e.assists),0) as assists,
  coalesce(sum(e.shots),0) as shots,
  coalesce(sum(e.goals)+sum(e.assists),0) as points,
  case when count(distinct e.game_id)=0 then 0 else round((sum(e.goals)::numeric / count(distinct e.game_id)),2) end as g_per_gp,
  case when count(distinct e.game_id)=0 then 0 else round(((sum(e.goals)+sum(e.assists))::numeric / count(distinct e.game_id)),2) end as pts_per_gp
from players p left join events e on e.player_id=p.id
group by p.id,p.team,p.name,p.jersey
order by points desc, goals desc;

-- Admins (write access)
create table if not exists admins ( user_id uuid primary key );

-- RLS
alter table players enable row level security;
alter table games enable row level security;
alter table events enable row level security;
alter table news_posts enable row level security;
alter table tournaments enable row level security;
alter table tournament_teams enable row level security;
alter table tournament_games enable row level security;

-- Public read
create policy if not exists "players read" on players for select using (true);
create policy if not exists "games read" on games for select using (true);
create policy if not exists "events read" on events for select using (true);
create policy if not exists "news read" on news_posts for select using (true);
create policy if not exists "tournaments read" on tournaments for select using (true);
create policy if not exists "tournament teams read" on tournament_teams for select using (true);
create policy if not exists "tournament games read" on tournament_games for select using (true);

-- Admin-only write
create policy if not exists "players write" on players for all using (exists (select 1 from admins a where a.user_id=auth.uid())) with check (exists (select 1 from admins a where a.user_id=auth.uid()));
create policy if not exists "games write" on games for all using (exists (select 1 from admins a where a.user_id=auth.uid())) with check (exists (select 1 from admins a where a.user_id=auth.uid()));
create policy if not exists "events write" on events for all using (exists (select 1 from admins a where a.user_id=auth.uid())) with check (exists (select 1 from admins a where a.user_id=auth.uid()));
create policy if not exists "news write" on news_posts for all using (exists (select 1 from admins a where a.user_id=auth.uid())) with check (exists (select 1 from admins a where a.user_id=auth.uid()));
create policy if not exists "tournaments write" on tournaments for all using (exists (select 1 from admins a where a.user_id=auth.uid())) with check (exists (select 1 from admins a where a.user_id=auth.uid()));
create policy if not exists "tournament teams write" on tournament_teams for all using (exists (select 1 from admins a where a.user_id=auth.uid())) with check (exists (select 1 from admins a where a.user_id=auth.uid()));
create policy if not exists "tournament games write" on tournament_games for all using (exists (select 1 from admins a where a.user_id=auth.uid())) with check (exists (select 1 from admins a where a.user_id=auth.uid()));

-- Indexes
create index if not exists idx_events_game on events (game_id);
create index if not exists idx_events_player on events (player_id);
create index if not exists idx_events_createdat on events (created_at desc);
create index if not exists idx_games_teams on games (team_home, team_away);