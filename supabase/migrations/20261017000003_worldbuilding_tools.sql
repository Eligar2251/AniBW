-- Structured world encyclopedia, shareable map backgrounds, and public map markers.

create table public.world_map_settings (
  work_id uuid primary key references public.works (id) on delete cascade,
  background_url text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.world_entries (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_type text not null check (
    entry_type in ('place', 'faction', 'species', 'artifact', 'culture', 'concept')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 600),
  content text not null default '' check (char_length(content) <= 100000),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_entries_id_work_id_unique unique (id, work_id)
);

create table public.world_entry_links (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  source_entry_id uuid not null,
  target_entry_id uuid not null,
  relation_label text not null default 'Связано' check (
    char_length(btrim(relation_label)) between 1 and 80
  ),
  created_at timestamptz not null default now(),
  constraint world_entry_links_source_work_fk
    foreign key (source_entry_id, work_id)
    references public.world_entries (id, work_id) on delete cascade,
  constraint world_entry_links_target_work_fk
    foreign key (target_entry_id, work_id)
    references public.world_entries (id, work_id) on delete cascade,
  constraint world_entry_links_distinct_entries check (source_entry_id <> target_entry_id),
  constraint world_entry_links_unique_pair unique (source_entry_id, target_entry_id)
);

alter table public.map_markers
  add column world_entry_id uuid references public.world_entries (id) on delete set null,
  add column is_published boolean not null default false;

create index world_entries_work_type_title_idx
  on public.world_entries (work_id, entry_type, title);
create index world_entries_public_idx
  on public.world_entries (work_id, entry_type, title)
  where is_published;
create index world_entry_links_work_source_idx
  on public.world_entry_links (work_id, source_entry_id);
create index world_entry_links_target_idx
  on public.world_entry_links (target_entry_id);
create index map_markers_published_idx
  on public.map_markers (work_id, created_at)
  where is_published;

create or replace function public.validate_map_marker_world_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.world_entry_id is not null and not exists (
    select 1
    from public.world_entries e
    where e.id = new.world_entry_id
      and e.work_id = new.work_id
  ) then
    raise exception 'Map marker must reference an entry in the same world.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger map_markers_validate_world_entry
before insert or update of work_id, world_entry_id on public.map_markers
for each row execute function public.validate_map_marker_world_entry();

create trigger world_map_settings_set_updated_at
before update on public.world_map_settings
for each row execute function public.set_updated_at();

create trigger world_entries_set_updated_at
before update on public.world_entries
for each row execute function public.set_updated_at();

revoke all on function public.validate_map_marker_world_entry() from public, anon, authenticated;

alter table public.world_map_settings enable row level security;
alter table public.world_entries enable row level security;
alter table public.world_entry_links enable row level security;

create policy world_map_settings_read_public_or_owner
on public.world_map_settings for select to anon, authenticated
using (
  public.is_staff()
  or public.owns_work(work_id)
  or (is_published and public.is_viewable_work(work_id))
);

create policy world_map_settings_insert_owner
on public.world_map_settings for insert to authenticated
with check (public.is_author() and public.owns_work(work_id));

create policy world_map_settings_update_owner
on public.world_map_settings for update to authenticated
using (public.owns_work(work_id) or public.is_staff())
with check (public.owns_work(work_id) or public.is_staff());

create policy world_map_settings_delete_owner
on public.world_map_settings for delete to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy world_entries_read_public_or_owner
on public.world_entries for select to anon, authenticated
using (
  public.is_staff()
  or public.owns_work(work_id)
  or (is_published and public.is_viewable_work(work_id))
);

create policy world_entries_insert_owner
on public.world_entries for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_author()
  and public.owns_work(work_id)
);

create policy world_entries_update_owner
on public.world_entries for update to authenticated
using (public.owns_work(work_id) or public.is_staff())
with check (public.owns_work(work_id) or public.is_staff());

create policy world_entries_delete_owner
on public.world_entries for delete to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy world_entry_links_read_public_or_owner
on public.world_entry_links for select to anon, authenticated
using (
  public.is_staff()
  or public.owns_work(work_id)
  or (
    public.is_viewable_work(work_id)
    and exists (
      select 1 from public.world_entries source
      where source.id = source_entry_id
        and source.work_id = world_entry_links.work_id
        and source.is_published
    )
    and exists (
      select 1 from public.world_entries target
      where target.id = target_entry_id
        and target.work_id = world_entry_links.work_id
        and target.is_published
    )
  )
);

create policy world_entry_links_insert_owner
on public.world_entry_links for insert to authenticated
with check (
  public.is_author()
  and public.owns_work(work_id)
);

create policy world_entry_links_delete_owner
on public.world_entry_links for delete to authenticated
using (public.owns_work(work_id) or public.is_staff());

-- Keep private markers private, while allowing creators to explicitly publish
-- selected points on a publicly viewable work's map.
create policy map_markers_read_published
on public.map_markers for select to anon, authenticated
using (is_published and public.is_viewable_work(work_id));

grant select (work_id, background_url, is_published, updated_at)
  on public.world_map_settings to anon, authenticated;
grant insert (work_id, background_url, is_published)
  on public.world_map_settings to authenticated;
grant update (work_id, background_url, is_published)
  on public.world_map_settings to authenticated;
grant delete on public.world_map_settings to authenticated;

grant select (
  id, work_id, entry_type, title, summary, content, is_published, created_at, updated_at
) on public.world_entries to anon, authenticated;
grant select on public.world_entry_links to anon, authenticated;
grant insert (work_id, author_id, entry_type, title, summary, content, is_published)
  on public.world_entries to authenticated;
grant update (entry_type, title, summary, content, is_published)
  on public.world_entries to authenticated;
grant delete on public.world_entries to authenticated;
grant insert (work_id, source_entry_id, target_entry_id, relation_label)
  on public.world_entry_links to authenticated;
grant delete on public.world_entry_links to authenticated;
grant select (
  id, work_id, world_entry_id, label, description, pos_x, pos_y, color,
  is_published, created_at, updated_at
) on public.map_markers to anon;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'world_map_settings'
    ) then
      execute 'alter publication supabase_realtime add table public.world_map_settings';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'world_entries'
    ) then
      execute 'alter publication supabase_realtime add table public.world_entries';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'world_entry_links'
    ) then
      execute 'alter publication supabase_realtime add table public.world_entry_links';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'map_markers'
    ) then
      execute 'alter publication supabase_realtime add table public.map_markers';
    end if;
  end if;
end;
$$;
