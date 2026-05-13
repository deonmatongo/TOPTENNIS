import React, { useState } from 'react'
import {
  StyleSheet, RefreshControl, TextInput, ActivityIndicator, TouchableOpacity, View, ScrollView,
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
  { label: 'Schedule',    icon: 'calendar-outline'   as const, screen: 'Schedule',    bg: Palette.orange50, color: Palette.orange500 },
  { label: 'Matches',     icon: 'tennisball-outline'  as const, screen: 'Matches',     bg: Palette.orange50, color: Palette.orange500 },
  { label: 'My Leagues',  icon: 'trophy-outline'      as const, screen: 'MyLeagues',   bg: Palette.orange50, color: Palette.orange500 },
  { label: 'Rankings',    icon: 'podium-outline'      as const, screen: 'Competition', bg: Palette.orange50, color: Palette.orange500 },
  { label: 'Performance', icon: 'bar-chart-outline'   as const, screen: 'Performance', bg: Palette.orange50, color: Palette.orange500 },
  { label: 'Social',      icon: 'people-outline'      as const, screen: 'Social',      bg: Palette.orange50, color: Palette.orange500 },
  { label: 'Messages',    icon: 'chatbubble-outline'  as const, screen: 'Messages',    bg: Palette.orange50, color: Palette.orange500 },
  { label: 'Settings',    icon: 'settings-outline'    as const, screen: 'Settings',    bg: Palette.orange50, color: Palette.orange500 },
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
  const [refreshing, setRefreshing] = useState(false)

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
          colors={[Palette.dark900, Palette.dark700]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, gap: Spacing.lg }}
        >
          {/* Top row */}
          <XStack alignItems="flex-start" gap={Spacing.md}>
            <YStack flex={1}>
              <Text style={s.greeting}>{getGreeting()}</Text>
              <Text style={s.heroName}>{fullName}</Text>
              <XStack alignItems="center" gap={6} marginTop={6}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: readinessColor }} />
                <Text style={s.readinessTxt}>Match readiness {readinessScore}%</Text>
              </XStack>
            </YStack>

            <XStack alignItems="center" gap={Spacing.sm} paddingTop={2}>
              <TouchableOpacity
                style={s.notifBtn}
                onPress={() => navigation.navigate('Notifications')}
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
                    borderColor={Palette.dark900}
                  >
                    <Text style={{ fontSize: 9, color: '#fff', fontFamily: Font.bold }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </YStack>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
                <Avatar name={fullName} size={44} imageUrl={avatarUrl} style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
              </TouchableOpacity>
            </XStack>
          </XStack>

          {/* Stats strip */}
          <XStack
            backgroundColor="rgba(255,255,255,0.08)"
            borderRadius={Radius.lg}
            padding={Spacing.md}
            borderWidth={1}
            borderColor="rgba(255,255,255,0.10)"
          >
            {[
              { val: wins,       label: 'Wins'     },
              { val: losses,     label: 'Losses'   },
              { val: `${winRate}%`, label: 'Win Rate' },
              { val: streak,     label: 'Streak'   },
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && (
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 }} />
                )}
                <YStack flex={1} alignItems="center" gap={2}>
                  <Text style={s.statVal}>{stat.val}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </YStack>
              </React.Fragment>
            ))}
          </XStack>

          {/* Search bar */}
          <XStack
            alignItems="center"
            gap={Spacing.sm}
            backgroundColor="rgba(255,255,255,0.12)"
            borderRadius={Radius.full}
            paddingHorizontal={Spacing.md}
            height={44}
            marginTop={Spacing.md}
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
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </XStack>
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
          {/* Pending invites alert */}
          {pendingReceived.length > 0 && (
            <TouchableOpacity
              style={s.alertCard}
              onPress={() => navigation.navigate('Matches')}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />
              <YStack flex={1}>
                <Text style={s.alertTitle}>
                  {pendingReceived.length} pending match {pendingReceived.length === 1 ? 'invitation' : 'invitations'}
                </Text>
                <Text style={s.alertSub}>Tap to view and respond</Text>
              </YStack>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {/* Next Match */}
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
              <TouchableOpacity
                style={s.nextCard}
                onPress={() => navigation.navigate('Schedule')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Palette.dark800, Palette.dark600]}
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
              </TouchableOpacity>
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
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Schedule')}>
                  <Text style={s.emptyBtnTxt}>Schedule a Match</Text>
                </TouchableOpacity>
              </YStack>
            )}
          </YStack>

          {/* Quick Actions */}
          <YStack gap={Spacing.sm}>
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <XStack flexWrap="wrap" gap={10}>
              {QUICK_ACTIONS.map(a => (
                <TouchableOpacity
                  key={a.screen}
                  style={s.quickItem}
                  onPress={() => navigation.navigate(a.screen)}
                  activeOpacity={0.8}
                >
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
                </TouchableOpacity>
              ))}
            </XStack>
          </YStack>

          {/* Active Leagues */}
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
                <TouchableOpacity
                  key={reg.id}
                  style={s.leagueRow}
                  onPress={() => navigation.navigate('MyLeagues')}
                  activeOpacity={0.85}
                >
                  <YStack width={40} height={40} borderRadius={20} backgroundColor="#FEFCE8" alignItems="center" justifyContent="center">
                    <Ionicons name="trophy" size={18} color="#f59e0b" />
                  </YStack>
                  <Text style={s.leagueName} numberOfLines={1}>{reg.league_name || 'League'}</Text>
                  <YStack backgroundColor="#DCFCE7" paddingHorizontal={10} paddingVertical={3} borderRadius={Radius.full}>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.success, fontFamily: Font.semibold }}>Active</Text>
                  </YStack>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </YStack>

          {/* Achievements */}
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
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={22}
                      backgroundColor={unlocked ? a.color + '20' : Colors.borderLight}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons name={a.icon} size={20} color={unlocked ? a.color : Colors.textMuted} />
                    </YStack>
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

          {/* Shortcuts */}
          <YStack
            backgroundColor={Colors.surface}
            borderRadius={Radius.xl}
            borderWidth={1}
            borderColor={Colors.border}
            overflow="hidden"
          >
            <TouchableOpacity style={s.shortcutRow} onPress={() => navigation.navigate('NotificationSettings')}>
              <YStack width={36} height={36} borderRadius={Radius.md} backgroundColor="#FFF7ED" alignItems="center" justifyContent="center">
                <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
              </YStack>
              <Text style={s.shortcutTxt}>Notification Settings</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.md }} />
            <TouchableOpacity style={s.shortcutRow} onPress={() => navigation.navigate('Profile')}>
              <YStack width={36} height={36} borderRadius={Radius.md} backgroundColor="#F0FDF4" alignItems="center" justifyContent="center">
                <Ionicons name="person-outline" size={18} color="#10b981" />
              </YStack>
              <Text style={s.shortcutTxt}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </YStack>
        </YStack>
      </ScrollView>

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

  quickItem:    { width: '22%', alignItems: 'center', gap: 6 },
  quickLabel:   { fontSize: 10, fontFamily: Font.semibold, color: Colors.text, textAlign: 'center' },

  leagueRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.xs },
  leagueName:   { flex: 1, fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },

  shortcutRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  shortcutTxt:  { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontFamily: Font.medium },

  searchInput:  { flex: 1, fontSize: FontSize.sm, color: '#fff', paddingVertical: 0 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchName:   { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  searchMetaTxt:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  searchEmpty:  { padding: Spacing.md, textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.sm },
})
