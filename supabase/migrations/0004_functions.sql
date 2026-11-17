-- Operações transacionais. Todas SECURITY DEFINER, com search_path fixo, validando auth.uid() e o papel.
-- apply_op() espelha src/domain/engine.ts (paridade verificada em tests/db/parity.test.ts).

create or replace function private.rej(p_code text, p_msg text) returns jsonb language sql immutable as $$
  select jsonb_build_object('status','rejected','code',p_code,'message',p_msg)
$$;
create or replace function private.ok(p_info text default null, p_dup boolean default false) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('status','ok','info',p_info,'duplicate', case when p_dup then true else null end))
$$;
create or replace function private.safe_date(p text) returns date language plpgsql immutable as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then return null;
end $$;

-- Progresso de um dia: metas diárias cumpridas + (opcional) especiais da semana.
create or replace function private.day_progress(p_campaign uuid, p_date date)
returns table(done int, required int, cnt int, eligible boolean) language plpgsql stable set search_path = public, pg_temp as $$
declare
  s jsonb; v_min int; v_incl boolean; v_done int; v_sched int := 0; v_sdone int := 0; v_ws date;
begin
  select settings into s from campaigns where id = p_campaign;
  v_min := (s->>'medalMinGoals')::int; v_incl := coalesce((s->>'medalIncludesSpecial')::boolean, false);
  select count(*) into v_done from goal_reviews gr join rule_goals rg on rg.id = gr.goal_id and rg.kind = 'daily'
    where gr.campaign_id = p_campaign and gr.review_date = p_date and gr.status = 'done';
  v_ws := p_date - ((extract(dow from p_date)::int + 6) % 7);
  select count(*), count(*) filter (where exists (
      select 1 from goal_reviews gr where gr.campaign_id = p_campaign and gr.goal_id = rg.id and gr.status = 'done'
        and gr.review_date between v_ws and v_ws + 6))
    into v_sched, v_sdone
    from rule_goals rg where rg.kind = 'special' and extract(dow from p_date)::int = any(rg.weekdays);
  done := v_done;
  required := v_min + case when v_incl then v_sched else 0 end;
  cnt := v_done + case when v_incl then v_sdone else 0 end;
  eligible := cnt >= required;
  return next;
end $$;

create or replace function private.credit_balance(p_campaign uuid) returns int language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(amount), 0)::int from game_credit_events where campaign_id = p_campaign
$$;

create or replace function private.stage_completed(p_campaign uuid, p_stage int) returns boolean language sql stable set search_path = public, pg_temp as $$
  select count(*) = 5 from phase_progress where campaign_id = p_campaign and phase between (p_stage - 1) * 5 + 1 and p_stage * 5
$$;

create or replace function private.game_unlocked(p_campaign uuid, p_game text) returns boolean language plpgsql stable set search_path = public, pg_temp as $$
declare v_stage int; v_found boolean;
begin
  select unlock_stage, true into v_stage, v_found from rule_games where id = p_game;
  if not coalesce(v_found, false) then return false; end if;
  return v_stage is null or private.stage_completed(p_campaign, v_stage);
end $$;

create or replace function private.reward_total(p_campaign uuid, p_kinds text[]) returns int language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(amount), 0)::int from reward_events where campaign_id = p_campaign and kind = any(p_kinds)
$$;

