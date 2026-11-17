-- Dados FICTÍCIOS de desenvolvimento (supabase db reset). Nenhum dado real.
-- Pré-requisito: criar (Auth > Users, ou `supabase auth`) o usuário fictício responsavel.demo@example.test.
-- Se ele não existir, o seed não faz nada.
do $$
declare u uuid; c uuid;
begin
  select id into u from auth.users where email = 'responsavel.demo@example.test';
  if u is null then raise notice 'seed ignorado: usuário fictício ausente'; return; end if;
  insert into public.profiles (id, display_name) values (u, 'Responsável Fictício') on conflict do nothing;
  insert into public.campaigns (name, created_by) values ('Campanha Fictícia (dev)', u) returning id into c;
  insert into public.campaign_members (campaign_id, user_id, role) values (c, u, 'guardian');
  insert into public.daily_medals (campaign_id, medal_date, granted_by) values (c, current_date - 2, u), (c, current_date - 1, u);
  insert into public.game_credit_events (campaign_id, key, kind, amount, by) values
    (c, 'medal:' || (current_date - 2), 'earn_medal', 1, u), (c, 'medal:' || (current_date - 1), 'earn_medal', 1, u);
end $$;
