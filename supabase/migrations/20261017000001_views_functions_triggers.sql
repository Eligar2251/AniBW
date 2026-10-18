-- Views, RPCs and derived-data triggers used by the React application.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_author()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('author', 'moderator', 'admin')
  );
$$;

create or replace function public.owns_work(work_id_in uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.works w
    where w.id = work_id_in
      and w.author_id = (select auth.uid())
  );
$$;

create or replace function public.is_viewable_work(work_id_in uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.works w
    where w.id = work_id_in
      and w.visibility in ('public', 'unlisted')
      and w.status <> 'draft'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  raw_username text;
  base_username text;
  candidate_username text;
  suffix integer := 0;
  display_name_value text;
begin
  raw_username := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'user'
  );

  base_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9_]+', '_', 'g'));
  base_username := regexp_replace(base_username, '^_+|_+$', '', 'g');
  if char_length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base_username := left(base_username, 30);
  candidate_username := base_username;

  while exists (
    select 1 from public.profiles p where p.username = candidate_username
  ) loop
    suffix := suffix + 1;
    candidate_username := left(base_username, 30 - char_length(suffix::text) - 1) || '_' || suffix::text;
  end loop;

  display_name_value := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    raw_username,
    'Новый пользователь'
  );

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate_username,
    display_name_value,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and (select auth.uid()) is not null then
    -- Users may opt into the author workspace, but cannot grant themselves
    -- moderation or administrative privileges.
    if (select auth.uid()) = old.id and old.role = 'user' and new.role = 'author' then
      return new;
    end if;

    if public.is_admin() then
      return new;
    end if;

    raise exception 'You are not allowed to change this profile role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_role
before update of role on public.profiles
for each row execute function public.protect_profile_role();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger fandoms_set_updated_at
before update on public.fandoms
for each row execute function public.set_updated_at();
create trigger works_set_updated_at
before update on public.works
for each row execute function public.set_updated_at();
create trigger chapters_set_updated_at
before update on public.chapters
for each row execute function public.set_updated_at();
create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();
create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();
create trigger world_board_items_set_updated_at
before update on public.world_board_items
for each row execute function public.set_updated_at();
create trigger map_markers_set_updated_at
before update on public.map_markers
for each row execute function public.set_updated_at();
create trigger canvas_items_set_updated_at
before update on public.canvas_items
for each row execute function public.set_updated_at();

create or replace function public.set_chapter_published_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      new.published_at := now();
    elsif old.status is distinct from 'published' or new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger chapters_set_published_at
before insert or update of status, published_at on public.chapters
for each row execute function public.set_chapter_published_at();

