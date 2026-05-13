import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Call } from '@/hooks/useCall';
import { Palette, Colors, Font, Spacing, Radius } from '@/theme/colors';

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';

interface CallScreenProps {
  call: Call;
  token: string;
  onEnd: () => void;
}

// LiveKit is required lazily inside the component so it only initialises
// when a call actually starts — avoids crashing Expo Go at boot time.
function useLiveKit() {
  try {
    const lk = require('@livekit/react-native');
    const { Track } = require('livekit-client');
    return { ...lk, Track };
  } catch {
    return null;
  }
}

export const CallScreen: React.FC<CallScreenProps> = ({ call, token, onEnd }) => {
  const insets = useSafeAreaInsets();
  const lk = useLiveKit();
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Native modules unavailable (Expo Go) — show a clear message
  if (!lk) {
    return (
      <View style={[StyleSheet.absoluteFillObject, s.root, s.noNativeWrap]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="call-outline" size={52} color="rgba(255,255,255,0.4)" />
        <Text style={s.noNativeTitle}>Calls need a dev build</Text>
        <Text style={s.noNativeSub}>Run {`eas build --profile development`} to enable voice & video</Text>
        <TouchableOpacity style={s.endBtn} onPress={onEnd} activeOpacity={0.85}>
          <Text style={s.endBtnTxt}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { LiveKitRoom, VideoTrack, useLocalParticipant, useRemoteParticipants, useTracks, Track } = lk;
  const isVideo = call.call_type === 'video';

  return (
    <View style={[StyleSheet.absoluteFillObject, s.root]}>
      <StatusBar barStyle="light-content" />
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={token}
        connect
        audio
        video={isVideo && !videoOff}
        onDisconnected={onEnd}
        style={s.room}
      >
        <CallInner
          call={call}
          isVideo={isVideo}
          muted={muted}
          videoOff={videoOff}
          speakerOn={speakerOn}
          elapsed={elapsed}
          fmtTime={fmtTime}
          insets={insets}
          lk={{ VideoTrack, useLocalParticipant, useRemoteParticipants, useTracks, Track }}
          onMute={() => setMuted(v => !v)}
          onVideoToggle={() => setVideoOff(v => !v)}
          onSpeaker={() => setSpeakerOn(v => !v)}
          onEnd={onEnd}
        />
      </LiveKitRoom>
    </View>
  );
};

const CallInner: React.FC<{
  call: Call; isVideo: boolean; muted: boolean; videoOff: boolean;
  speakerOn: boolean; elapsed: number; fmtTime: (s: number) => string;
  insets: any; lk: any;
  onMute: () => void; onVideoToggle: () => void; onSpeaker: () => void; onEnd: () => void;
}> = ({ call, isVideo, muted, videoOff, elapsed, fmtTime, insets, lk, onMute, onVideoToggle, onSpeaker, onEnd }) => {
  const { VideoTrack, useLocalParticipant, useRemoteParticipants, useTracks, Track } = lk;
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const remoteCameraTracks = useTracks([Track.Source.Camera]);
  const localCameraTracks  = useTracks([Track.Source.Camera]);

  useEffect(() => {
    localParticipant?.setMicrophoneEnabled(!muted);
  }, [muted, localParticipant]);

  useEffect(() => {
    if (isVideo) localParticipant?.setCameraEnabled(!videoOff);
  }, [videoOff, isVideo, localParticipant]);

  const remoteVideoRef = remoteCameraTracks.find(
    (t: any) => t.participant.identity !== localParticipant?.identity
  );
  const localVideoRef = localCameraTracks.find(
    (t: any) => t.participant.identity === localParticipant?.identity
  );

  const remoteConnected = remoteParticipants.length > 0;
  const callerLabel = call.caller_name ?? (call.is_group ? 'Group Call' : 'Player');

  return (
    <>
      {isVideo && remoteVideoRef ? (
        <VideoTrack trackRef={remoteVideoRef} style={s.remoteVideo} objectFit="cover" />
      ) : (
        <View style={s.audioBackground}>
          <View style={s.audioAvatar}>
            <Ionicons name="person" size={64} color="rgba(255,255,255,0.6)" />
          </View>
          <Text style={s.callerName}>{callerLabel}</Text>
          <Text style={s.statusText}>{remoteConnected ? fmtTime(elapsed) : 'Connecting…'}</Text>
        </View>
      )}

      {isVideo && remoteConnected && (
        <View style={[s.videoOverlayTop, { paddingTop: insets.top + 16 }]}>
          <Text style={s.videoTimer}>{fmtTime(elapsed)}</Text>
          <Text style={s.videoCallerName}>{callerLabel}</Text>
        </View>
      )}

      {isVideo && localVideoRef && !videoOff && (
        <View style={[s.pipContainer, { top: insets.top + 60 }]}>
          <VideoTrack trackRef={localVideoRef} style={s.pipVideo} objectFit="cover" mirror />
        </View>
      )}

      <View style={[s.controls, { paddingBottom: insets.bottom + 24 }]}>
        <ControlBtn icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} onPress={onMute} active={muted} />
        {isVideo && (
          <ControlBtn icon={videoOff ? 'videocam-off' : 'videocam'} label={videoOff ? 'Cam Off' : 'Camera'} onPress={onVideoToggle} active={videoOff} />
        )}
        <ControlBtn icon="volume-high" label="Speaker" onPress={onSpeaker} />
        <TouchableOpacity style={s.endBtn} onPress={onEnd} activeOpacity={0.85}>
          <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </>
  );
};

const ControlBtn: React.FC<{
  icon: string; label: string; onPress: () => void; active?: boolean;
}> = ({ icon, label, onPress, active }) => (
  <TouchableOpacity style={[s.ctrlBtn, active && s.ctrlBtnActive]} onPress={onPress} activeOpacity={0.8}>
    <Ionicons name={icon as any} size={22} color="#fff" />
    <Text style={s.ctrlLabel}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  root:            { backgroundColor: Palette.dark900, zIndex: 9998 },
  room:            { flex: 1 },
  noNativeWrap:    { alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xxxl },
  noNativeTitle:   { fontSize: 22, fontFamily: Font.bold, color: '#fff', textAlign: 'center' },
  noNativeSub:     { fontSize: 14, fontFamily: Font.regular, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22 },
  endBtnTxt:       { color: '#fff', fontFamily: Font.semibold, fontSize: 16 },
  remoteVideo:     { ...StyleSheet.absoluteFillObject },
  audioBackground: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  audioAvatar:     { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  callerName:      { fontSize: 26, fontFamily: Font.bold, color: '#fff', letterSpacing: -0.5 },
  statusText:      { fontSize: 16, fontFamily: Font.regular, color: 'rgba(255,255,255,0.6)' },
  videoOverlayTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, alignItems: 'center', gap: 2 },
  videoTimer:      { fontSize: 15, fontFamily: Font.semibold, color: 'rgba(255,255,255,0.85)' },
  videoCallerName: { fontSize: 12, fontFamily: Font.regular, color: 'rgba(255,255,255,0.6)' },
  pipContainer:    { position: 'absolute', right: Spacing.lg, width: 90, height: 130, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  pipVideo:        { width: '100%', height: '100%' },
  controls:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl, paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.55)' },
  ctrlBtn:         { alignItems: 'center', gap: 6, width: 60, height: 64, justifyContent: 'center', borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.12)' },
  ctrlBtnActive:   { backgroundColor: 'rgba(239,68,68,0.3)' },
  ctrlLabel:       { fontSize: 10, fontFamily: Font.medium, color: 'rgba(255,255,255,0.75)' },
  endBtn:          { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.error, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
});
