-- Trader Edge — database schema
-- Paste this whole file into the Supabase SQL Editor and click "Run".

-- ACCOUNTS -------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  firm text,
  status text default 'funded', -- 'eval' | 'funded'
  starting_balance numeric default 50000,
  created_at timestamptz default now()
);

-- PLAYBOOKS (setups) ----------------------------------------
create table if not exists playbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rules text[] not null default '{}',
  created_at timestamptz default now()
);

-- TRADES ------------------------------------------------------
create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  setup_id uuid references playbooks(id) on delete set null,
  trade_date date not null,
  symbol text not null,
  pnl numeric not null,
  notes text,
  created_at timestamptz default now()
);

-- CERTIFICATES (trophy wall) ----------------------------------
create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'eval' | 'payout'
  firm text not null,
  amount numeric default 0,
  cert_date date not null,
  created_at timestamptz default now()
);

-- EXPENSES ------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  expense_date date not null,
  created_at timestamptz default now()
);

-- REVIEW NOTES (weekly debrief answers) --------------------------
create table if not exists review_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  q1 text,
  q2 text,
  q3 text,
  unique (user_id, week_start)
);

-- ============================================================
-- ROW LEVEL SECURITY — every table only readable/writable by its owner
-- ============================================================
alter table accounts enable row level security;
alter table playbooks enable row level security;
alter table trades enable row level security;
alter table certificates enable row level security;
alter table expenses enable row level security;
alter table review_notes enable row level security;

create policy "own accounts" on accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own playbooks" on playbooks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own trades" on trades for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own certificates" on certificates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own expenses" on expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own review notes" on review_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
