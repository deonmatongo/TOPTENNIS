-- Add explicit FK constraints so PostgREST can resolve profiles joins from match_invites
ALTER TABLE public.match_invites
  DROP CONSTRAINT IF EXISTS match_invites_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS match_invites_receiver_id_fkey;

ALTER TABLE public.match_invites
  ADD CONSTRAINT match_invites_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.match_invites
  ADD CONSTRAINT match_invites_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
