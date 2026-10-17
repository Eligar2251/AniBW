-- AniScript / AniBW application schema.
-- Apply with `supabase db push` (or the Supabase SQL editor in migration order).

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  role text not null default 'user'
    check (role in ('user', 'author', 'moderator', 'admin')),
  is_adult boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username = lower(username)
    and char_length(username) between 3 and 30
    and username ~ '^[a-z0-9_]+$'
  ),
  constraint profiles_username_unique unique (username)
);

create table public.fandoms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ru text,
  slug text not null unique,
  description text,
  cover_url text,
  works_count integer not null default 0 check (works_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fandoms_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9-]+$')
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  fandom_id uuid references public.fandoms (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  summary text check (summary is null or char_length(summary) <= 500),
  description text check (description is null or char_length(description) <= 10000),
  cover_url text,
  category text not null default 'gen'
    check (category in ('gen', 'het', 'slash', 'femslash', 'multi')),
  rating text not null default 'PG'
    check (rating in ('G', 'PG', 'PG-13', 'R', 'NC-17')),
  status text not null default 'draft'
    check (status in ('draft', 'ongoing', 'completed', 'frozen', 'hiatus')),
  visibility text not null default 'draft'
    check (visibility in ('draft', 'unlisted', 'public')),
  language text not null default 'ru',
  warn_violence boolean not null default false,
  warn_death boolean not null default false,
  warn_noncon boolean not null default false,
  warn_underage boolean not null default false,
  warn_other text,
  views_count bigint not null default 0 check (views_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  comments_count bigint not null default 0 check (comments_count >= 0),
  chapters_count integer not null default 0 check (chapters_count >= 0),
  words_count bigint not null default 0 check (words_count >= 0),
  first_published_at timestamptz,
  last_chapter_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  title text not null default 'Новая глава'
    check (char_length(btrim(title)) between 1 and 200),
  content text not null default '',
  content_text text not null default '',
  words_count integer not null default 0 check (words_count >= 0),
  views_count bigint not null default 0 check (views_count >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'scheduled')),
  is_paid boolean not null default false,
  author_note_before text,
  author_note_after text,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapters_work_number_unique unique (work_id, chapter_number)
);

