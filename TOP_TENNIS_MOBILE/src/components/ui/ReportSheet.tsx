import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Font, Spacing, Radius } from '@/theme/colors';
import { useReports, REPORT_REASONS, ReportContext } from '@/hooks/useReports';

interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  context: ReportContext;
  targetUserId?: string;
  refId?: string;
  /** e.g. the player or content name, shown in the header */
  subjectLabel?: string;
}

export const ReportSheet: React.FC<ReportSheetProps> = ({
  visible, onClose, context, targetUserId, refId, subjectLabel,
}) => {
  const { report } = useReports();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setReason(null); setDetails(''); setSubmitting(false); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await report({ context, targetUserId, refId, reason, details: details.trim() || undefined });
      close();
      Alert.alert('Report received', 'Thanks for flagging this. Our team will review it within 24 hours.');
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Could not send report', e?.message ?? 'Please try again, or email support@toptennis.app.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>Report{subjectLabel ? ` ${subjectLabel}` : ''}</Text>
            <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={s.sub}>Why are you reporting this? Our team reviews every report.</Text>

          <View style={s.reasons}>
            {REPORT_REASONS.map(r => {
              const selected = reason === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[s.reason, selected && s.reasonActive]}
                  onPress={() => setReason(r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={r}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selected ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[s.reasonTxt, selected && s.reasonTxtActive]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={s.details}
            value={details}
            onChangeText={setDetails}
            placeholder="Add any details (optional)"
            placeholderTextColor={Colors.textMuted}
            multiline
          />

          <TouchableOpacity
            style={[s.submit, (!reason || submitting) && s.submitOff]}
            onPress={submit}
            disabled={!reason || submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit report"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>Submit report</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  reasons: { gap: Spacing.xs },
  reason: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  reasonActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reasonTxt: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Font.medium },
  reasonTxtActive: { color: Colors.primaryDark, fontFamily: Font.semibold },
  details: { minHeight: 64, maxHeight: 120, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.sm, color: Colors.text, backgroundColor: Colors.surface, marginTop: Spacing.sm, textAlignVertical: 'top' },
  submit: { marginTop: Spacing.md, backgroundColor: Colors.error, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  submitOff: { opacity: 0.5 },
  submitTxt: { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.sm },
});
