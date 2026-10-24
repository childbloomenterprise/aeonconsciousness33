begin;
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  preferred_language text not null default 'en',
  -- Collected by the self-serve signup questionnaire. Non-clinical account facts,
  -- so they are not gated behind health-storage consent.
  sex text check (sex in ('male','female')),
  date_of_birth date check (date_of_birth between date '1900-01-01' and date '2100-01-01'),
  interests text[] not null default '{}',
  dietary_preference text check (dietary_preference in ('vegetarian','non_vegetarian','vegan','pescatarian','no_preference')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.consent_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('sensitive_storage', 'external_ai')),
  policy_version text not null default '2026-10-10', granted_at timestamptz not null default now(), revoked_at timestamptz
);
create unique index one_active_consent on public.consent_records(user_id, consent_type) where revoked_at is null;
create table public.health_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_range text check (age_range in ('18–29', '30–44', '45–59', '60+')),
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  allergies text[] not null default '{}', medical_conditions text[] not null default '{}', current_medications text[] not null default '{}',
  consent_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, relationship text not null default '', phone text not null,
  unique(user_id)
);
create table public.journeys (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120), destination_name text not null check (length(destination_name) between 1 and 160),
  destination_place_id text, started_at timestamptz not null, ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed')), created_at timestamptz not null default now(),
  unique(id,user_id), check (ended_at is null or ended_at >= started_at)
);
create unique index one_active_journey on public.journeys(user_id) where status='active';
create table public.conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid, title text not null default 'A conversation', summary text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
  foreign key(journey_id,user_id) references public.journeys(id,user_id) on delete cascade
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')), content text not null check (length(content)<=6000), result jsonb,
  created_at timestamptz not null default now(), unique(id,user_id),
  foreign key(conversation_id,user_id) references public.conversations(id,user_id) on delete cascade
);
create table public.journey_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, journey_id uuid not null,
  event_type text not null check (event_type in ('meal','symptom','activity','medication_report','hydration','note')),
  title text not null check (length(title) between 1 and 160), description text check (length(description)<=2000),
  occurred_at timestamptz, time_text text, timezone text not null default 'Asia/Kolkata',
  location_lat double precision check (location_lat between -90 and 90), location_lng double precision check (location_lng between -180 and 180), location_name text,
  metadata_json jsonb not null default '{}', confidence double precision not null default 1 check (confidence between 0 and 1), source_message_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(journey_id,user_id) references public.journeys(id,user_id) on delete cascade,
  foreign key(source_message_id,user_id) references public.messages(id,user_id) on delete cascade
);
create table public.medical_knowledge (
  id text primary key, topic text not null, source_title text not null, source_organization text not null, source_url text not null,
  source_date date, verified_at timestamptz, license_status text not null, review_status text not null,
  summary text not null, warning_signs_json jsonb not null default '[]'
);
create table public.request_records (
  user_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null, result jsonb not null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  journey_id uuid references public.journeys(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,request_id)
);
create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, period timestamptz not null, count integer not null default 0, primary key(user_id,kind,period)
);
create index journeys_user_created on public.journeys(user_id,created_at desc);
create index events_user_time on public.journey_events(user_id,occurred_at desc);
create index events_journey_time on public.journey_events(journey_id,created_at desc);
create index messages_conversation_time on public.messages(conversation_id,created_at);
create index conversations_user_time on public.conversations(user_id,updated_at desc);

create function public.has_storage_consent() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(select 1 from public.consent_records where user_id=auth.uid() and consent_type='sensitive_storage' and revoked_at is null);
$$;

alter table public.profiles enable row level security;
alter table public.health_profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_events enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.medical_knowledge enable row level security;
alter table public.consent_records enable row level security;
alter table public.request_records enable row level security;
alter table public.usage_counters enable row level security;

