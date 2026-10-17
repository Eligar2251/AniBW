-- Persistent terrain, texture atlas and named city markers for the 2D/3D map builder.

alter table public.world_map_settings
  add column map_state jsonb not null default '{}'::jsonb,
  add constraint world_map_settings_map_state_object
    check (jsonb_typeof(map_state) = 'object');

comment on column public.world_map_settings.map_state is
  'Serializable 2D/3D map: dimensions, freehand terrain and wall strokes, texture atlas crops, object stamps, country boundaries, and named settlements.';

grant select (work_id, background_url, is_published, updated_at, map_state)
  on public.world_map_settings to anon, authenticated;
grant insert (work_id, background_url, is_published, map_state)
  on public.world_map_settings to authenticated;
grant update (work_id, background_url, is_published, map_state)
  on public.world_map_settings to authenticated;
