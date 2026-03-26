-- Run this in your Supabase SQL Editor to set up the database

create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  availability jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" 
  on profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on profiles for update 
  using (auth.uid() = id);

create policy "Users can insert own profile" 
  on profiles for insert 
  with check (auth.uid() = id);

create table if not exists public.reminder_email_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  task_title text not null,
  scheduled_start timestamptz not null,
  reminder_timing text not null,
  provider_message_id text,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.reminder_email_logs enable row level security;

create policy "Users can view own reminder logs"
  on public.reminder_email_logs for select
  using (auth.uid() = user_id);
