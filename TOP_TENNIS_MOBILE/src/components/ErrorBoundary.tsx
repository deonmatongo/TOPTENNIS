import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Font, FontSize, Spacing, Radius } from '@/theme/colors';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  handleReset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <Text style={s.icon}>🎾</Text>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.sub}>The app hit an unexpected error. Please try again.</Text>
        {__DEV__ && <Text style={s.debug}>{this.state.message}</Text>}
        <TouchableOpacity style={s.btn} onPress={this.handleReset}>
          <Text style={s.btnTxt}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  icon:      { fontSize: 48, marginBottom: Spacing.md },
  title:     { fontSize: FontSize.xl, fontFamily: Font.bold, color: Colors.text, marginBottom: Spacing.sm },
  sub:       { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  debug:     { fontSize: 11, color: Colors.error, fontFamily: Font.mono ?? Font.medium, marginBottom: Spacing.lg, textAlign: 'center' },
  btn:       { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full },
  btnTxt:    { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.sm },
});
