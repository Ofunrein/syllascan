create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  messages   jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  constraint conversations_user_id_unique unique (user_id)
);

alter table conversations enable row level security;

create policy "users manage own conversation"
  on conversations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function update_conversations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_conversations_updated_at();
