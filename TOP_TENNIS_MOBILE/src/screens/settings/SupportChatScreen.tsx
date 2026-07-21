import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette, FontSize, Font, Spacing, Radius, Shadow } from '@/theme/colors';
import { SettingsSafeScreen, SectionPageHeader } from './_shared';
import { selection as hapticSelection } from '@/utils/haptics';

const SUPPORT_EMAIL = 'support@toptennis.app';

type Sender = 'bot' | 'user';
interface ChatMsg { id: string; from: Sender; text: string; escalate?: boolean; }

// ─── Rule-based assistant ──────────────────────────────────────────────────────
// Mirrors the topics the WhatsApp support service handles. First-line answers;
// anything it can't resolve is handed to a human agent.

interface Answer { text: string; escalate?: boolean; }

function respond(input: string): Answer {
  const q = input.toLowerCase();
  const has = (...w: string[]) => w.some(k => q.includes(k));

  if (has('hi', 'hello', 'hey', 'hie', 'good morning', 'good afternoon', 'good evening'))
    return { text: 'Hi there! 🎾 I can help with match scheduling, leagues, bookings, billing, or app issues. What do you need a hand with?' };

  if (has('reschedul', 'schedule', 'change time', 'move my match', 'postpone'))
    return { text: 'To reschedule: open Schedule → tap your match → “Propose new time”, pick a slot and your opponent gets a confirmation request. Need me to walk through anything specific?' };

  if (has('score', 'dispute', 'result', 'no show', "didn't show", 'no-show', 'won', 'lost'))
    return { text: 'You can log a result under Schedule → the finished match → “Record score”. Score disputes and no-shows are reviewed by our team, though — want me to pass this to a human agent?', escalate: true };

  if (has('league', 'register', 'sign up', 'division', 'standings', 'ladder'))
    return { text: 'For leagues: go to Leagues → “Join a League”, pick your division and tap Register. Standings live under each league’s “Table” tab. Which league are you looking at?' };

  if (has('book', 'court', 'venue', 'reserve'))
    return { text: 'Court bookings live under Schedule → “Book a court”. You can see availability by venue and time. Some venues need calendar access — you can enable that in Settings → Support & More → Calendar Access.' };

  if (has('bill', 'payment', 'charge', 'refund', 'subscription', 'invoice', 'money', 'paid'))
    return { text: 'Billing questions (charges, refunds, subscriptions) are handled by our team so we can look at your account securely. I’ll connect you with a human agent.', escalate: true };

  if (has('crash', 'bug', 'error', 'broken', 'not working', "won't load", 'freeze', 'slow'))
    return { text: 'Sorry about that! First try updating to the latest version from the App Store / Play Store and restarting the app. If it still happens, tell me exactly what you were doing and I’ll escalate it.', escalate: true };

  if (has('password', 'login', 'log in', "can't sign in", 'reset', 'locked out'))
    return { text: 'You can reset your password from Settings → Account → “Reset Password” — we’ll email you a secure link. If you’re fully locked out, I can loop in a human agent.', escalate: true };

  if (has('email', 'change email', 'phone', 'update details'))
    return { text: 'You can edit your name, photo and location under Settings → Account → Edit Profile. To change the email on your account, a human agent needs to verify you — want me to connect you?', escalate: true };

  if (has('delete', 'close account', 'cancel account'))
    return { text: 'You can permanently delete your account under Settings → Delete Account. This removes all your data and can’t be undone. Want to talk to someone first?', escalate: true };

  if (has('human', 'agent', 'person', 'someone', 'real', 'talk to', 'help'))
    return { text: 'No problem — I’ll hand you over to a human agent. Tap “Email a human agent” below and we’ll reply within one business day.', escalate: true };

  if (has('thank', 'thanks', 'cheers', 'great', 'awesome'))
    return { text: 'Anytime — enjoy your tennis! 🎾' };

  return { text: 'I’m not totally sure I caught that. I can help with scheduling, leagues, bookings, billing, or app issues — pick a topic below, or I can connect you to a human agent.', escalate: true };
}