create or replace function private.op_set_goal(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_date date := private.safe_date(o->>'date'); v_goal text := o->>'goalId'; v_status text := o->>'status';
  v_exp int; cur goal_reviews%rowtype; v_cur int; v_found boolean;
begin
  if (o->>'expectedVersion') ~ '^\d+$' then v_exp := (o->>'expectedVersion')::int; end if;
  if v_date is null or v_exp is null or v_status is null
     or v_status not in ('pending','done','not_done','not_evaluated')
     or not exists (select 1 from rule_goals where id = v_goal) then
    return private.rej('invalid', 'Dados da meta inválidos.');
  end if;
  select * into cur from goal_reviews where campaign_id = c and review_date = v_date and goal_id = v_goal;
  v_found := found;  -- FOUND é sobrescrito pelos INSERTs seguintes
  if v_found and cur.status = v_status then return private.ok('same_value', true); end if;
  v_cur := case when v_found then cur.version else 0 end;
  if v_exp <> v_cur then
    return jsonb_build_object('status','conflict','entity','goal','serverVersion', v_cur,
      'serverValue', case when v_found then jsonb_build_object('date', cur.review_date, 'goalId', cur.goal_id,
        'status', cur.status, 'version', cur.version, 'updatedAt', cur.updated_at, 'updatedBy', cur.updated_by) else null end);
  end if;
  insert into goal_review_history (campaign_id, op_id, review_date, goal_id, from_status, to_status, by)
    values (c, o->>'opId', v_date, v_goal, case when v_found then cur.status end, v_status, u);
  if v_found then
    update goal_reviews set status = v_status, version = v_cur + 1, updated_at = now(), updated_by = u
      where campaign_id = c and review_date = v_date and goal_id = v_goal;
  else
    insert into goal_reviews (campaign_id, review_date, goal_id, status, version, updated_by) values (c, v_date, v_goal, v_status, 1, u);
  end if;
  return private.ok();
end $$;

create or replace function private.op_grant_medal(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_date date := private.safe_date(o->>'date'); p record; n int;
begin
  if v_date is null then return private.rej('invalid', 'Data inválida.'); end if;
  -- Unicidade (campaign_id, medal_date) garante uma única concessão mesmo sob concorrência.
  if exists (select 1 from daily_medals where campaign_id = c and medal_date = v_date) then return private.ok('already_granted', true); end if;
  select * into p from private.day_progress(c, v_date);
  if not p.eligible then
    return private.rej('not_eligible', format('Faltam metas cumpridas: %s de %s exigidas para o selo do dia.', p.cnt, p.required));
  end if;
  insert into daily_medals (campaign_id, medal_date, granted_by) values (c, v_date, u) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return private.ok('already_granted', true); end if;
  -- O crédito nasce NO SERVIDOR, na mesma transação da medalha confirmada.
  insert into game_credit_events (campaign_id, key, kind, amount, by) values (c, 'medal:' || v_date, 'earn_medal', 1, u)
    on conflict do nothing;
  return private.ok();
end $$;

create or replace function private.op_complete_phase(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_phase int; st rule_stages%rowtype; f rule_final%rowtype;
begin
  if (o->>'phase') ~ '^\d+$' then v_phase := (o->>'phase')::int; end if;
  if v_phase is null or v_phase < 1 or v_phase > 25 then return private.rej('invalid', 'Fase inválida.'); end if;
  if exists (select 1 from phase_progress where campaign_id = c and phase = v_phase) then return private.ok('already_done', true); end if;
  if v_phase > 1 and not exists (select 1 from phase_progress where campaign_id = c and phase = v_phase - 1) then
    return private.rej('out_of_order', 'Conclua a fase anterior antes desta.');
  end if;
  insert into phase_progress (campaign_id, phase, completed_by) values (c, v_phase, u);
  insert into reward_events (campaign_id, key, kind, phase, amount, by) values (c, format('phase:%s:stamp', v_phase), 'small_stamp', v_phase, 1, u);
  if v_phase % 5 = 0 then
    select * into st from rule_stages where stage = v_phase / 5;
    insert into reward_events (campaign_id, key, kind, stage, amount, by) values
      (c, format('stage:%s:coins', st.stage), 'coins', st.stage, st.coins, u),
      (c, format('stage:%s:big', st.stage), 'big_stamps', st.stage, st.big_stamps, u);
    insert into reward_events (campaign_id, key, kind, stage, size, by) values
      (c, format('reward:stage:%s', st.stage), 'reward_unlocked', st.stage, st.reward_size, u);
    select * into f from rule_final;
    if private.reward_total(c, array['coins']) >= f.coins_required
       and private.reward_total(c, array['big_stamps','final_bonus']) >= f.big_stamps_required then
      insert into reward_events (campaign_id, key, kind, amount, by) values (c, 'final:bonus', 'final_bonus', f.big_stamps, u);
      insert into reward_events (campaign_id, key, kind, size, by) values (c, 'reward:final', 'reward_unlocked', 'final', u);
    end if;
  end if;
  return private.ok();
end $$;

create or replace function private.op_deliver_reward(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_ref text := o->>'ref'; v_choice text := btrim(coalesce(o->>'choice','')); un reward_events%rowtype;
begin
  select * into un from reward_events where campaign_id = c and kind = 'reward_unlocked' and key = v_ref;
  if not found then return private.rej('unknown_reward', 'Recompensa ainda não liberada.'); end if;
  if v_choice = '' or length(v_choice) > 200 then return private.rej('invalid', 'Informe a recompensa recebida.'); end if;
  if exists (select 1 from reward_events where campaign_id = c and kind = 'delivery' and ref = v_ref) then
    return private.ok('already_delivered', true);
  end if;
  insert into reward_events (campaign_id, key, kind, stage, size, ref, choice, note, by)
    values (c, 'delivery:' || v_ref, 'delivery', un.stage, un.size, v_ref, v_choice, left(o->>'note', 300), u);
  return private.ok();
end $$;

create or replace function private.op_adjust_credits(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_amount int; v_reason text := btrim(coalesce(o->>'reason','')); v_key text := 'adjust:' || (o->>'opId');
begin
  if (o->>'amount') ~ '^-?\d+$' and length(o->>'amount') < 8 then v_amount := (o->>'amount')::int; end if;
  if v_amount is null or v_amount = 0 or abs(v_amount) > 100 or v_reason = '' then
    return private.rej('invalid', 'Informe quantidade (inteiro) e motivo.');
  end if;
  if exists (select 1 from game_credit_events where campaign_id = c and key = v_key) then return private.ok('already_applied', true); end if;
  if v_amount < 0 and private.credit_balance(c) + v_amount < 0 then
    return private.rej('insufficient_credits', 'Saldo insuficiente para o ajuste.');
  end if;
  insert into game_credit_events (campaign_id, key, kind, amount, reason, by) values (c, v_key, 'adjust', v_amount, left(v_reason, 200), u);
  return private.ok();
end $$;

create or replace function private.op_start_session(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_game text := o->>'gameId'; v_id text := o->>'sessionId';
begin
  if not exists (select 1 from rule_games where id = v_game) or coalesce(v_id, '') = '' or length(v_id) > 100 then
    return private.rej('invalid', 'Jogo inválido.');
  end if;
  if exists (select 1 from game_sessions where campaign_id = c and id = v_id) then return private.ok('already_started', true); end if;
  if not private.game_unlocked(c, v_game) then return private.rej('game_locked', 'Este jogo ainda não foi desbloqueado.'); end if;
  if private.credit_balance(c) < 1 then return private.rej('insufficient_credits', 'Sem créditos de minigame.'); end if;
  insert into game_sessions (campaign_id, id, game_id, by) values (c, v_id, v_game, u);
  insert into game_credit_events (campaign_id, key, kind, amount, by) values (c, 'session:' || v_id, 'spend_session', -1, u);
  return private.ok();
end $$;

create or replace function private.op_save_game_state(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_game text := o->>'gameId'; v_exp int; cur game_state%rowtype; v_cur int; v_data jsonb := coalesce(o->'data', 'null'::jsonb);
begin
  if v_game is distinct from 'garden' then return private.rej('invalid', 'Jogo sem estado persistente.'); end if;
  if not private.game_unlocked(c, v_game) then return private.rej('game_locked', 'Este jogo ainda não foi desbloqueado.'); end if;
  if (o->>'expectedVersion') ~ '^\d+$' then v_exp := (o->>'expectedVersion')::int; end if;
  if v_exp is null or length(v_data::text) > 65536 then return private.rej('invalid', 'Estado inválido ou grande demais.'); end if;
  select * into cur from game_state where campaign_id = c and game_id = v_game;
  if found and cur.data = v_data then return private.ok('same_value', true); end if;
  v_cur := case when found then cur.version else 0 end;
  if v_exp <> v_cur then
    return jsonb_build_object('status','conflict','entity','game','serverVersion', v_cur,
      'serverValue', case when found then jsonb_build_object('gameId', cur.game_id, 'data', cur.data, 'version', cur.version,
        'updatedAt', cur.updated_at, 'updatedBy', cur.updated_by) else null end);
  end if;
  insert into game_state (campaign_id, game_id, data, version, updated_by) values (c, v_game, v_data, 1, u)
    on conflict (campaign_id, game_id) do update set data = excluded.data, version = game_state.version + 1, updated_at = now(), updated_by = u;
  return private.ok();
end $$;

create or replace function private.op_update_settings(c uuid, u uuid, o jsonb) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare x jsonb := o->'settings'; v_min int; v_hint int; v_incl boolean; v_hint_ok boolean;
begin
  if jsonb_typeof(x) is distinct from 'object' then return private.rej('invalid', 'Parâmetros inválidos.'); end if;
  if jsonb_typeof(x->'medalMinGoals') = 'number' and (x->>'medalMinGoals') ~ '^\d+$' then v_min := (x->>'medalMinGoals')::int; end if;
  if jsonb_typeof(x->'medalIncludesSpecial') = 'boolean' then v_incl := (x->>'medalIncludesSpecial')::boolean; end if;
  v_hint_ok := jsonb_typeof(x->'medalsPerPhaseHint') = 'null';
  if jsonb_typeof(x->'medalsPerPhaseHint') = 'number' and (x->>'medalsPerPhaseHint') ~ '^\d+$' then
    v_hint := (x->>'medalsPerPhaseHint')::int; v_hint_ok := v_hint between 1 and 31;
  end if;
  if v_min is null or v_min < 1 or v_min > 8 or v_incl is null or not coalesce(v_hint_ok, false) then
    return private.rej('invalid', 'Parâmetros inválidos.');
  end if;
  update campaigns set settings = jsonb_build_object('medalMinGoals', v_min, 'medalIncludesSpecial', v_incl, 'medalsPerPhaseHint', v_hint)
    where id = c;
  return private.ok();
end $$;

-- Ponto de entrada único para escritas de jogo.
create or replace function public.apply_op(p_campaign uuid, p_op jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid(); v_role text; v_type text := p_op->>'type'; v_op_id text := p_op->>'opId'; res jsonb;
begin
  if u is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select role into v_role from campaign_members where campaign_id = p_campaign and user_id = u;
  if v_role is null then raise exception 'not a campaign member' using errcode = '42501'; end if;
  if v_op_id is null or length(v_op_id) not between 1 and 100 then return private.rej('invalid', 'opId ausente.'); end if;
  if v_type in ('set_goal','grant_medal','complete_phase','deliver_reward','adjust_credits','update_settings') and v_role <> 'guardian' then
    return private.rej('forbidden', 'Somente o responsável pode realizar esta ação.');
  end if;
  -- Serializa operações da mesma campanha (a unicidade no banco continua sendo a última barreira).
  perform pg_advisory_xact_lock(hashtextextended(p_campaign::text, 0));
  if exists (select 1 from applied_ops where campaign_id = p_campaign and op_id = v_op_id) then
    return private.ok('replayed', true);
  end if;
  res := case v_type
    when 'set_goal' then private.op_set_goal(p_campaign, u, p_op)
    when 'grant_medal' then private.op_grant_medal(p_campaign, u, p_op)
    when 'complete_phase' then private.op_complete_phase(p_campaign, u, p_op)
    when 'deliver_reward' then private.op_deliver_reward(p_campaign, u, p_op)
    when 'adjust_credits' then private.op_adjust_credits(p_campaign, u, p_op)
    when 'start_session' then private.op_start_session(p_campaign, u, p_op)
    when 'save_game_state' then private.op_save_game_state(p_campaign, u, p_op)
    when 'update_settings' then private.op_update_settings(p_campaign, u, p_op)
    else private.rej('invalid', 'Operação desconhecida.') end;
  if res->>'status' = 'ok' then
    insert into applied_ops (campaign_id, op_id) values (p_campaign, v_op_id) on conflict do nothing;
  end if;
  return res;
end $$;

-- Estado completo da campanha (mesmo formato de CampaignState em src/domain/types.ts).
create or replace function public.get_snapshot(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c campaigns%rowtype; v_role text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select role into v_role from campaign_members where campaign_id = p_campaign and user_id = auth.uid();
  if v_role is null then raise exception 'not a campaign member' using errcode = '42501'; end if;
  select * into c from campaigns where id = p_campaign;
  return jsonb_build_object(
    'campaignId', c.id, 'name', c.name, 'settings', c.settings, 'role', v_role,
    'goalReviews', coalesce((select jsonb_agg(jsonb_build_object('date', review_date, 'goalId', goal_id, 'status', status,
        'version', version, 'updatedAt', updated_at, 'updatedBy', updated_by) order by review_date, goal_id)
        from goal_reviews where campaign_id = c.id), '[]'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('opId', op_id, 'date', review_date, 'goalId', goal_id,
        'from', from_status, 'to', to_status, 'at', at, 'by', by) order by id) from goal_review_history where campaign_id = c.id), '[]'),
    'medals', coalesce((select jsonb_agg(jsonb_build_object('date', medal_date, 'grantedAt', granted_at, 'grantedBy', granted_by)
        order by medal_date) from daily_medals where campaign_id = c.id), '[]'),
    'phases', coalesce((select jsonb_agg(jsonb_build_object('phase', phase, 'completedAt', completed_at, 'completedBy', completed_by)
        order by phase) from phase_progress where campaign_id = c.id), '[]'),
    'rewardEvents', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key', key, 'kind', kind, 'stage', stage,
        'phase', phase, 'amount', amount, 'size', size, 'ref', ref, 'choice', choice, 'note', note, 'at', at, 'by', by))
        order by at, key) from reward_events where campaign_id = c.id), '[]'),
    'creditEvents', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key', key, 'kind', kind, 'amount', amount,
        'reason', reason, 'at', at, 'by', by)) order by at, key) from game_credit_events where campaign_id = c.id), '[]'),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'gameId', game_id, 'startedAt', started_at, 'by', by)
        order by started_at, id) from game_sessions where campaign_id = c.id), '[]'),
    'gameStates', coalesce((select jsonb_agg(jsonb_build_object('gameId', game_id, 'data', data, 'version', version,
        'updatedAt', updated_at, 'updatedBy', updated_by)) from game_state where campaign_id = c.id), '[]')
  );
