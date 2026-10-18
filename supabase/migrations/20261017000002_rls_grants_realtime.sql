-- Row-level security and API permissions. The anon key is safe to expose only
-- because all access is constrained here and in the security-definer RPCs.

alter table public.profiles enable row level security;
alter table public.fandoms enable row level security;
alter table public.works enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_versions enable row level security;
alter table public.chapter_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.tags enable row level security;
alter table public.work_tags enable row level security;
alter table public.work_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.follows enable row level security;
alter table public.work_view_events enable row level security;
alter table public.characters enable row level security;
alter table public.character_badges enable row level security;
alter table public.character_abilities enable row level security;
alter table public.character_relations enable row level security;
alter table public.world_board_items enable row level security;
alter table public.map_markers enable row level security;
alter table public.canvas_items enable row level security;

-- Profiles are public, but authenticated users can only edit their own profile.
create policy profiles_public_read
on public.profiles for select to anon, authenticated
using (true);

create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'user');

create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

-- Fandoms are public taxonomy; staff can curate entries.
create policy fandoms_public_read
on public.fandoms for select to anon, authenticated
using (true);

create policy fandoms_staff_insert
on public.fandoms for insert to authenticated
with check (public.is_staff());

create policy fandoms_staff_update
on public.fandoms for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy fandoms_staff_delete
on public.fandoms for delete to authenticated
using (public.is_staff());

-- Public / unlisted works can be read by anyone; drafts are owner-only.
create policy works_read_visible_or_owner
on public.works for select to anon, authenticated
using (
  (visibility in ('public', 'unlisted') and status <> 'draft')
  or author_id = (select auth.uid())
  or public.is_staff()
);

create policy works_insert_author
on public.works for insert to authenticated
with check (
  (author_id = (select auth.uid()) and public.is_author())
  or public.is_staff()
);

create policy works_update_author
on public.works for update to authenticated
using (
  (author_id = (select auth.uid()) and public.is_author())
  or public.is_staff()
)
with check (
  (author_id = (select auth.uid()) and public.is_author())
  or public.is_staff()
);

create policy works_delete_author
on public.works for delete to authenticated
using (
  (author_id = (select auth.uid()) and public.is_author())
  or public.is_staff()
);

-- Readers see published chapters of visible works; authors manage their drafts.
create policy chapters_read_published_or_owner
on public.chapters for select to anon, authenticated
using (
  public.is_staff()
  or public.owns_work(work_id)
  or (status = 'published' and public.is_viewable_work(work_id))
);

create policy chapters_insert_owner
on public.chapters for insert to authenticated
with check (
  (author_id = (select auth.uid()) and public.is_author() and public.owns_work(work_id))
  or public.is_staff()
);

create policy chapters_update_owner
on public.chapters for update to authenticated
using (public.owns_work(work_id) or public.is_staff())
with check (public.owns_work(work_id) or public.is_staff());

create policy chapters_delete_owner
on public.chapters for delete to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy chapter_versions_read_owner
on public.chapter_versions for select to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.chapters c
    where c.id = chapter_id and public.owns_work(c.work_id)
  )
);

create policy chapter_versions_insert_owner
on public.chapter_versions for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    public.is_staff()
    or exists (
      select 1 from public.chapters c
      where c.id = chapter_id and public.owns_work(c.work_id)
    )
  )
);

-- Reading progress and bookmarks are private to the signed-in user.
create policy chapter_progress_read_self
on public.chapter_progress for select to authenticated
using (user_id = (select auth.uid()));

create policy chapter_progress_insert_self
on public.chapter_progress for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_viewable_work(work_id)
  and exists (
    select 1 from public.chapters c
    where c.id = public.chapter_progress.chapter_id
      and c.work_id = public.chapter_progress.work_id
      and c.status = 'published'
  )
);

create policy chapter_progress_update_self
on public.chapter_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy chapter_progress_delete_self
on public.chapter_progress for delete to authenticated
using (user_id = (select auth.uid()));

create policy bookmarks_read_self
on public.bookmarks for select to authenticated
using (user_id = (select auth.uid()));

create policy bookmarks_insert_self
on public.bookmarks for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_viewable_work(work_id));

create policy bookmarks_update_self
on public.bookmarks for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and public.is_viewable_work(work_id));

create policy bookmarks_delete_self
on public.bookmarks for delete to authenticated
using (user_id = (select auth.uid()));

-- Tags can be browsed publicly and edited by authors through work creation.
create policy tags_public_read
on public.tags for select to anon, authenticated
using (true);

create policy tags_author_insert
on public.tags for insert to authenticated
with check (public.is_author());

create policy tags_staff_delete
on public.tags for delete to authenticated
using (public.is_staff());

create policy work_tags_read_visible_or_owner
on public.work_tags for select to anon, authenticated
using (
  public.is_viewable_work(work_id)
  or public.owns_work(work_id)
  or public.is_staff()
);

