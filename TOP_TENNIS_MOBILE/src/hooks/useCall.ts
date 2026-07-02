import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined' | 'missed';

export interface Call {
  id: string;
  room_id: string;
  caller_id: string;
  callee_id: string | null;
  conversation_id: string | null;
  call_type: CallType;
  is_group: boolean;
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  caller_name?: string;
  caller_avatar?: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchLivekitToken(roomName: string, participantName: string, session: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/livekit-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ roomName, participantName }),
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const { token } = await res.json();
  return token as string;
}

export const useCall = () => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'calls',
        filter: `callee_id=eq.${user.id}`,
      }, async (payload) => {
        const call = payload.new as Call;
        if (call.status !== 'ringing') return;

        // Fetch caller name
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, profile_picture_url')
          .eq('id', call.caller_id)
          .single();

        setIncomingCall({
          ...call,
          caller_name: profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : 'Unknown',
          caller_avatar: profile?.profile_picture_url ?? undefined,
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `callee_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as Call;
        if (updated.status === 'declined' || updated.status === 'ended' || updated.status === 'missed') {
          setIncomingCall(prev => prev?.id === updated.id ? null : prev);
          setActiveCall(prev => prev?.id === updated.id ? null : prev);
          setLivekitToken(null);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `caller_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as Call;
        if (updated.status === 'declined' || updated.status === 'ended' || updated.status === 'missed') {
          setActiveCall(prev => prev?.id === updated.id ? null : prev);
          setLivekitToken(null);
        }
        if (updated.status === 'active') {
          setActiveCall(prev => prev?.id === updated.id ? { ...prev!, status: 'active' } : prev);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Polling fallback ─────────────────────────────────────────────────────
  // Realtime on `calls` requires the backend alignment migration (the table
  // isn't in the supabase_realtime publication until then). Poll as a safety
  // net so ringing works either way; realtime remains the fast path.
  const incomingRef = useRef<Call | null>(null);
  const activeRef = useRef<Call | null>(null);
  incomingRef.current = incomingCall;
  activeRef.current = activeCall;

  useEffect(() => {
    if (!user) return;
    const RING_WINDOW_MS = 60_000;   // how fresh a ringing call must be
    const CALLER_TIMEOUT_MS = 45_000; // give up ringing after this

    const tick = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const active = activeRef.current;
        const incoming = incomingRef.current;

        if (active) {
          const { data } = await supabase.from('calls').select('*').eq('id', active.id).single();
          if (!data) return;
          if (['declined', 'ended', 'missed'].includes(data.status)) {
            setActiveCall(null);
            setLivekitToken(null);
          } else if (data.status === 'active' && active.status !== 'active') {
            setActiveCall(prev => (prev ? { ...prev, status: 'active' } : prev));
          } else if (
            data.status === 'ringing' &&
            Date.now() - new Date(data.created_at).getTime() > CALLER_TIMEOUT_MS
          ) {
            // Nobody picked up — stop ringing on both ends
            await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', active.id);
            setActiveCall(null);
            setLivekitToken(null);
          }
          return;
        }

        if (incoming) {
          const { data } = await supabase.from('calls').select('*').eq('id', incoming.id).single();
          if (!data || data.status !== 'ringing') setIncomingCall(null);
          return;
        }

        // Look for a fresh ringing call addressed to me
        const since = new Date(Date.now() - RING_WINDOW_MS).toISOString();
        const { data: rows } = await supabase
          .from('calls')
          .select('*')
          .eq('callee_id', user.id)
          .eq('status', 'ringing')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1);
        const call = rows?.[0] as Call | undefined;
        if (!call) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, profile_picture_url')
          .eq('id', call.caller_id)
          .single();
        setIncomingCall({
          ...call,
          caller_name: profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : 'Unknown',
          caller_avatar: profile?.profile_picture_url ?? undefined,
        });
      } catch {
        // network hiccup — try again next tick
      }
    };

    const iv = setInterval(tick, 4000);
    tick();
    return () => clearInterval(iv);
  }, [user]);

  const startCall = useCallback(async (
    calleeId: string,
    type: CallType,
    conversationId?: string,
    isGroup = false,
  ) => {
    if (!user) throw new Error('Not authenticated');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();
    const callerName = callerProfile
      ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim()
      : user.email || 'Player';

    const roomId = conversationId
      ? `conv_${conversationId}`
      : `dm_${[user.id, calleeId].sort().join('_')}`;

    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        room_id: roomId,
        caller_id: user.id,
        callee_id: isGroup ? null : calleeId,
        conversation_id: conversationId ?? null,
        call_type: type,
        is_group: isGroup,
        status: 'ringing',
      })
      .select()
      .single();

    if (error) throw error;

    let token: string;
    try {
      token = await fetchLivekitToken(roomId, callerName, session);
    } catch (e) {
      // Don't leave the callee's phone ringing for a call we can't join
      await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
      throw new Error('Calling is not set up yet — the livekit-token function is not deployed. See BACKEND_SETUP.md.');
    }
    setActiveCall(call as Call);
    setLivekitToken(token);
    return { call: call as Call, token };
  }, [user]);

  const answerCall = useCallback(async (call: Call) => {
    if (!user) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();
    const name = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : user.email || 'Player';

    let token: string;
    try {
      token = await fetchLivekitToken(call.room_id, name, session);
    } catch (e) {
      await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
      setIncomingCall(null);
      throw new Error('Calling is not set up yet — the livekit-token function is not deployed.');
    }

    await supabase
      .from('calls')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', call.id);

    setIncomingCall(null);
    setActiveCall({ ...call, status: 'active' });
    setLivekitToken(token);
  }, [user]);

  const declineCall = useCallback(async (callId: string) => {
    await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', callId);
    setIncomingCall(null);
  }, []);

  const endCall = useCallback(async (callId: string) => {
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
    setActiveCall(null);
    setLivekitToken(null);
  }, []);

  return {
    incomingCall,
    activeCall,
    livekitToken,
    startCall,
    answerCall,
    declineCall,
    endCall,
  };
};
