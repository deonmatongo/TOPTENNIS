import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and your password.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      // No navigation call: the session change flips the navigator gate.
    } catch (e: any) {
      setError(e?.message ?? 'Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell headline="Welcome back." subline="Sign in to continue your game">
      <Field
        label="Email"
        icon="mail-outline"
        focused={focused === 'email'}
      >
        <TextInput
          style={authStyles.input}
          placeholder="you@example.com"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null) }}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused(null)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
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