create policy work_tags_insert_owner
on public.work_tags for insert to authenticated
with check (
  (public.is_author() and public.owns_work(work_id))
  or public.is_staff()
);

create policy work_tags_delete_owner
on public.work_tags for delete to authenticated
using (
  (public.is_author() and public.owns_work(work_id))
  or public.is_staff()
);

-- Like rows are private to their owner; the counters are maintained by triggers.
create policy work_likes_read_self
on public.work_likes for select to authenticated
using (user_id = (select auth.uid()));

create policy comment_likes_read_self
on public.comment_likes for select to authenticated
using (user_id = (select auth.uid()));

-- Clients read visible comments and can write only as themselves.
create policy comments_read_visible_or_owner
on public.comments for select to anon, authenticated
using (
  public.is_staff()
  or author_id = (select auth.uid())
  or public.owns_work(work_id)
  or (
    is_hidden = false
    and public.is_viewable_work(work_id)
    and (
      chapter_id is null
      or exists (
        select 1 from public.chapters c
        where c.id = public.comments.chapter_id
          and c.work_id = public.comments.work_id
          and c.status = 'published'
      )
    )
  )
);

create policy comments_insert_authenticated
on public.comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_viewable_work(work_id)
  and (
    chapter_id is null
    or exists (
      select 1 from public.chapters c
      where c.id = public.comments.chapter_id
        and c.work_id = public.comments.work_id
        and c.status = 'published'
    )
  )
);

create policy comments_update_author_or_staff
on public.comments for update to authenticated
using (author_id = (select auth.uid()) or public.owns_work(work_id) or public.is_staff())
with check (author_id = (select auth.uid()) or public.owns_work(work_id) or public.is_staff());

create policy comments_delete_author_or_staff
on public.comments for delete to authenticated
using (author_id = (select auth.uid()) or public.owns_work(work_id) or public.is_staff());

create policy comment_reports_insert_self
on public.comment_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and exists (
    select 1 from public.comments c
    where c.id = comment_id and c.is_hidden = false and public.is_viewable_work(c.work_id)
  )
);

create policy comment_reports_read_self_or_staff
on public.comment_reports for select to authenticated
using (reporter_id = (select auth.uid()) or public.is_staff());

-- Notifications may only be read/marked by their recipient. Inserts come from triggers.
create policy notifications_read_self
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy notifications_update_self
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Follow relationships are public; a user can only create/remove their own follow.
create policy follows_public_read
on public.follows for select to anon, authenticated
using (true);

create policy follows_insert_self
on public.follows for insert to authenticated
with check (follower_id = (select auth.uid()));

create policy follows_delete_self
on public.follows for delete to authenticated
using (follower_id = (select auth.uid()));

-- View events are intentionally private and can only be read through the author RPCs.
-- No direct table policies are defined for work_view_events.

-- Characters and world-building data belong to the work's author.
create policy characters_read_owner
on public.characters for select to authenticated
using (author_id = (select auth.uid()) or public.is_staff());

create policy characters_insert_owner
on public.characters for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_author()
  and (work_id is null or public.owns_work(work_id))
);

create policy characters_update_owner
on public.characters for update to authenticated
using (author_id = (select auth.uid()) or public.is_staff())
with check (
  (author_id = (select auth.uid()) and (work_id is null or public.owns_work(work_id)))
  or public.is_staff()
);

create policy characters_delete_owner
on public.characters for delete to authenticated
using (author_id = (select auth.uid()) or public.is_staff());

create policy character_badges_read_owner
on public.character_badges for select to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_badges_insert_owner
on public.character_badges for insert to authenticated
with check (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_badges_update_owner
on public.character_badges for update to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
)
with check (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_badges_delete_owner
on public.character_badges for delete to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_abilities_read_owner
on public.character_abilities for select to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_abilities_insert_owner
on public.character_abilities for insert to authenticated
with check (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_abilities_update_owner
on public.character_abilities for update to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
)
with check (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_abilities_delete_owner
on public.character_abilities for delete to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.characters c
    where c.id = character_id and c.author_id = (select auth.uid())
  )
);

create policy character_relations_read_owner
on public.character_relations for select to authenticated
using (author_id = (select auth.uid()) or public.is_staff());

create policy character_relations_insert_owner
on public.character_relations for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_author()
  and public.owns_work(work_id)
  and exists (
    select 1 from public.characters c
    where c.id = source_character_id and c.author_id = (select auth.uid())
  )
  and exists (
    select 1 from public.characters c
    where c.id = target_character_id and c.author_id = (select auth.uid())
  )
);

create policy character_relations_update_owner
on public.character_relations for update to authenticated
using (author_id = (select auth.uid()) or public.is_staff())
with check (author_id = (select auth.uid()) or public.is_staff());

create policy character_relations_delete_owner
on public.character_relations for delete to authenticated
using (author_id = (select auth.uid()) or public.is_staff());

create policy world_board_items_read_owner
on public.world_board_items for select to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy world_board_items_insert_owner
on public.world_board_items for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_author()
  and (public.owns_work(work_id) or public.is_staff())
);