end $$;

create or replace function public.create_campaign(p_name text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); v_id uuid;
begin
  if u is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then raise exception 'invalid name' using errcode = '22023'; end if;
  insert into profiles (id) values (u) on conflict do nothing;
  insert into campaigns (name, created_by) values (btrim(p_name), u) returning id into v_id;
  insert into campaign_members (campaign_id, user_id, role) values (v_id, u, 'guardian');
  return v_id;
end $$;

create or replace function public.list_my_campaigns() returns table(id uuid, name text, role text)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.name, m.role from campaigns c join campaign_members m on m.campaign_id = c.id
   where m.user_id = auth.uid() order by c.created_at
$$;

create or replace function public.create_invite(p_campaign uuid, p_role text default 'child') returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code text;
begin
  if not private.is_guardian(p_campaign) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('guardian','child') then raise exception 'invalid role' using errcode = '22023'; end if;
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into campaign_invites (code, campaign_id, role, created_by, expires_at)
    values (v_code, p_campaign, p_role, auth.uid(), now() + interval '7 days');
  return v_code;
end $$;

create or replace function public.redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); inv campaign_invites%rowtype;
begin
  if u is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into inv from campaign_invites where code = p_code for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then raise exception 'invalid or expired invite' using errcode = '22023'; end if;
  insert into profiles (id) values (u) on conflict do nothing;
  insert into campaign_members (campaign_id, user_id, role) values (inv.campaign_id, u, inv.role)
    on conflict (campaign_id, user_id) do update set role = case when campaign_members.role = 'guardian' then 'guardian' else excluded.role end;
  update campaign_invites set used_by = u, used_at = now() where code = p_code;
  return inv.campaign_id;
