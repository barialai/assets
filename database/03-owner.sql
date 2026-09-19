-- Create ONE owner in Supabase Authentication > Users (email + strong password).
-- Disable public sign-ups. Replace the UUID below with that user's real User ID.
-- The same UUID goes in Vercel's VAULT_OWNER_ID environment variable.
-- DO NOT run this example unchanged.
insert into public.vault_allowed_users(user_id)
values ('REPLACE-WITH-YOUR-REAL-USER-UUID'::uuid)
on conflict(user_id) do nothing;
-- Never store passwords, tokens, private keys or personal backups in this file.