create policy own_profile on public.profiles for all to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy own_journey on public.journeys for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy own_health_read on public.health_profiles for select to authenticated using(user_id=auth.uid());
create policy own_health_write on public.health_profiles for insert to authenticated with check(user_id=auth.uid() and public.has_storage_consent());
create policy own_health_update on public.health_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and public.has_storage_consent());
create policy own_health_delete on public.health_profiles for delete to authenticated using(user_id=auth.uid());
create policy own_contact_read on public.emergency_contacts for select to authenticated using(user_id=auth.uid());
create policy own_contact_write on public.emergency_contacts for insert to authenticated with check(user_id=auth.uid() and public.has_storage_consent());
create policy own_contact_update on public.emergency_contacts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and public.has_storage_consent());
create policy own_contact_delete on public.emergency_contacts for delete to authenticated using(user_id=auth.uid());
create policy own_events_read on public.journey_events for select to authenticated using(user_id=auth.uid());
create policy own_events_write on public.journey_events for insert to authenticated with check(user_id=auth.uid() and public.has_storage_consent());
create policy own_events_update on public.journey_events for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and public.has_storage_consent());
create policy own_events_delete on public.journey_events for delete to authenticated using(user_id=auth.uid());
create policy own_conversations_read on public.conversations for select to authenticated using(user_id=auth.uid());
create policy own_conversations_delete on public.conversations for delete to authenticated using(user_id=auth.uid());
create policy own_messages_read on public.messages for select to authenticated using(user_id=auth.uid());
create policy own_consent_read on public.consent_records for select to authenticated using(user_id=auth.uid());
create policy own_requests_read on public.request_records for select to authenticated using(user_id=auth.uid());
create policy own_requests_delete on public.request_records for delete to authenticated using(user_id=auth.uid());
create policy own_usage_read on public.usage_counters for select to authenticated using(user_id=auth.uid());
create policy public_knowledge on public.medical_knowledge for select to anon,authenticated using(review_status='source_verified');

-- Explicit privileges make fresh project behavior independent of default table grants.
revoke all on public.profiles,public.health_profiles,public.emergency_contacts,public.journeys,public.journey_events,public.conversations,public.messages,public.consent_records,public.request_records,public.usage_counters from anon;
grant select,insert,update,delete on public.profiles,public.health_profiles,public.emergency_contacts,public.journeys,public.journey_events,public.conversations,public.messages,public.consent_records,public.request_records,public.usage_counters to authenticated;
grant select on public.medical_knowledge to anon,authenticated;

create function public.set_consent(p_type text,p_granted boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
begin
  if u is null or p_type not in ('sensitive_storage','external_ai') then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_type,0));
  if p_granted then
    insert into consent_records(user_id,consent_type) values(u,p_type) on conflict(user_id,consent_type) where revoked_at is null do nothing;
  else
    update consent_records set revoked_at=now() where user_id=u and consent_type=p_type and revoked_at is null;
  end if;
  return jsonb_build_object('success',true);
end $$;

create function public.start_journey(p_title text,p_destination text,p_started timestamptz,p_ended timestamptz) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); result jsonb;
begin
  if u is null then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  update journeys set status='completed' where user_id=u and status='active';
  insert into journeys(user_id,title,destination_name,started_at,ended_at) values(u,p_title,p_destination,p_started,p_ended) returning to_jsonb(journeys.*) into result;
  return result;
end $$;
create function public.set_journey_status(p_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); result jsonb;
begin
  if u is null or p_status not in ('active','completed') or not exists(select 1 from journeys where id=p_id and user_id=u) then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if p_status='active' then update journeys set status='completed' where user_id=u and status='active'; end if;
  update journeys set status=p_status where id=p_id and user_id=u returning to_jsonb(journeys.*) into result;
  return result;
end $$;

