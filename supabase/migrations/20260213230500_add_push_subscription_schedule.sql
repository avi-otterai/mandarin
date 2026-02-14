alter table public.push_subscriptions
  add column if not exists reminder_hour_local smallint not null default 16,
  add column if not exists reminder_minute_local smallint not null default 0,
  add column if not exists reminder_timezone text not null default 'UTC',
  add column if not exists last_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'push_subscriptions_reminder_hour_local_check'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_reminder_hour_local_check
      check (reminder_hour_local >= 0 and reminder_hour_local <= 23);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'push_subscriptions_reminder_minute_local_check'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_reminder_minute_local_check
      check (reminder_minute_local >= 0 and reminder_minute_local <= 59);
  end if;
end $$;