const QUICK_REPLIES = ['Reschedule a match', 'Join a league', 'Book a court', 'Billing question', 'App not working'];

const GREETING: ChatMsg = {
  id: 'greeting',
  from: 'bot',
  text: 'Hi! 👋 I’m the Top Tennis assistant. Ask me anything about matches, leagues, bookings or your account — I’ll help right away or connect you with a human.',
};

let seq = 0;
const nextId = () => `m${++seq}`;

export const SupportChatScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const emailAgent = useCallback((history: ChatMsg[]) => {
    const transcript = history.map(m => `${m.from === 'user' ? 'You' : 'Assistant'}: ${m.text}`).join('\n');
    const subject = encodeURIComponent('Top Tennis — support request');
    const body = encodeURIComponent(`Hi Top Tennis team,\n\nI need help with the following:\n\n\n— — —\nChat so far:\n${transcript}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
      .catch(() => Alert.alert('Could not open email', `Please email us directly at ${SUPPORT_EMAIL}.`));
  }, []);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    hapticSelection();
    const userMsg: ChatMsg = { id: nextId(), from: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    scrollDown();

    const answer = respond(text);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, { id: nextId(), from: 'bot', text: answer.text, escalate: answer.escalate }]);
      scrollDown();
    }, 650);
  }, [scrollDown]);

  return (
    <SettingsSafeScreen>
      <SectionPageHeader title="Support" subtitle="We usually reply instantly" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.thread}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollDown}
        >
          {messages.map(m => (
            <View key={m.id} style={{ width: '100%' }}>
              <View style={[s.row, m.from === 'user' ? s.rowRight : s.rowLeft]}>
                {m.from === 'bot' && (
                  <View style={s.botAvatar}><Ionicons name="tennisball" size={15} color="#fff" /></View>
                )}
                <View style={[s.bubble, m.from === 'user' ? s.bubbleUser : s.bubbleBot]}>
                  <Text style={[s.bubbleText, m.from === 'user' && s.bubbleTextUser]}>{m.text}</Text>
                </View>
              </View>
              {m.from === 'bot' && m.escalate && (
                <TouchableOpacity style={s.escBtn} onPress={() => emailAgent(messages)} activeOpacity={0.85}>
                  <Ionicons name="mail-outline" size={15} color="#fff" />
                  <Text style={s.escBtnTxt}>Email a human agent</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {typing && (
            <View style={[s.row, s.rowLeft]}>
              <View style={s.botAvatar}><Ionicons name="tennisball" size={15} color="#fff" /></View>
              <View style={[s.bubble, s.bubbleBot, s.typing]}>
                <Text style={s.typingTxt}>typing…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick replies */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow} keyboardShouldPersistTaps="handled">
          {QUICK_REPLIES.map(q => (
            <TouchableOpacity key={q} style={s.quickChip} onPress={() => send(q)} activeOpacity={0.8}>
              <Text style={s.quickChipTxt}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Composer */}
        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message…"
            placeholderTextColor={Colors.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, !input.trim() && s.sendBtnOff]}
            onPress={() => send(input)}
            disabled={!input.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SettingsSafeScreen>
  );
};

const s = StyleSheet.create({
  thread: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  botAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 1, borderRadius: 16 },
  bubbleBot: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4, ...Shadow.xs as any },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20, fontFamily: Font.medium },
  bubbleTextUser: { color: '#fff' },
  typing: { paddingVertical: Spacing.sm },
  typingTxt: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },

  escBtn: { alignSelf: 'flex-start', marginLeft: 36, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Palette.dark800, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  escBtnTxt: { color: '#fff', fontSize: FontSize.xs, fontFamily: Font.semibold },

  quickRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  quickChip: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryMuted, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  quickChipTxt: { fontSize: FontSize.xs, color: Colors.primaryDark, fontFamily: Font.semibold },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingTop: 11, paddingBottom: 11, fontSize: FontSize.sm, color: Colors.text },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
});