create function public.consume_usage(p_kind text,p_daily_limit integer) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); hard integer; per_min integer; day_slot timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'; minute_slot timestamptz:=date_trunc('minute',now()); n integer;
begin
  if u is null then raise exception 'Unauthorized'; end if;
  hard:=case p_kind when 'ai' then 30 when 'audio' then 10 when 'places' then 20 else null end;
  per_min:=case p_kind when 'ai' then 5 when 'audio' then 3 when 'places' then 10 else null end;
  if hard is null then raise exception 'Invalid kind'; end if;
  hard:=least(hard,greatest(1,p_daily_limit));
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_kind,0));
  insert into usage_counters(user_id,kind,period) values(u,p_kind||'_day',day_slot),(u,p_kind||'_minute',minute_slot) on conflict do nothing;
  select count into n from usage_counters where user_id=u and kind=p_kind||'_day' and period=day_slot;
  if n>=hard then return false; end if;
  select count into n from usage_counters where user_id=u and kind=p_kind||'_minute' and period=minute_slot;
  if n>=per_min then return false; end if;
  update usage_counters set count=count+1 where user_id=u and ((kind=p_kind||'_day' and period=day_slot) or (kind=p_kind||'_minute' and period=minute_slot));
  delete from usage_counters where user_id=u and period<now()-interval '2 days';
  return true;
end $$;

create function public.persist_chat_turn(p_request_id uuid,p_conversation_id uuid,p_journey_id uuid,p_text text,p_result jsonb,p_events jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); cid uuid:=p_conversation_id; mid uuid; eid uuid; item jsonb; result jsonb:=p_result; saved jsonb:='[]'; previous jsonb;
begin
  if u is null or not public.has_storage_consent() then raise exception 'Consent required'; end if;
  if length(p_text)>4000 or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>6 then raise exception 'Invalid turn'; end if;
  if p_journey_id is not null and not exists(select 1 from journeys where id=p_journey_id and user_id=u) then raise exception 'Unauthorized journey'; end if;
  if cid is not null and not exists(select 1 from conversations where id=cid and user_id=u and journey_id is not distinct from p_journey_id) then raise exception 'Unauthorized conversation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
  select request_records.result into previous from request_records where user_id=u and request_id=p_request_id;
  if previous is not null then return previous; end if;
  if cid is null then
    insert into conversations(user_id,journey_id,title) values(u,p_journey_id,left(p_text,70)) returning id into cid;
  end if;
  insert into messages(conversation_id,user_id,role,content) values(cid,u,'user',p_text) returning id into mid;
  for item in select value from jsonb_array_elements(p_events) loop
    if p_journey_id is null then raise exception 'Journey required'; end if;
    insert into journey_events(user_id,journey_id,event_type,title,description,occurred_at,time_text,timezone,location_name,metadata_json,confidence,source_message_id)
      values(u,p_journey_id,item->>'event_type',item->>'title',item->>'description',nullif(item->>'occurred_at','')::timestamptz,item->>'time_text',coalesce(item->>'timezone','Asia/Kolkata'),item->>'location_name',coalesce(item->'metadata_json','{}'),coalesce((item->>'confidence')::float,1),mid)
      returning id into eid;
    saved:=saved||jsonb_build_array(jsonb_build_object('status','saved','event',item||jsonb_build_object('id',eid)));
  end loop;
  result:=jsonb_set(result,'{events}',coalesce(result->'events','[]')||saved);
  result:=jsonb_set(result,'{conversation_id}',to_jsonb(cid));
  if jsonb_array_length(saved)>0 then result:=jsonb_set(result,'{reply}',to_jsonb('Added to your journey. '||coalesce(result->>'reply',''))); end if;
  insert into messages(conversation_id,user_id,role,content,result) values(cid,u,'assistant',result->>'reply',result);
  update conversations set updated_at=now() where id=cid;
  insert into request_records(user_id,request_id,result,conversation_id,journey_id) values(u,p_request_id,result,cid,p_journey_id);
  return result;
end $$;