create policy world_board_items_update_owner
on public.world_board_items for update to authenticated
using (public.owns_work(work_id) or public.is_staff())
with check (public.owns_work(work_id) or public.is_staff());

create policy world_board_items_delete_owner
on public.world_board_items for delete to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy map_markers_read_owner
on public.map_markers for select to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy map_markers_insert_owner
on public.map_markers for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_author()
  and (public.owns_work(work_id) or public.is_staff())
);

create policy map_markers_update_owner
on public.map_markers for update to authenticated
using (public.owns_work(work_id) or public.is_staff())
with check (public.owns_work(work_id) or public.is_staff());

create policy map_markers_delete_owner
on public.map_markers for delete to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy canvas_items_read_owner
on public.canvas_items for select to authenticated
using (public.owns_work(work_id) or public.is_staff());

create policy canvas_items_insert_owner
on public.canvas_items for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_author()
  and (public.owns_work(work_id) or public.is_staff())
);

create policy canvas_items_update_owner
on public.canvas_items for update to authenticated
using (public.owns_work(work_id) or public.is_staff())
with check (public.owns_work(work_id) or public.is_staff());

create policy canvas_items_delete_owner
on public.canvas_items for delete to authenticated
using (public.owns_work(work_id) or public.is_staff());

-- Tables accessed through a view or an RPC still require SQL privileges.
grant usage on schema public to anon, authenticated;

grant select on
  public.profiles,
  public.fandoms,
  public.works,
  public.chapters,
  public.tags,
  public.work_tags,
  public.comments,
  public.works_full
  to anon, authenticated;

grant insert, update, delete on
  public.profiles,
  public.fandoms,
  public.works,
  public.chapters,
  public.chapter_versions,
  public.chapter_progress,
  public.bookmarks,
  public.tags,
  public.work_tags,
  public.work_likes,
  public.comments,
  public.comment_likes,
  public.comment_reports,
  public.notifications,
  public.follows,
  public.characters,
  public.character_badges,
  public.character_abilities,
  public.character_relations,
  public.world_board_items,
  public.map_markers,
  public.canvas_items
  to authenticated;

-- Counters and moderation fields are maintained by trusted triggers/RPCs.
-- Limit direct writes to the fields used by the current client.
revoke insert on table public.works, public.chapters, public.comments from authenticated;
grant insert (
  author_id, fandom_id, title, summary, description, cover_url, category, rating,
  status, visibility, language, warn_violence, warn_death, warn_noncon,
  warn_underage, warn_other
) on public.works to authenticated;
grant insert (
  work_id, author_id, chapter_number, title, content, content_text, words_count,
  status, author_note_before, author_note_after
) on public.chapters to authenticated;
grant insert (
  work_id, chapter_id, author_id, parent_id, content, quoted_text
) on public.comments to authenticated;

revoke update on table
  public.works,
  public.chapters,
  public.comments,
  public.notifications,
  public.tags,
  public.work_tags
  from authenticated;
grant update (title, summary, description, status, visibility, rating)
  on public.works to authenticated;
grant update (
  title, content, content_text, words_count, status,
  scheduled_at, author_note_before, author_note_after
) on public.chapters to authenticated;
grant update (is_read) on public.notifications to authenticated;

grant select on
  public.chapter_versions,
  public.chapter_progress,
  public.bookmarks,
  public.work_likes,
  public.comment_likes,
  public.comment_reports,
  public.notifications,
  public.follows,
  public.characters,
  public.character_badges,
  public.character_abilities,
  public.character_relations,
  public.world_board_items,
  public.map_markers,
  public.canvas_items
  to authenticated;

grant select on public.works_full to anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_author() to authenticated;
grant execute on function public.owns_work(uuid) to anon, authenticated;
grant execute on function public.is_viewable_work(uuid) to anon, authenticated;
grant execute on function public.search_works(text, text, text, integer) to anon, authenticated;
grant execute on function public.increment_views(uuid, uuid) to anon, authenticated;
grant execute on function public.toggle_bookmark(uuid, text) to authenticated;
grant execute on function public.toggle_work_like(uuid) to authenticated;
grant execute on function public.toggle_comment_like(uuid) to authenticated;
grant execute on function public.get_author_stats(uuid, text) to authenticated;
grant execute on function public.get_author_activity(uuid, integer) to authenticated;

revoke all on table public.work_view_events from anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.refresh_fandom_works_count(uuid) from public, anon, authenticated;
revoke all on function public.refresh_work_chapter_stats(uuid) from public, anon, authenticated;
revoke all on function public.refresh_work_comment_count(uuid) from public, anon, authenticated;
revoke all on function public.refresh_comment_replies_count(uuid) from public, anon, authenticated;

-- Supabase Realtime publication is available on hosted Supabase projects.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      execute 'alter publication supabase_realtime add table public.notifications';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'comments'
    ) then
      execute 'alter publication supabase_realtime add table public.comments';
    end if;
  end if;
end;
$$;