create table public.chapter_versions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null,
  words_count integer not null default 0 check (words_count >= 0),
  save_type text not null default 'manual' check (save_type in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create table public.chapter_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  scroll_position numeric(6, 5) not null default 0
    check (scroll_position between 0 and 1),
  is_completed boolean not null default false,
  last_read_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  folder text not null default 'reading'
    check (folder in ('reading', 'completed', 'want_to_read', 'dropped')),
  added_at timestamptz not null default now(),
  constraint bookmarks_user_work_folder_unique unique (user_id, work_id, folder)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name = lower(name) and char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.work_tags (
  work_id uuid not null references public.works (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_id, tag_id)
);

create table public.work_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  quoted_text text,
  is_hidden boolean not null default false,
  is_pinned boolean not null default false,
  likes_count integer not null default 0 check (likes_count >= 0),
  replies_count integer not null default 0 check (replies_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comment_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint comment_reports_one_per_user unique (reporter_id, comment_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (
    type in ('comment', 'reply', 'like', 'new_follower', 'new_chapter', 'achievement', 'system')
  ),
  body text not null,
  work_id uuid references public.works (id) on delete set null,
  chapter_id uuid references public.chapters (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create table public.work_view_events (
  id bigint generated always as identity primary key,
  work_id uuid not null references public.works (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  viewer_id uuid references public.profiles (id) on delete set null,
  viewed_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid references public.works (id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 200),
  nickname text,
  role text not null default 'supporting'
    check (role in ('protagonist', 'antagonist', 'supporting', 'minor', 'mentioned')),
  age text,
  gender text,
  pronouns text,
  species text,
  affiliation text,
  height text,
  weight text,
  body_type text,
  hair_color text,
  eye_color text,
  skin_tone text,
  distinctive_features text,
  mbti text check (mbti is null or mbti in (
    'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'
  )),
  hogwarts_house text,
  backstory text,
  goals text,
  motivation text,
  fears text,
  secrets text,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  primary_color text not null default '#6366F1',
  speech_color text not null default '#F59E0B',
  is_oc boolean not null default false,
  avatar_url text,
  avatar_scale numeric(5, 3) not null default 1 check (avatar_scale between 0.25 and 5),
  avatar_offset_x numeric(6, 2) not null default 50,
  avatar_offset_y numeric(6, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.character_badges (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  color text not null default '#6366F1',
  icon text,
  category text not null default 'custom'
    check (category in ('archetype', 'role', 'trait', 'hobby', 'custom')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.character_abilities (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  level integer not null default 5 check (level between 1 and 10),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.character_relations (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  source_character_id uuid not null references public.characters (id) on delete cascade,
  target_character_id uuid not null references public.characters (id) on delete cascade,
  relation_type text not null default 'ally'
    check (relation_type in ('ally', 'enemy', 'love', 'family', 'rival', 'mentor', 'unknown')),
  label text not null default '',
  color text not null default '#6B7280',
  created_at timestamptz not null default now(),
  constraint character_relations_distinct_characters check (source_character_id <> target_character_id),
  constraint character_relations_unique_pair unique (work_id, source_character_id, target_character_id)
);

create table public.world_board_items (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('timeline_event', 'note', 'lore_page')),
  title text not null default 'Новый элемент',
  content text not null default '',
  color text not null default '#F0A830',
  timeline_date text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.map_markers (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Новая метка',
  description text not null default '',
  pos_x numeric(5, 2) not null default 50 check (pos_x between 0 and 100),
  pos_y numeric(5, 2) not null default 50 check (pos_y between 0 and 100),
  color text not null default '#E8354A',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.canvas_items (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  item_type text not null check (item_type in ('sticky', 'text', 'image')),
  title text not null default '',
  content text not null default '',
  color text not null default '',
  image_url text,
  pos_x double precision not null default 100,
  pos_y double precision not null default 100,
  width double precision not null default 200 check (width > 0),
  height double precision not null default 100 check (height > 0),
  z_index integer not null default 0,
  font_size integer not null default 14 check (font_size between 6 and 200),
  font_color text not null default '#F0EDE8',
  font_family text not null default 'var(--font-ui)',
  bold boolean not null default false,
  italic boolean not null default false,
  stroke_width integer not null default 0 check (stroke_width between 0 and 20),
  stroke_color text not null default '#000000',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index works_author_updated_idx on public.works (author_id, updated_at desc);
create index works_public_popular_idx on public.works (visibility, status, views_count desc);
create index works_fandom_idx on public.works (fandom_id, visibility, status);
create index works_last_chapter_idx on public.works (last_chapter_at desc nulls last);
create index works_created_idx on public.works (created_at desc);
create index chapters_work_status_number_idx on public.chapters (work_id, status, chapter_number);
create index chapters_author_idx on public.chapters (author_id, updated_at desc);
create index chapter_versions_chapter_created_idx on public.chapter_versions (chapter_id, created_at desc);
create index chapter_progress_user_work_idx on public.chapter_progress (user_id, work_id, last_read_at desc);
create index bookmarks_user_folder_added_idx on public.bookmarks (user_id, folder, added_at desc);
create index work_tags_tag_work_idx on public.work_tags (tag_id, work_id);
create index comments_work_created_idx on public.comments (work_id, created_at desc);
create index comments_chapter_created_idx on public.comments (chapter_id, created_at desc);
create index comments_parent_created_idx on public.comments (parent_id, created_at);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index work_likes_work_created_idx on public.work_likes (work_id, created_at desc);
create index follows_following_idx on public.follows (following_id, created_at desc);
create index work_view_events_work_time_idx on public.work_view_events (work_id, viewed_at desc);
create index work_view_events_chapter_time_idx on public.work_view_events (chapter_id, viewed_at desc);
create index characters_author_created_idx on public.characters (author_id, created_at desc);
create index characters_work_idx on public.characters (work_id, full_name);
create index world_board_items_work_type_order_idx on public.world_board_items (work_id, type, sort_order);
create index map_markers_work_idx on public.map_markers (work_id, created_at);
create index canvas_items_work_z_idx on public.canvas_items (work_id, z_index);
