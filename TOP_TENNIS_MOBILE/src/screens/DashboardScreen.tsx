import React, { useState, useRef } from 'react'
import {
  StyleSheet, RefreshControl, TextInput, ActivityIndicator, TouchableOpacity, View, ScrollView,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { XStack, YStack, Text } from 'tamagui'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import { useMatches } from '@/hooks/useMatches'
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations'
import { useNotifications } from '@/hooks/useNotifications'
import { useConversations } from '@/hooks/useConversations'
import { usePlayerSearch, PlayerSearchResult } from '@/hooks/usePlayerSearch'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { FadeInView, PressableScale, Pulse } from '@/components/ui/motion'
import { Palette, Colors, Shadow, FontSize, Font, FontWeight, Spacing, Radius } from '@/theme/colors'
import { StatusBar } from 'expo-status-bar'
import { PlayerProfileSheet } from '@/components/ui/PlayerProfileSheet'

const ACHIEVEMENTS = [
  { id: 'first_win',    icon: 'trophy'  as const, label: 'First Win',     desc: 'Win your first match',   color: '#f59e0b', condition: (w: number) => w >= 1 },
  { id: 'five_wins',   icon: 'star'    as const, label: 'Five Wins',     desc: 'Win 5 matches',          color: '#3b82f6', condition: (w: number) => w >= 5 },
  { id: 'ten_wins',    icon: 'medal'   as const, label: 'Ten Wins',      desc: 'Win 10 matches',         color: '#8b5cf6', condition: (w: number) => w >= 10 },
  { id: 'streak3',     icon: 'flame'   as const, label: 'On Fire',       desc: '3-match win streak',     color: '#ea580c', condition: (_w: number, _l: number, s: number) => s >= 3 },
  { id: 'league_rookie', icon: 'ribbon' as const, label: 'League Rookie', desc: 'Join your first league', color: '#10b981', condition: (_w: number, _l: number, _s: number, leagues: number) => leagues >= 1 },
]

const QUICK_ACTIONS = [
  { label: 'My Leagues',  icon: 'trophy-outline'      as const, screen: 'MyLeagues',   bg: Palette.orange500, color: '#FFFFFF' },
  { label: 'Rankings',    icon: 'podium-outline'      as const, screen: 'Competition', bg: Palette.orange500, color: '#FFFFFF' },
  { label: 'Performance', icon: 'bar-chart-outline'   as const, screen: 'Performance', bg: Palette.orange500, color: '#FFFFFF' },
  { label: 'Social',      icon: 'people-outline'      as const, screen: 'Social',      bg: Palette.orange500, color: '#FFFFFF' },
]

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets()
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null)
  const { user } = useAuth()
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile()
  const { player, refetch: refetchPlayer } = usePlayerProfile()
  const { upcoming, pendingReceived, loading: matchesLoading, refetch: refetchMatches } = useMatches()
  const { registrations } = useLeagueRegistrations()
  const { unreadCount } = useNotifications()
  const { getOrCreateDM } = useConversations()
  const { query: searchQuery, results: searchResults, searching, search, clear: clearSearch } = usePlayerSearch()
  const { query: scheduleQuery, results: scheduleResults, searching: scheduleSearching, search: scheduleSearch, clear: clearScheduleSearch } = usePlayerSearch()
  const [refreshing, setRefreshing] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const scheduleSearchRef = useRef<TextInput>(null)

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchProfile(), refetchPlayer(), refetchMatches()])
    setRefreshing(false)
  }

  const handleMessage = async (targetUserId: string) => {
    try {
      const convId = await getOrCreateDM(targetUserId)
      navigation.navigate('Messages', { openConversationId: convId })
    } catch {
      navigation.navigate('Messages')
    }
  }

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'Player'
  const avatarUrl = (profile as any)?.profile_picture_url ?? undefined

  const wins     = player?.wins ?? 0
  const losses   = player?.losses ?? 0
  const total    = wins + losses
  const winRate  = total > 0 ? Math.round((wins / total) * 100) : 0
  const streak   = player?.current_streak ?? 0
  const nextMatch = upcoming[0]

  const activeLeagues = registrations.filter(r => {
    const months = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
    return months < 3
  })

  const readinessScore = Math.min(100, (wins * 10) + (streak * 15) + (total > 0 ? 30 : 0))
  const readinessColor = readinessScore >= 70 ? '#4ade80' : readinessScore >= 40 ? '#fbbf24' : '#f87171'

  // Context-aware spotlight banner — surfaces the most motivating next step.
  const hasScheduledMatch = upcoming.length > 0
  const spotlight = streak >= 2
    ? { icon: 'flame' as const, kicker: 'ON A ROLL', title: `You're on a ${streak}-win streak`, cta: 'Keep it going', colors: ['#EA580C', '#F97316'] as const, onPress: () => setShowScheduleModal(true) }
    : total === 0 && !hasScheduledMatch
    ? { icon: 'tennisball' as const, kicker: 'WELCOME', title: 'Play your first match', cta: 'Find an opponent', colors: [Palette.orange600, Palette.orange500] as const, onPress: () => setShowScheduleModal(true) }
    : total === 0 && hasScheduledMatch
    ? { icon: 'calendar' as const, kicker: 'GET READY', title: 'Your first match is scheduled', cta: 'View schedule', colors: [Palette.orange600, Palette.orange500] as const, onPress: () => navigation.navigate('Schedule') }
    : { icon: 'trophy' as const, kicker: 'YOUR SEASON', title: `${wins} wins · ${winRate}% win rate`, cta: 'Schedule a match', colors: [Palette.orange600, Palette.orange500] as const, onPress: () => setShowScheduleModal(true) }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={[]}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Hero ── */}
        <LinearGradient
          colors={[Palette.navy, Palette.navy800, '#1a2d4e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, gap: Spacing.lg }}
        >
          {/* Top row */}
          <FadeInView from="up">
            <XStack alignItems="flex-start" gap={Spacing.md}>
              <YStack flex={1}>
                <Text style={s.greeting}>{getGreeting()}</Text>
                <Text style={s.heroName}>{fullName}</Text>
                <XStack alignItems="center" gap={6} marginTop={6}>
                  <Pulse active={readinessScore >= 70}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: readinessColor }} />
                  </Pulse>
                  <Text style={s.readinessTxt}>Match readiness {readinessScore}%</Text>
                </XStack>
              </YStack>

              <XStack alignItems="center" gap={Spacing.sm} paddingTop={2}>
                <TouchableOpacity
                  style={s.notifBtn}
                  onPress={() => navigation.navigate('Notifications')}
                  accessibilityRole="button"
                  accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                >
                  <Ionicons name="notifications-outline" size={22} color="#fff" />
                  {unreadCount > 0 && (
                    <YStack
                      position="absolute"
                      top={-3}
                      right={-3}
                      width={18}
                      height={18}
                      borderRadius={9}
                      backgroundColor="#ef4444"
                      alignItems="center"
                      justifyContent="center"
                      borderWidth={1.5}
                      borderColor={Palette.navy}
                    >
                      <Text style={{ fontSize: 9, color: '#fff', fontFamily: Font.bold }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </YStack>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Your profile">
                  <Avatar name={fullName} size={44} imageUrl={avatarUrl} style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
                </TouchableOpacity>
              </XStack>
            </XStack>
          </FadeInView>

          {/* Stats strip */}
          <FadeInView delay={80}>
            <XStack
              backgroundColor="rgba(255,255,255,0.08)"
              borderRadius={Radius.lg}
              padding={Spacing.md}
              borderWidth={1}
              borderColor="rgba(255,255,255,0.10)"
            >
              {[
                { val: wins,     suffix: '',  label: 'Wins'     },
                { val: losses,   suffix: '',  label: 'Losses'   },
                { val: winRate,  suffix: '%', label: 'Win Rate' },
                { val: streak,   suffix: '',  label: 'Streak'   },
              ].map((stat, i) => (
                <React.Fragment key={stat.label}>
                  {i > 0 && (
                    <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 }} />
                  )}
                  <YStack flex={1} alignItems="center" gap={2}>
                    <AnimatedCounter value={stat.val} suffix={stat.suffix} style={s.statVal} />
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </YStack>
                </React.Fragment>
              ))}
            </XStack>
          </FadeInView>

          {/* Search bar */}
          <FadeInView delay={140}>
            <XStack
              alignItems="center"
              gap={Spacing.sm}
              backgroundColor="rgba(255,255,255,0.12)"
              borderRadius={Radius.full}
              paddingHorizontal={Spacing.md}
              height={44}
              borderWidth={1}
              borderColor="rgba(255,255,255,0.18)"
            >
              <Ionicons name="search-outline" size={17} color="rgba(255,255,255,0.55)" />
              <TextInput
                style={s.searchInput}
                placeholder="Find a player by name, level, city..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={searchQuery}
                onChangeText={search}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />}
              {searchQuery.length > 0 && !searching && (
                <TouchableOpacity onPress={clearSearch} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </XStack>
          </FadeInView>
        </LinearGradient>

        {/* Search results */}
        {searchQuery.length > 0 && (
          <YStack
            backgroundColor={Colors.surface}
            marginHorizontal={Spacing.md}
            marginTop={-2}
            borderRadius={Radius.xl}
            borderWidth={1}
            borderColor={Colors.border}
            overflow="hidden"
            {...(Shadow.md as any)}
          >
            {searching ? (
              <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.md }} />
            ) : searchResults.length === 0 ? (
              <XStack alignItems="center" gap={Spacing.sm} padding={Spacing.md} justifyContent="center">
                <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
                <Text style={s.searchEmpty}>No players found for "{searchQuery}"</Text>
              </XStack>
            ) : (
              searchResults.map((p, idx) => {
                const tot = (p.wins || 0) + (p.losses || 0)
                const wr = tot > 0 ? Math.round(((p.wins || 0) / tot) * 100) : 0
                const skillLvl = p.skill_level
                const skillLabel = !skillLvl ? null : skillLvl >= 7 ? 'Advanced' : skillLvl >= 4 ? 'Intermediate' : 'Beginner'
                const skillColor = !skillLvl ? Colors.textMuted : skillLvl >= 7 ? Colors.error : skillLvl >= 4 ? Colors.warning : Colors.success
                const isLast = idx === searchResults.length - 1
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.searchRow, !isLast && s.searchRowBorder]}
                    onPress={() => setSelectedPlayer(p)}
                    activeOpacity={0.8}
                  >
                    <Avatar name={p.name || 'P'} size={44} imageUrl={p.profile_picture_url} />
                    <YStack flex={1} gap={4}>
                      <XStack alignItems="center" gap={5} flexWrap="wrap">
                        <Text style={s.searchName} numberOfLines={1}>{p.name}</Text>
                        {skillLabel && (
                          <YStack borderRadius={Radius.sm} paddingHorizontal={6} paddingVertical={2} backgroundColor={skillColor + '20'}>
                            <Text style={{ fontSize: 10, fontFamily: Font.semibold, color: skillColor }}>{skillLabel}</Text>
                          </YStack>
                        )}
                        {p.usta_rating && (
                          <YStack backgroundColor={Colors.backgroundAlt} borderRadius={Radius.sm} paddingHorizontal={6} paddingVertical={2}>
                            <Text style={{ fontSize: 10, color: Colors.textSecondary, fontFamily: Font.medium }}>USTA {p.usta_rating}</Text>
                          </YStack>
                        )}
                      </XStack>
                      <XStack alignItems="center" flexWrap="wrap">
                        {tot > 0 && <Text style={s.searchMetaTxt}>{p.wins}W–{p.losses}L · {wr}% WR</Text>}
                        {p.city && <Text style={s.searchMetaTxt}>{tot > 0 ? ' · ' : ''}{p.city}</Text>}
                        {p.competitiveness && <Text style={s.searchMetaTxt}> · {p.competitiveness}</Text>}
                      </XStack>
                    </YStack>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )
              })
            )}
          </YStack>
        )}

        <YStack padding={Spacing.lg} gap={Spacing.xl}>
          {/* Spotlight banner */}
          <FadeInView delay={40}>
            <PressableScale onPress={spotlight.onPress}>
              <View style={s.spotlightWrap}>
                <LinearGradient
                  colors={spotlight.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.spotlight}
                >
                  <YStack flex={1} gap={6}>
                    <Text style={s.spotlightKicker}>{spotlight.kicker}</Text>
                    <Text style={s.spotlightTitle}>{spotlight.title}</Text>
                    <XStack alignItems="center" gap={4} marginTop={4}>
                      <Text style={s.spotlightCta}>{spotlight.cta}</Text>
                      <Ionicons name="arrow-forward" size={15} color="#fff" />
                    </XStack>
                  </YStack>
                  {streak >= 2 ? (
                    <Pulse>
                      <YStack style={s.spotlightIcon}>
                        <Ionicons name={spotlight.icon} size={26} color="#fff" />
                      </YStack>
                    </Pulse>
                  ) : (
                    <YStack style={s.spotlightIcon}>
                      <Ionicons name={spotlight.icon} size={26} color="#fff" />
                    </YStack>
                  )}
                </LinearGradient>
              </View>
            </PressableScale>
          </FadeInView>

          {/* Pending invites alert */}
          {pendingReceived.length > 0 && (
            <FadeInView delay={60}>
              <PressableScale onPress={() => navigation.navigate('Matches')}>
                <XStack style={s.alertCard}>
                  <Pulse>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />
                  </Pulse>
                  <YStack flex={1}>
                    <Text style={s.alertTitle}>
                      {pendingReceived.length} pending match {pendingReceived.length === 1 ? 'invitation' : 'invitations'}
                    </Text>
                    <Text style={s.alertSub}>Tap to view and respond</Text>
                  </YStack>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </XStack>
              </PressableScale>
            </FadeInView>
          )}

          {/* Next Match */}
          <FadeInView delay={100}>
            <YStack gap={Spacing.sm}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text style={s.sectionTitle}>Next Match</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Schedule')}>
                  <Text style={s.sectionLink}>Schedule</Text>
                </TouchableOpacity>
              </XStack>
              {matchesLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
              ) : nextMatch ? (
                <PressableScale onPress={() => navigation.navigate('Schedule')}>
                  <View style={s.nextCard}>
                    <LinearGradient
                      colors={[Palette.navy, '#1a2d4e']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.nextCardGrad}
                    >
                      <YStack width={48} height={48} borderRadius={24} backgroundColor="rgba(249,115,22,0.18)" alignItems="center" justifyContent="center">
                        <Ionicons name="tennisball" size={22} color={Colors.primary} />
                      </YStack>
                      <YStack flex={1}>
                        <Text style={s.nextOpponent}>
                          vs {nextMatch.sender
                            ? `${nextMatch.sender.first_name || ''} ${nextMatch.sender.last_name || ''}`.trim()
                            : nextMatch.receiver
                            ? `${nextMatch.receiver.first_name || ''} ${nextMatch.receiver.last_name || ''}`.trim()
                            : 'Opponent'}
                        </Text>
                        <XStack alignItems="center" gap={4} marginTop={4}>
                          <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
                          <Text style={s.nextMetaTxt}>
                            {new Date(nextMatch.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </Text>
                          {nextMatch.start_time && (
                            <>
                              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                              <Text style={s.nextMetaTxt}>{nextMatch.start_time}</Text>
                            </>
                          )}
                        </XStack>
                        {nextMatch.court_location && (
                          <XStack alignItems="center" gap={4} marginTop={2}>
                            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
                            <Text style={s.nextMetaTxt}>{nextMatch.court_location}</Text>
                          </XStack>
                        )}
                      </YStack>
                      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
                    </LinearGradient>
                  </View>
                </PressableScale>
              ) : (
                <YStack
                  backgroundColor={Colors.surface}
                  borderRadius={Radius.xl}
                  padding={Spacing.xl}
                  alignItems="center"
                  gap={Spacing.xs}
                  borderWidth={1}
                  borderColor={Colors.border}
                >
                  <YStack width={56} height={56} borderRadius={28} backgroundColor={Colors.surfaceWarm} alignItems="center" justifyContent="center" marginBottom={4}>
                    <Ionicons name="calendar-outline" size={28} color={Colors.primary} />
                  </YStack>
                  <Text style={s.emptyTitle}>No upcoming matches</Text>
                  <Text style={s.emptySub}>Schedule your next game</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={() => setShowScheduleModal(true)}>
                    <Text style={s.emptyBtnTxt}>Schedule a Match</Text>
                  </TouchableOpacity>
                </YStack>
              )}
            </YStack>
          </FadeInView>

          {/* Quick Actions */}
          <FadeInView delay={140}>
            <YStack gap={Spacing.sm}>
              <Text style={s.sectionTitle}>Quick Actions</Text>
              <XStack flexWrap="wrap" gap={10}>
                {QUICK_ACTIONS.map(a => (
                  <PressableScale
                    key={a.screen}
                    style={s.quickItem}
                    onPress={() => navigation.navigate(a.screen)}
                  >
                    <YStack alignItems="center" gap={6}>
                      <YStack
                        width={52}
                        height={52}
                        borderRadius={Radius.lg}
                        backgroundColor={a.bg}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name={a.icon} size={22} color={a.color} />
                      </YStack>
                      <Text style={s.quickLabel}>{a.label}</Text>
                    </YStack>
                  </PressableScale>
                ))}
              </XStack>
            </YStack>
          </FadeInView>

          {/* Active Leagues */}
          <FadeInView delay={180}>
            <YStack gap={Spacing.sm}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text style={s.sectionTitle}>Active Leagues</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MyLeagues')}>
                  <Text style={s.sectionLink}>View All</Text>
                </TouchableOpacity>
              </XStack>
              {activeLeagues.length === 0 ? (
                <YStack
                  backgroundColor={Colors.surface}
                  borderRadius={Radius.xl}
                  padding={Spacing.xl}
                  alignItems="center"
                  gap={Spacing.xs}
                  borderWidth={1}
                  borderColor={Colors.border}
                >
                  <YStack width={56} height={56} borderRadius={28} backgroundColor={Colors.surfaceWarm} alignItems="center" justifyContent="center" marginBottom={4}>
                    <Ionicons name="trophy-outline" size={28} color="#f59e0b" />
                  </YStack>
                  <Text style={s.emptyTitle}>No active leagues</Text>
                  <Text style={s.emptySub}>Compete with players in your area</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('JoinLeague')}>
                    <Text style={s.emptyBtnTxt}>Browse Leagues</Text>
                  </TouchableOpacity>
                </YStack>
              ) : (
                activeLeagues.slice(0, 3).map(reg => (
                  <PressableScale
                    key={reg.id}
                    onPress={() => navigation.navigate('MyLeagues')}
                  >
                    <XStack style={s.leagueRow}>
                      <YStack width={40} height={40} borderRadius={20} backgroundColor="#FEFCE8" alignItems="center" justifyContent="center">
                        <Ionicons name="trophy" size={18} color="#f59e0b" />
                      </YStack>
                      <Text style={s.leagueName} numberOfLines={1}>{reg.league_name || 'League'}</Text>
                      <YStack backgroundColor="#DCFCE7" paddingHorizontal={10} paddingVertical={3} borderRadius={Radius.full}>
                        <Text style={{ fontSize: FontSize.xs, color: Colors.success, fontFamily: Font.semibold }}>Active</Text>
                      </YStack>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </XStack>
                  </PressableScale>
                ))
              )}
            </YStack>
          </FadeInView>

          {/* Achievements */}
          <FadeInView delay={220}>
            <YStack gap={Spacing.sm}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text style={s.sectionTitle}>Achievements</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Performance')}>
                  <Text style={s.sectionLink}>View All</Text>
                </TouchableOpacity>
              </XStack>
              <XStack flexWrap="wrap" gap={Spacing.sm}>
                {ACHIEVEMENTS.map(a => {
                  const unlocked = a.condition(wins, losses, streak, registrations.length)
                  return (
                    <YStack
                      key={a.id}
                      width="18%"
                      alignItems="center"
                      gap={4}
                      opacity={unlocked ? 1 : 0.4}
                    >
                      {unlocked ? (
                        <Pulse active={a.id === 'streak3'}>
                          <YStack
                            width={44}
                            height={44}
                            borderRadius={22}
                            backgroundColor={a.color + '20'}
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Ionicons name={a.icon} size={20} color={a.color} />
                          </YStack>
                        </Pulse>
                      ) : (
                        <YStack
                          width={44}
                          height={44}
                          borderRadius={22}
                          backgroundColor={Colors.borderLight}
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Ionicons name={a.icon} size={20} color={Colors.textMuted} />
                        </YStack>
                      )}
                      <Text
                        style={{ fontSize: 10, fontFamily: Font.semibold, textAlign: 'center', color: unlocked ? Colors.text : Colors.textMuted }}
                        numberOfLines={1}
                      >
                        {a.label}
                      </Text>
                      {!unlocked && <Text style={{ fontSize: 9, color: Colors.textMuted, textAlign: 'center' }}>{a.desc}</Text>}
                    </YStack>
                  )
                })}
              </XStack>
            </YStack>
          </FadeInView>

        </YStack>
      </ScrollView>

      {/* Schedule a Match — player search modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowScheduleModal(false); clearScheduleSearch(); }}
        onShow={() => setTimeout(() => scheduleSearchRef.current?.focus(), 150)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={() => { setShowScheduleModal(false); clearScheduleSearch(); }}
          />
          <YStack
            backgroundColor={Colors.background}
            borderTopLeftRadius={24}
            borderTopRightRadius={24}
            paddingTop={Spacing.md}
            paddingBottom={insets.bottom + Spacing.xl}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '85%' }}
          >
            {/* Handle */}
            <YStack alignItems="center" marginBottom={Spacing.md}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
            </YStack>

            {/* Header */}
            <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={Spacing.lg} marginBottom={Spacing.md}>
              <Text style={s.modalTitle}>Schedule a Match</Text>
              <TouchableOpacity onPress={() => { setShowScheduleModal(false); clearScheduleSearch(); }} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </XStack>

            {/* Search input */}
            <XStack
              alignItems="center"
              gap={Spacing.sm}
              backgroundColor={Colors.surface}
              borderRadius={Radius.full}
              paddingHorizontal={Spacing.md}
              height={46}
              marginHorizontal={Spacing.lg}
              marginBottom={Spacing.md}
              borderWidth={1}
              borderColor={Colors.border}
            >
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
              <TextInput
                ref={scheduleSearchRef}
                style={s.modalSearchInput}
                placeholder="Search players by name, city..."
                placeholderTextColor={Colors.textMuted}
                value={scheduleQuery}
                onChangeText={scheduleSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {scheduleSearching && <ActivityIndicator size="small" color={Colors.primary} />}
              {scheduleQuery.length > 0 && !scheduleSearching && (
                <TouchableOpacity onPress={clearScheduleSearch} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </XStack>

            {/* Results */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
            >
              {scheduleQuery.length === 0 ? (
                <YStack alignItems="center" paddingVertical={Spacing.xxl} gap={Spacing.sm}>
                  <YStack width={60} height={60} borderRadius={30} backgroundColor={Colors.surfaceWarm} alignItems="center" justifyContent="center">
                    <Ionicons name="tennisball-outline" size={28} color={Colors.primary} />
                  </YStack>
                  <Text style={s.modalEmptyTitle}>Find your opponent</Text>
                  <Text style={s.modalEmptySub}>Search by name, city, or skill level</Text>
                </YStack>
              ) : scheduleSearching ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
              ) : scheduleResults.length === 0 ? (
                <YStack alignItems="center" paddingVertical={Spacing.xxl} gap={Spacing.sm}>
                  <Ionicons name="search-outline" size={32} color={Colors.textMuted} />
                  <Text style={s.modalEmptySub}>No players found for "{scheduleQuery}"</Text>
                </YStack>
              ) : (
                scheduleResults.map((p, idx) => {
                  const tot = (p.wins || 0) + (p.losses || 0)
                  const wr = tot > 0 ? Math.round(((p.wins || 0) / tot) * 100) : 0
                  const skillLvl = p.skill_level
                  const skillLabel = !skillLvl ? null : skillLvl >= 7 ? 'Advanced' : skillLvl >= 4 ? 'Intermediate' : 'Beginner'
                  const skillColor = !skillLvl ? Colors.textMuted : skillLvl >= 7 ? Colors.error : skillLvl >= 4 ? Colors.warning : Colors.success
                  const isLast = idx === scheduleResults.length - 1
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.schedulePlayerRow, !isLast && s.schedulePlayerRowBorder]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowScheduleModal(false)
                        clearScheduleSearch()
                        setSelectedPlayer(p)
                      }}
                    >
                      <Avatar name={p.name || 'P'} size={48} imageUrl={p.profile_picture_url} />
                      <YStack flex={1} gap={4}>
                        <XStack alignItems="center" gap={6} flexWrap="wrap">
                          <Text style={s.schedulePlayerName} numberOfLines={1}>{p.name}</Text>
                          {skillLabel && (
                            <YStack borderRadius={Radius.sm} paddingHorizontal={6} paddingVertical={2} backgroundColor={skillColor + '20'}>
                              <Text style={{ fontSize: 10, fontFamily: Font.semibold, color: skillColor }}>{skillLabel}</Text>
                            </YStack>
                          )}
                        </XStack>
                        <XStack alignItems="center" flexWrap="wrap" gap={0}>
                          {tot > 0 && <Text style={s.schedulePlayerMeta}>{p.wins}W–{p.losses}L · {wr}% WR</Text>}
                          {p.city && <Text style={s.schedulePlayerMeta}>{tot > 0 ? ' · ' : ''}{p.city}</Text>}
                        </XStack>
                      </YStack>
                      <YStack
                        backgroundColor={Colors.primary}
                        paddingHorizontal={Spacing.md}
                        paddingVertical={6}
                        borderRadius={Radius.full}
                      >
                        <Text style={{ fontSize: FontSize.xs, color: '#fff', fontFamily: Font.semibold }}>Invite</Text>
                      </YStack>
                    </TouchableOpacity>
                  )
                })
              )}
            </ScrollView>
          </YStack>
        </KeyboardAvoidingView>
      </Modal>

      <PlayerProfileSheet
        player={selectedPlayer}
        visible={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onMessage={handleMessage}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  greeting:    { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', fontFamily: Font.medium, marginBottom: 2 },
  heroName:    { fontSize: 28, fontFamily: Font.black, color: '#fff' },
  readinessTxt:{ fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },
  notifBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  statVal:     { fontSize: FontSize.xl, fontFamily: Font.black, color: '#fff' },
  statLabel:   { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },

  spotlightWrap: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.md },
  spotlight:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, minHeight: 108 },
  spotlightKicker: { fontSize: 10, fontFamily: Font.black, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.2 },
  spotlightTitle:  { fontSize: FontSize.xl, fontFamily: Font.black, color: '#fff', letterSpacing: -0.3 },
  spotlightCta:    { fontSize: FontSize.sm, fontFamily: Font.bold, color: '#fff' },
  spotlightIcon:   { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  alertCard:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primaryMuted },
  alertTitle:  { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.primaryDark },
  alertSub:    { fontSize: FontSize.xs, color: Colors.primary, marginTop: 1 },

  sectionTitle: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  sectionLink:  { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Font.semibold },

  nextCard:     { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.md },
  nextCardGrad: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  nextOpponent: { fontSize: FontSize.md, fontFamily: Font.bold, color: '#fff' },
  nextMetaTxt:  { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },

  emptyTitle:   { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  emptySub:     { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn:     { marginTop: 8, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  emptyBtnTxt:  { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.sm },

  quickItem:    { width: '22%' },
  quickLabel:   { fontSize: 10, fontFamily: Font.semibold, color: Colors.text, textAlign: 'center' },

  leagueRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.xs },
  leagueName:   { flex: 1, fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },

  searchInput:  { flex: 1, fontSize: FontSize.sm, color: '#fff', paddingVertical: 0 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchName:   { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  searchMetaTxt:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  searchEmpty:  { padding: Spacing.md, textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.sm },

  modalBackdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalTitle:          { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  modalSearchInput:    { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 0 },
  modalEmptyTitle:     { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  modalEmptySub:       { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  schedulePlayerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  schedulePlayerRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  schedulePlayerName:  { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  schedulePlayerMeta:  { fontSize: FontSize.xs, color: Colors.textSecondary },
})