create or replace function public.refresh_fandom_works_count(fandom_id_in uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if fandom_id_in is null then
    return;
  end if;

  update public.fandoms f
  set works_count = (
    select count(*)::integer
    from public.works w
    where w.fandom_id = fandom_id_in
      and w.visibility = 'public'
      and w.status <> 'draft'
  )
  where f.id = fandom_id_in;
end;
$$;

create or replace function public.sync_fandom_works_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_fandom_works_count(old.fandom_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.refresh_fandom_works_count(new.fandom_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger works_sync_fandom_count
after insert or delete or update of fandom_id, visibility, status on public.works
for each row execute function public.sync_fandom_works_count();

create or replace function public.refresh_work_chapter_stats(work_id_in uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if work_id_in is null then
    return;
  end if;

  update public.works w
  set chapters_count = stats.chapters_count,
      words_count = stats.words_count,
      first_published_at = stats.first_published_at,
      last_chapter_at = stats.last_chapter_at
  from (
    select
      count(*) filter (where c.status = 'published')::integer as chapters_count,
      coalesce(sum(c.words_count) filter (where c.status = 'published'), 0)::bigint as words_count,
      min(c.published_at) filter (where c.status = 'published') as first_published_at,
      max(c.published_at) filter (where c.status = 'published') as last_chapter_at
    from public.chapters c
    where c.work_id = work_id_in
  ) as stats
  where w.id = work_id_in;
end;
$$;

create or replace function public.sync_work_chapter_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_work_chapter_stats(old.work_id);
    return old;
  end if;

  perform public.refresh_work_chapter_stats(new.work_id);
  if tg_op = 'UPDATE' and old.work_id is distinct from new.work_id then
    perform public.refresh_work_chapter_stats(old.work_id);
  end if;
  return new;
end;
$$;

create trigger chapters_sync_work_stats
after insert or delete or update of work_id, status, words_count, published_at on public.chapters
for each row execute function public.sync_work_chapter_stats();

create or replace function public.validate_chapter_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  chapter_work_id uuid;
begin
  select c.work_id
  into chapter_work_id
  from public.chapters c
  where c.id = new.chapter_id;

  if chapter_work_id is null or chapter_work_id <> new.work_id then
    raise exception 'Chapter does not belong to the supplied work'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger chapter_progress_validate_work
before insert or update of work_id, chapter_id on public.chapter_progress
for each row execute function public.validate_chapter_progress();

create or replace function public.validate_comment_context()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  chapter_work_id uuid;
  parent_work_id uuid;
  parent_chapter_id uuid;
begin
  if new.chapter_id is not null then
    select c.work_id
    into chapter_work_id
    from public.chapters c
    where c.id = new.chapter_id;

    if chapter_work_id is null or chapter_work_id <> new.work_id then
      raise exception 'Chapter does not belong to the supplied work'
        using errcode = '23514';
    end if;
  end if;

  if new.parent_id is not null then
    select c.work_id, c.chapter_id
    into parent_work_id, parent_chapter_id
    from public.comments c
    where c.id = new.parent_id;

    if parent_work_id is null
      or parent_work_id <> new.work_id
      or parent_chapter_id is distinct from new.chapter_id then
      raise exception 'Reply must belong to the same work and chapter as its parent'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger comments_validate_context
before insert or update of work_id, chapter_id, parent_id on public.comments
for each row execute function public.validate_comment_context();

create or replace function public.refresh_work_comment_count(work_id_in uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if work_id_in is null then
    return;
  end if;

  update public.works w
  set comments_count = (
    select count(*)::bigint
    from public.comments c
    where c.work_id = work_id_in
      and c.is_hidden = false
  )
  where w.id = work_id_in;
end;
$$;

create or replace function public.refresh_comment_replies_count(comment_id_in uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if comment_id_in is null then
    return;
  end if;

  update public.comments parent
  set replies_count = (
    select count(*)::integer
    from public.comments reply
    where reply.parent_id = comment_id_in
      and reply.is_hidden = false
  )
  where parent.id = comment_id_in;
end;
$$;

create or replace function public.sync_comment_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_work_comment_count(old.work_id);
    if old.parent_id is not null then
      perform public.refresh_comment_replies_count(old.parent_id);
    end if;
  end if;

  if tg_op <> 'DELETE' then
    perform public.refresh_work_comment_count(new.work_id);
    if new.parent_id is not null then
      perform public.refresh_comment_replies_count(new.parent_id);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger comments_sync_counts
after insert or delete or update of work_id, parent_id, is_hidden on public.comments
for each row execute function public.sync_comment_counts();

create or replace function public.sync_work_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_work_id uuid;
begin
  target_work_id := case when tg_op = 'DELETE' then old.work_id else new.work_id end;

  update public.works w
  set likes_count = (
    select count(*)::bigint
    from public.work_likes l
    where l.work_id = target_work_id
  )
  where w.id = target_work_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger work_likes_sync_count
after insert or delete on public.work_likes
for each row execute function public.sync_work_like_count();

create or replace function public.sync_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_comment_id uuid;
begin
  target_comment_id := case when tg_op = 'DELETE' then old.comment_id else new.comment_id end;

  update public.comments c
  set likes_count = (
    select count(*)::integer
    from public.comment_likes l
    where l.comment_id = target_comment_id
  )
  where c.id = target_comment_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger comment_likes_sync_count
after insert or delete on public.comment_likes
for each row execute function public.sync_comment_like_count();

create or replace function public.notify_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_id uuid;
  notification_type text;
  notification_body text;
begin
  if new.parent_id is not null then
    select c.author_id into recipient_id
    from public.comments c
    where c.id = new.parent_id;
    notification_type := 'reply';
    notification_body := 'ответил(-а) на ваш комментарий';
  else
    select w.author_id into recipient_id
    from public.works w
    where w.id = new.work_id;
    notification_type := 'comment';
    notification_body := 'оставил(-а) комментарий к вашему произведению';
  end if;

  if recipient_id is not null and recipient_id <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, body, work_id, chapter_id, comment_id)
    values (recipient_id, new.author_id, notification_type, notification_body, new.work_id, new.chapter_id, new.id);
  end if;

  return new;
end;
$$;

create trigger comments_notify_activity
after insert on public.comments
for each row execute function public.notify_comment_activity();

create or replace function public.notify_work_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_id uuid;
begin
  select w.author_id into recipient_id
  from public.works w
  where w.id = new.work_id;

  if recipient_id is not null and recipient_id <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, body, work_id)
    values (recipient_id, new.user_id, 'like', 'понравилось ваше произведение', new.work_id);
  end if;

  return new;
end;
$$;

create trigger work_likes_notify
after insert on public.work_likes
for each row execute function public.notify_work_like();

create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, actor_id, type, body)
  values (new.following_id, new.follower_id, 'new_follower', 'подписался(-ась) на вас');
  return new;
end;
$$;

create trigger follows_notify_new_follower
after insert on public.follows
for each row execute function public.notify_new_follower();

create or replace function public.notify_new_chapter()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  chapter_author_id uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  select w.author_id into chapter_author_id
  from public.works w
  where w.id = new.work_id;

  if chapter_author_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, body, work_id, chapter_id)
  select
    f.follower_id,
    new.author_id,
    'new_chapter',
    'опубликовал(-а) новую главу «' || new.title || '»',
    new.work_id,
    new.id
  from public.follows f
  where f.following_id = chapter_author_id
    and f.follower_id <> new.author_id;

  return new;
end;
$$;

create trigger chapters_notify_followers
after insert or update of status on public.chapters
for each row execute function public.notify_new_chapter();

create or replace function public.toggle_bookmark(work_id_in uuid, folder_in text default 'reading')
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  user_id_value uuid := (select auth.uid());
  deleted_count integer;
begin
  if user_id_value is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if folder_in not in ('reading', 'completed', 'want_to_read', 'dropped') then
    raise exception 'Invalid bookmark folder' using errcode = '22023';
  end if;
  if not public.is_viewable_work(work_id_in) then
    raise exception 'Work is not available for bookmarking' using errcode = '42501';
  end if;

  delete from public.bookmarks b
  where b.user_id = user_id_value
    and b.work_id = work_id_in
    and b.folder = folder_in;
  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    return false;
  end if;

  insert into public.bookmarks (user_id, work_id, folder)
  values (user_id_value, work_id_in, folder_in)
  on conflict (user_id, work_id, folder) do nothing;
  return true;
end;
$$;

create or replace function public.toggle_work_like(work_id_in uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  user_id_value uuid := (select auth.uid());
  deleted_count integer;
begin
  if user_id_value is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.is_viewable_work(work_id_in) then
    raise exception 'Work is not available for liking' using errcode = '42501';
  end if;

  delete from public.work_likes l
  where l.user_id = user_id_value and l.work_id = work_id_in;
  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    return false;
  end if;

  insert into public.work_likes (user_id, work_id)
  values (user_id_value, work_id_in)
  on conflict (user_id, work_id) do nothing;
  return true;
end;
$$;

create or replace function public.toggle_comment_like(comment_id_in uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  user_id_value uuid := (select auth.uid());
  comment_work_id uuid;
  comment_visible boolean;
  deleted_count integer;
begin
  if user_id_value is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select c.work_id, not c.is_hidden and public.is_viewable_work(c.work_id)
  into comment_work_id, comment_visible
  from public.comments c
  where c.id = comment_id_in;

  if comment_work_id is null or not coalesce(comment_visible, false) then
    raise exception 'Comment is not available for liking' using errcode = '42501';
  end if;

  delete from public.comment_likes l
  where l.user_id = user_id_value and l.comment_id = comment_id_in;
  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    return false;
  end if;

  insert into public.comment_likes (user_id, comment_id)
  values (user_id_value, comment_id_in)
  on conflict (user_id, comment_id) do nothing;
  return true;
end;
$$;

create or replace function public.increment_views(work_id_in uuid, chapter_id_in uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  work_author_id uuid;
begin
  if work_id_in is null or not public.is_viewable_work(work_id_in) then
    return;
  end if;

  select w.author_id into work_author_id
  from public.works w
  where w.id = work_id_in;

  if chapter_id_in is not null and not exists (
    select 1
    from public.chapters c
    where c.id = chapter_id_in
      and c.work_id = work_id_in
      and c.status = 'published'
  ) then
    return;
  end if;

  update public.works
  set views_count = views_count + 1
  where id = work_id_in;

  if chapter_id_in is not null then
    update public.chapters
    set views_count = views_count + 1
    where id = chapter_id_in;
  end if;

  insert into public.work_view_events (work_id, chapter_id, viewer_id)
  values (work_id_in, chapter_id_in, (select auth.uid()));
end;
$$;

create or replace function public.get_author_stats(p_author_id uuid, p_period text default 'month')
returns table (
  total_views bigint,
  total_likes bigint,
  total_comments bigint,
  total_followers bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  since_value timestamptz;
begin
  if (select auth.uid()) is null
    or ((select auth.uid()) <> p_author_id and not public.is_staff()) then
    raise exception 'Not allowed to view these author statistics'
      using errcode = '42501';
  end if;

  since_value := case lower(coalesce(p_period, 'month'))
    when 'day' then now() - interval '1 day'
    when 'week' then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
    when 'year' then now() - interval '365 days'
    else '-infinity'::timestamptz
  end;

  return query
  select
    (select count(*)::bigint
     from public.work_view_events v
     join public.works w on w.id = v.work_id
     where w.author_id = p_author_id and v.viewed_at >= since_value),
    (select count(*)::bigint
     from public.work_likes l
     join public.works w on w.id = l.work_id
     where w.author_id = p_author_id and l.created_at >= since_value),
    (select count(*)::bigint
     from public.comments c
     join public.works w on w.id = c.work_id
     where w.author_id = p_author_id
       and c.is_hidden = false
       and c.created_at >= since_value),
    (select count(*)::bigint
     from public.follows f
     where f.following_id = p_author_id);
end;
$$;

create or replace function public.get_author_activity(p_author_id uuid, p_days integer default 14)
returns table (
  activity_date date,
  views bigint,
  likes bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  days_value integer := greatest(1, least(coalesce(p_days, 14), 90));
begin
  if (select auth.uid()) is null
    or ((select auth.uid()) <> p_author_id and not public.is_staff()) then
    raise exception 'Not allowed to view this author activity'
      using errcode = '42501';
  end if;

  return query
  with days as (
    select generate_series(
      current_date - (days_value - 1),
      current_date,
      interval '1 day'
    )::date as day
  ), view_counts as (
    select v.viewed_at::date as day, count(*)::bigint as total
    from public.work_view_events v
    join public.works w on w.id = v.work_id
    where w.author_id = p_author_id
      and v.viewed_at >= current_date - (days_value - 1)
    group by v.viewed_at::date
  ), like_counts as (
    select l.created_at::date as day, count(*)::bigint as total
    from public.work_likes l
    join public.works w on w.id = l.work_id
    where w.author_id = p_author_id
      and l.created_at >= current_date - (days_value - 1)
    group by l.created_at::date
  )
  select days.day, coalesce(view_counts.total, 0), coalesce(like_counts.total, 0)
  from days
  left join view_counts on view_counts.day = days.day
  left join like_counts on like_counts.day = days.day
  order by days.day;
end;
$$;

create or replace view public.works_full
with (security_invoker = true)
as
select
  w.*,
  f.name as fandom_name,
  f.slug as fandom_slug,
  p.username as author_username,
  p.display_name as author_display_name,
  coalesce(tag_list.tags, '{}'::text[]) as tags
from public.works w
left join public.fandoms f on f.id = w.fandom_id
left join public.profiles p on p.id = w.author_id
left join lateral (
  select array_agg(t.name order by t.name) as tags
  from public.work_tags wt
  join public.tags t on t.id = wt.tag_id
  where wt.work_id = w.id
) as tag_list on true
where (
  (w.visibility in ('public', 'unlisted') and w.status <> 'draft')
  or w.author_id = (select auth.uid())
  or public.is_staff()
);

create or replace function public.search_works(
  search_query_in text default null,
  tag_in text default null,
  genre_in text default null,
  result_limit integer default 24
)
returns setof public.works_full
language sql
stable
set search_path = public, pg_temp
as $$
  select wf.*
  from public.works_full wf
  where wf.visibility = 'public'
    and wf.status <> 'draft'
    and (
      nullif(btrim(search_query_in), '') is null
      or concat_ws(
        ' ', wf.title, wf.summary, wf.description, wf.author_username,
        wf.author_display_name, wf.fandom_name
      ) ilike '%' || btrim(search_query_in) || '%'
    )
    and (nullif(btrim(tag_in), '') is null or lower(btrim(tag_in)) = any(wf.tags))
    and (nullif(btrim(genre_in), '') is null or lower(btrim(genre_in)) = any(wf.tags))
  order by wf.views_count desc, wf.created_at desc
  limit greatest(1, least(coalesce(result_limit, 24), 100));
$$;