create function public.create_manual_event(p_request_id uuid,p_journey_id uuid,p_event jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); result jsonb;
begin
  if u is null or not public.has_storage_consent() or not exists(select 1 from journeys where id=p_journey_id and user_id=u) then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
  select request_records.result into result from request_records where user_id=u and request_id=p_request_id;
  if result is not null then return result; end if;
  insert into journey_events(user_id,journey_id,event_type,title,description,occurred_at,time_text,timezone,location_name,metadata_json,confidence)
    values(u,p_journey_id,p_event->>'event_type',p_event->>'title',p_event->>'description',nullif(p_event->>'occurred_at','')::timestamptz,p_event->>'time_text',coalesce(p_event->>'timezone','Asia/Kolkata'),p_event->>'location_name',coalesce(p_event->'metadata_json','{}'),coalesce((p_event->>'confidence')::float,1))
    returning to_jsonb(journey_events.*) into result;
  insert into request_records(user_id,request_id,result,journey_id) values(u,p_request_id,result,p_journey_id);
  return result;
end $$;

create function public.save_health_profile(p_profile jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); contact jsonb:=p_profile->'emergency_contact';
begin
  if u is null or not public.has_storage_consent() then raise exception 'Consent required'; end if;
  insert into profiles(id,display_name) values(u,coalesce(p_profile->>'display_name','')) on conflict(id) do update set display_name=excluded.display_name,updated_at=now();
  insert into health_profiles(user_id,age_range,blood_group,allergies,medical_conditions,current_medications)
    values(u,p_profile->>'age_range',p_profile->>'blood_group',array(select jsonb_array_elements_text(p_profile->'allergies')),array(select jsonb_array_elements_text(p_profile->'medical_conditions')),array(select jsonb_array_elements_text(p_profile->'current_medications')))
    on conflict(user_id) do update set age_range=excluded.age_range,blood_group=excluded.blood_group,allergies=excluded.allergies,medical_conditions=excluded.medical_conditions,current_medications=excluded.current_medications,updated_at=now();
  delete from emergency_contacts where user_id=u;
  if contact is not null and contact<>'null'::jsonb then insert into emergency_contacts(user_id,name,phone,relationship) values(u,contact->>'name',contact->>'phone',contact->>'relationship'); end if;
  return jsonb_build_object('success',true);
end $$;

create function public.delete_health_profile() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  delete from health_profiles where user_id=auth.uid();
  delete from emergency_contacts where user_id=auth.uid();
  return jsonb_build_object('success',true);
end $$;
revoke all on function public.delete_health_profile() from public,anon;
grant execute on function public.delete_health_profile() to authenticated;

