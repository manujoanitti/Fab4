-- Reino da Bianca — esquema relacional mínimo.
-- Escritas feitas EXCLUSIVAMENTE por funções SECURITY DEFINER (0004); o cliente só lê (RLS em 0003).
-- Entidades consolidadas: daily_reviews+goal_reviews => goal_reviews (+histórico) e daily_medals.
-- Não existe coluna de saldo de créditos: saldo = soma de game_credit_events.

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  settings jsonb not null default '{"medalMinGoals":8,"medalIncludesSpecial":false,"medalsPerPhaseHint":null}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('guardian','child')),
  created_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index campaign_members_user_idx on public.campaign_members(user_id);

create table public.campaign_invites (
  code text primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  role text not null check (role in ('guardian','child')),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  used_by uuid references auth.users(id),
  used_at timestamptz
);

create table public.goal_reviews (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  review_date date not null,
  goal_id text not null,
  status text not null check (status in ('pending','done','not_done','not_evaluated')),
  version int not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  primary key (campaign_id, review_date, goal_id)
);

create table public.goal_review_history (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  op_id text not null,
  review_date date not null,
  goal_id text not null,
  from_status text,
  to_status text not null,
  at timestamptz not null default now(),
  by uuid not null,
  unique (campaign_id, op_id)
);
create index goal_review_history_idx on public.goal_review_history(campaign_id, review_date, goal_id);

-- Um selo do dia ("medalha diária") por campanha e data: a unicidade impede concessão dupla.
create table public.daily_medals (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  medal_date date not null,
  granted_at timestamptz not null default now(),
  granted_by uuid not null,
  primary key (campaign_id, medal_date)
);

create table public.phase_progress (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  phase int not null check (phase between 1 and 25),
  completed_at timestamptz not null default now(),
  completed_by uuid not null,
  primary key (campaign_id, phase)
);

create table public.reward_events (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('small_stamp','coins','big_stamps','reward_unlocked','final_bonus','delivery')),
  stage int check (stage between 1 and 5),
  phase int check (phase between 1 and 25),
  amount int,
  size text check (size in ('small','medium','large','final')),
  ref text,
  choice text,
  note text,
  at timestamptz not null default now(),
  by uuid not null,
  primary key (campaign_id, key)
);

create table public.game_credit_events (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('earn_medal','spend_session','adjust')),
  amount int not null check (amount <> 0),
  reason text,
  at timestamptz not null default now(),
  by uuid not null,
  primary key (campaign_id, key)
);

create table public.game_sessions (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  id text not null,
  game_id text not null check (game_id in ('stars','crystals','garden')),
  started_at timestamptz not null default now(),
  by uuid not null,
  primary key (campaign_id, id)
);

create table public.game_state (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  game_id text not null check (game_id in ('garden')),
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  primary key (campaign_id, game_id)
);

-- Idempotência de operações reenviadas (fila offline / reconexão).
create table public.applied_ops (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  op_id text not null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, op_id)
);
