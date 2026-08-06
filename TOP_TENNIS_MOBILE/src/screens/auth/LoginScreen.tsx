import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'

/**
 * One identifier field for both usernames and phone numbers.
 *
 * The screen does not try to work out which one it is — signIn() sends whatever
 * was typed to the login-with-username Edge Function, which classifies it
 * server-side. Branching here would give the two paths different latencies and
 * hand back the account-enumeration signal the function exists to remove.
 */
export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { signIn } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your username or phone number and your password.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signIn(identifier.trim(), password)
      // No navigation call: the session change flips the navigator gate.
    } catch (e: any) {
      setError(e?.message ?? 'Incorrect username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell headline="Welcome back." subline="Sign in to continue your game">
      <Field
        label="Username or phone number"
        icon="person-outline"
        focused={focused === 'identifier'}
      >
        <TextInput
          style={authStyles.input}
          placeholder="rallyking or your mobile number"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={identifier}
          onChangeText={(v) => { setIdentifier(v); setError(null) }}
          onFocus={() => setFocused('identifier')}
          onBlur={() => setFocused(null)}
          autoCapitalize="none"
          autoCorrect={false}
          // 'username' rather than 'tel': password managers key on this field,
          // and the value is a handle more often than a number.
          autoComplete="username"
          textContentType="username"
        />
      </Field>

      <Field label="Password" icon="lock-closed-outline" focused={focused === 'password'}>
        <TextInput
          style={authStyles.input}
          placeholder="••••••••"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={password}
          onChangeText={(v) => { setPassword(v); setError(null) }}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          textContentType="password"
        />
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="rgba(255,255,255,0.35)"
          />
        </TouchableOpacity>
      </Field>

      {!!error && <Text style={authStyles.fieldError}>{error}</Text>}

      <SubmitButton label="Sign In" onPress={handleSignIn} loading={loading} />

      <TouchableOpacity style={authStyles.centered} onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={authStyles.linkText}>Forgot password?</Text>
      </TouchableOpacity>

      <View style={{ height: 4 }} />

      <Text style={authStyles.switchText}>
        {"Don't have an account? "}
        <Text style={authStyles.switchLink} onPress={() => navigation.navigate('SignUp')}>
          Sign Up
        </Text>
      </Text>
    </AuthShell>
  )
}