-- Self-serve signup questionnaire. Account facts are always stored; allergies and
-- the emergency contact are only written when the caller granted private-storage
-- consent in the same transaction, so the consent gate is never bypassed.
create function public.save_signup_profile(p_profile jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
  dob date:=nullif(p_profile->>'date_of_birth','')::date;
  storage_consent boolean:=coalesce((p_profile->>'storage_consent')::boolean,false);
  ai_consent boolean:=coalesce((p_profile->>'ai_consent')::boolean,false);
  years integer; bucket text; contact jsonb:=p_profile->'emergency_contact';
begin
  if u is null then raise exception 'Unauthorized'; end if;
  if dob is null then raise exception 'Date of birth required'; end if;
  if dob > (current_date - interval '18 years') then raise exception 'Adults only'; end if;
  years:=extract(year from age(dob))::integer;
  bucket:=case when years<30 then '18–29' when years<45 then '30–44' when years<60 then '45–59' else '60+' end;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  insert into profiles(id,display_name,sex,date_of_birth,interests,dietary_preference,onboarded_at)
    values(u,left(coalesce(p_profile->>'display_name',''),100),nullif(p_profile->>'sex',''),dob,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_profile->'interests','[]'::jsonb))),'{}'),
      nullif(p_profile->>'dietary_preference',''),now())
    on conflict(id) do update set display_name=excluded.display_name,sex=excluded.sex,date_of_birth=excluded.date_of_birth,
      interests=excluded.interests,dietary_preference=excluded.dietary_preference,onboarded_at=excluded.onboarded_at,updated_at=now();
  if ai_consent then
    insert into consent_records(user_id,consent_type) values(u,'external_ai')
      on conflict(user_id,consent_type) where revoked_at is null do nothing;
  end if;
  if storage_consent then
    insert into consent_records(user_id,consent_type) values(u,'sensitive_storage')
      on conflict(user_id,consent_type) where revoked_at is null do nothing;
    insert into health_profiles(user_id,age_range,allergies)
      values(u,bucket,coalesce(array(select jsonb_array_elements_text(coalesce(p_profile->'allergies','[]'::jsonb))),'{}'))
      on conflict(user_id) do update set age_range=excluded.age_range,allergies=excluded.allergies,updated_at=now();
    if contact is not null and contact<>'null'::jsonb and nullif(contact->>'phone','') is not null then
      insert into emergency_contacts(user_id,name,phone,relationship)
        values(u,coalesce(contact->>'name',''),contact->>'phone',coalesce(contact->>'relationship',''))
        on conflict(user_id) do update set name=excluded.name,phone=excluded.phone,relationship=excluded.relationship;
    end if;
  end if;
  return jsonb_build_object('success',true,'storage_saved',storage_consent,'age_range',bucket);
end $$;
revoke all on function public.save_signup_profile(jsonb) from public,anon;
grant execute on function public.save_signup_profile(jsonb) to authenticated;

-- Revoke default PUBLIC execution explicitly. All privileged RPCs derive identity from auth.uid().
revoke all on function public.has_storage_consent() from public,anon;
revoke all on function public.set_consent(text,boolean) from public,anon;
revoke all on function public.start_journey(text,text,timestamptz,timestamptz) from public,anon;
revoke all on function public.set_journey_status(uuid,text) from public,anon;
revoke all on function public.consume_usage(text,integer) from public,anon;
revoke all on function public.persist_chat_turn(uuid,uuid,uuid,text,jsonb,jsonb) from public,anon;
revoke all on function public.create_manual_event(uuid,uuid,jsonb) from public,anon;
revoke all on function public.save_health_profile(jsonb) from public,anon;
grant execute on function public.has_storage_consent(),public.set_consent(text,boolean),public.start_journey(text,text,timestamptz,timestamptz),public.set_journey_status(uuid,text),public.consume_usage(text,integer),public.persist_chat_turn(uuid,uuid,uuid,text,jsonb,jsonb),public.create_manual_event(uuid,uuid,jsonb),public.save_health_profile(jsonb),public.save_signup_profile(jsonb) to authenticated;

insert into medical_knowledge(id,topic,source_title,source_organization,source_url,verified_at,license_status,review_status,summary) values
('foodborne','Foodborne symptoms','Food Poisoning Symptoms','CDC','https://www.cdc.gov/food-safety/signs-symptoms/index.html','2026-10-10','Original linked summary; no third-party material','source_verified','Foodborne symptoms have multiple causes and onset times. Timing alone does not identify the cause. Consult the linked guidance for warning signs.'),
('hydration','Hydration','Travelers’ Diarrhea — Oral rehydration','CDC Yellow Book','https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/travelers-diarrhea.html','2026-10-10','Original linked summary; medication regimens excluded','source_verified','General guidance discusses fluid losses, safe water and packaged oral rehydration salts prepared according to their label.'),
('travel-diarrhea','Travelers’ diarrhea','Travelers’ Diarrhea','CDC Yellow Book','https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/travelers-diarrhea.html','2026-10-10','Original linked summary','source_verified','Travel-related stomach symptoms can have multiple causes. This app does not identify pathogens or recommend prescription treatments.');
commit;
