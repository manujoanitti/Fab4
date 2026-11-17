-- Regras ORIGINAIS do tabuleiro (somente leitura). Espelham src/domain/rules.ts
-- (conferido por tests/db/rules-seed.test.ts). Ver docs/regras-originais.md.
create table public.rule_goals (
  id text primary key,
  kind text not null check (kind in ('daily','special')),
  weekdays int[]  -- 0=domingo … 6=sábado; só para metas especiais
);
insert into public.rule_goals (id, kind, weekdays) values
  ('g1','daily',null),('g2','daily',null),('g3','daily',null),('g4','daily',null),
  ('g5','daily',null),('g6','daily',null),('g7','daily',null),('g8','daily',null),
  ('s1','special','{2,3}'),
  ('s2','special','{5,6}');

create table public.rule_stages (
  stage int primary key check (stage between 1 and 5),
  name text not null,
  coins int not null,
  big_stamps int not null,
  reward_size text not null check (reward_size in ('small','medium','large'))
);
insert into public.rule_stages values
  (1,'Floresta dos Sonhos',1,1,'small'),
  (2,'Castelo das Fadas',2,1,'small'),
  (3,'Lago Cristalino',3,2,'medium'),
  (4,'Montanhas da Coragem',4,2,'medium'),
  (5,'Jardim da Magia',5,3,'large');

create table public.rule_final (
  id boolean primary key default true check (id),
  coins_required int not null,
  big_stamps_required int not null,
  big_stamps int not null
);
insert into public.rule_final values (true, 15, 9, 1);

-- REGRA DIGITAL ADICIONAL (não está no tabuleiro): desbloqueio dos minigames.
create table public.rule_games (
  id text primary key,
  unlock_stage int
);
insert into public.rule_games values ('stars', null), ('crystals', 2), ('garden', 4);