end $$;

-- Restauração idempotente de backup (formato versionado). Nunca sobrescreve registros existentes.
create or replace function public.restore_backup(p_campaign uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s jsonb; n int; r jsonb := '{}'::jsonb; v_empty boolean; skipped int := 0; rw jsonb;
begin
  if not private.is_guardian(p_campaign) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_payload->>'format' is distinct from 'reino-bianca-backup' or (p_payload->>'schemaVersion') is distinct from '1'
     or jsonb_typeof(p_payload->'state') is distinct from 'object' then
    raise exception 'invalid backup format' using errcode = '22023';
  end if;
  if coalesce((p_payload->>'demo')::boolean, false) then
    raise exception 'demo backups cannot be restored into a real campaign' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_campaign::text, 0));
  s := p_payload->'state';
  select not exists (select 1 from phase_progress where campaign_id = p_campaign)
     and not exists (select 1 from daily_medals where campaign_id = p_campaign) into v_empty;
  if v_empty and jsonb_typeof(s->'settings') = 'object' then
    update campaigns set settings = jsonb_build_object(
      'medalMinGoals', least(8, greatest(1, coalesce((s->'settings'->>'medalMinGoals')::int, 8))),
      'medalIncludesSpecial', coalesce((s->'settings'->>'medalIncludesSpecial')::boolean, false),
      'medalsPerPhaseHint', nullif(s->'settings'->'medalsPerPhaseHint', 'null'::jsonb)) where id = p_campaign;
  end if;

  insert into daily_medals (campaign_id, medal_date, granted_at, granted_by)
    select p_campaign, (e->>'date')::date, (e->>'grantedAt')::timestamptz, (e->>'grantedBy')::uuid
      from jsonb_array_elements(coalesce(s->'medals','[]')) e on conflict do nothing;
  get diagnostics n = row_count; r := r || jsonb_build_object('medals', n);

  insert into phase_progress (campaign_id, phase, completed_at, completed_by)
    select p_campaign, (e->>'phase')::int, (e->>'completedAt')::timestamptz, (e->>'completedBy')::uuid
      from jsonb_array_elements(coalesce(s->'phases','[]')) e on conflict do nothing;
  get diagnostics n = row_count; r := r || jsonb_build_object('phases', n);

  insert into reward_events (campaign_id, key, kind, stage, phase, amount, size, ref, choice, note, at, by)
    select p_campaign, e->>'key', e->>'kind', (e->>'stage')::int, (e->>'phase')::int, (e->>'amount')::int, e->>'size',
           e->>'ref', e->>'choice', e->>'note', (e->>'at')::timestamptz, (e->>'by')::uuid
      from jsonb_array_elements(coalesce(s->'rewardEvents','[]')) e on conflict do nothing;
  get diagnostics n = row_count; r := r || jsonb_build_object('rewardEvents', n);

  insert into game_credit_events (campaign_id, key, kind, amount, reason, at, by)
    select p_campaign, e->>'key', e->>'kind', (e->>'amount')::int, e->>'reason', (e->>'at')::timestamptz, (e->>'by')::uuid
      from jsonb_array_elements(coalesce(s->'creditEvents','[]')) e on conflict do nothing;
  get diagnostics n = row_count; r := r || jsonb_build_object('creditEvents', n);

  insert into game_sessions (campaign_id, id, game_id, started_at, by)
    select p_campaign, e->>'id', e->>'gameId', (e->>'startedAt')::timestamptz, (e->>'by')::uuid
      from jsonb_array_elements(coalesce(s->'sessions','[]')) e on conflict do nothing;
  get diagnostics n = row_count; r := r || jsonb_build_object('sessions', n);

  insert into goal_review_history (campaign_id, op_id, review_date, goal_id, from_status, to_status, at, by)
    select p_campaign, e->>'opId', (e->>'date')::date, e->>'goalId', e->>'from', e->>'to', (e->>'at')::timestamptz, (e->>'by')::uuid
      from jsonb_array_elements(coalesce(s->'history','[]')) e on conflict do nothing;

  -- Metas e jogos: só insere o que não existe; divergências são contadas, nunca sobrescritas.
  for rw in select * from jsonb_array_elements(coalesce(s->'goalReviews','[]')) loop
    insert into goal_reviews (campaign_id, review_date, goal_id, status, version, updated_at, updated_by)
      values (p_campaign, (rw->>'date')::date, rw->>'goalId', rw->>'status', (rw->>'version')::int,
              (rw->>'updatedAt')::timestamptz, (rw->>'updatedBy')::uuid) on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 and exists (select 1 from goal_reviews g where g.campaign_id = p_campaign and g.review_date = (rw->>'date')::date
                          and g.goal_id = rw->>'goalId' and g.status <> rw->>'status') then skipped := skipped + 1; end if;
  end loop;
  for rw in select * from jsonb_array_elements(coalesce(s->'gameStates','[]')) loop
    insert into game_state (campaign_id, game_id, data, version, updated_at, updated_by)
      values (p_campaign, rw->>'gameId', rw->'data', (rw->>'version')::int, (rw->>'updatedAt')::timestamptz, (rw->>'updatedBy')::uuid)
      on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 and exists (select 1 from game_state g where g.campaign_id = p_campaign and g.game_id = rw->>'gameId' and g.data <> rw->'data') then
      skipped := skipped + 1; end if;
  end loop;
  return r || jsonb_build_object('skippedDifferent', skipped);
end $$;

-- Somente usuários autenticados executam as funções públicas; anon e PUBLIC não.
revoke all on function public.apply_op(uuid, jsonb), public.get_snapshot(uuid), public.create_campaign(text),
  public.list_my_campaigns(), public.create_invite(uuid, text), public.redeem_invite(text),
  public.restore_backup(uuid, jsonb) from public, anon;
grant execute on function public.apply_op(uuid, jsonb), public.get_snapshot(uuid), public.create_campaign(text),
  public.list_my_campaigns(), public.create_invite(uuid, text), public.redeem_invite(text),
  public.restore_backup(uuid, jsonb) to authenticated;
-- Funções internas (schema private) não são expostas pela API.
revoke all on all functions in schema private from public, anon;
