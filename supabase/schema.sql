-- 单词默写 · 云同步数据库结构（Supabase）
-- 用法：Supabase Dashboard → SQL Editor → 新建查询 → 粘贴整段 → Run。
-- 设计：前端只通过两个 RPC 读写，表本身禁止匿名直接访问；
--       每个同步码对应一份完整快照，revision 用于防止并发覆盖。

create table if not exists public.vocab_sync (
  code text primary key,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint vocab_sync_code_len check (char_length(code) between 16 and 128)
);

alter table public.vocab_sync enable row level security;
revoke all on table public.vocab_sync from anon, authenticated;

create or replace function public.vocab_sync_get(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'payload', payload,
    'revision', revision,
    'updatedAt', updated_at
  )
  from public.vocab_sync
  where code = p_code;
$$;

create or replace function public.vocab_sync_put(
  p_code text,
  p_payload jsonb,
  p_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.vocab_sync%rowtype;
begin
  if p_code is null or char_length(p_code) < 16 then
    raise exception 'invalid sync code' using errcode = '22023';
  end if;
  if p_payload is null then
    raise exception 'payload required' using errcode = '22023';
  end if;

  insert into public.vocab_sync as t (code, payload)
  values (p_code, p_payload)
  on conflict (code) do update
    set payload = excluded.payload,
        revision = t.revision + 1,
        updated_at = now()
    where t.revision = p_revision
  returning * into v_row;

  if v_row.code is null then
    raise exception 'revision conflict' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'payload', v_row.payload,
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.vocab_sync_get(text) from public;
revoke all on function public.vocab_sync_put(text, jsonb, bigint) from public;
grant execute on function public.vocab_sync_get(text) to anon, authenticated;
grant execute on function public.vocab_sync_put(text, jsonb, bigint) to anon, authenticated;
