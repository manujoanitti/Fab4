-- RLS: leitura apenas para membros; NENHUMA política de escrita nas tabelas de dados
-- (todas as mudanças passam por funções SECURITY DEFINER que validam auth.uid()).

create or replace function private.is_member(p_campaign uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.campaign_members m where m.campaign_id = p_campaign and m.user_id = auth.uid())
$$;
create or replace function private.is_guardian(p_campaign uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.campaign_members m
                 where m.campaign_id = p_campaign and m.user_id = auth.uid() and m.role = 'guardian')
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid), private.is_guardian(uuid) to authenticated;

-- Defesa em profundidade: nenhum acesso anônimo e nenhuma escrita direta pelo cliente.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.campaigns, public.campaign_members, public.campaign_invites,
  public.goal_reviews, public.goal_review_history, public.daily_medals, public.phase_progress,
  public.reward_events, public.game_credit_events, public.game_sessions, public.game_state,
  public.rule_goals, public.rule_stages, public.rule_final, public.rule_games, public.profiles
  to authenticated;
grant insert, update on public.profiles to authenticated;

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_invites enable row level security;
alter table public.goal_reviews enable row level security;
alter table public.goal_review_history enable row level security;
alter table public.daily_medals enable row level security;
alter table public.phase_progress enable row level security;
alter table public.reward_events enable row level security;
alter table public.game_credit_events enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_state enable row level security;
alter table public.applied_ops enable row level security;       -- sem política: inacessível ao cliente
alter table public.rule_goals enable row level security;
alter table public.rule_stages enable row level security;
alter table public.rule_final enable row level security;
alter table public.rule_games enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy campaigns_select on public.campaigns for select to authenticated using (private.is_member(id));
create policy members_select on public.campaign_members for select to authenticated using (private.is_member(campaign_id));
create policy invites_select on public.campaign_invites for select to authenticated using (private.is_guardian(campaign_id));

create policy goal_reviews_select on public.goal_reviews for select to authenticated using (private.is_member(campaign_id));
create policy goal_history_select on public.goal_review_history for select to authenticated using (private.is_member(campaign_id));
create policy medals_select on public.daily_medals for select to authenticated using (private.is_member(campaign_id));
create policy phases_select on public.phase_progress for select to authenticated using (private.is_member(campaign_id));
create policy rewards_select on public.reward_events for select to authenticated using (private.is_member(campaign_id));
create policy credits_select on public.game_credit_events for select to authenticated using (private.is_member(campaign_id));
create policy sessions_select on public.game_sessions for select to authenticated using (private.is_member(campaign_id));
create policy game_state_select on public.game_state for select to authenticated using (private.is_member(campaign_id));

create policy rule_goals_select on public.rule_goals for select to authenticated using (true);
create policy rule_stages_select on public.rule_stages for select to authenticated using (true);
create policy rule_final_select on public.rule_final for select to authenticated using (true);
create policy rule_games_select on public.rule_games for select to authenticated using (true);
