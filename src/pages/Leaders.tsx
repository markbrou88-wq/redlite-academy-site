-- Leaders view: player, team, gp, g, a, pts
create or replace view public.leaders_current as
with
  games_played as (
    -- count distinct games a player appeared in (based on having any event)
    select player_id, count(distinct game_id) as gp
    from public.events
    group by 1
  ),
  goals as (
    select player_id, count(*) as g
    from public.events
    where event = 'goal'
    group by 1
  ),
  assists as (
    select player_id, count(*) as a
    from public.events
    where event = 'assist'
    group by 1
  )
select
  p.id as player_id,
  p.name as player,
  t.name as team,
  coalesce(gp.gp, 0) as gp,
  coalesce(g.g, 0)  as g,
  coalesce(a.a, 0)  as a,
  coalesce(g.g, 0) + coalesce(a.a, 0) as pts
from public.players p
left join public.teams t on t.id = p.team_id
left join games_played gp on gp.player_id = p.id
left join goals g on g.player_id = p.id
left join assists a on a.player_id = p.id;
