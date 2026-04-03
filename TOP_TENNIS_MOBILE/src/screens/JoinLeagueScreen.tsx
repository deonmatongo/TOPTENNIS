import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { Palette, Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { LeagueRegistrationModal } from '@/components/ui/LeagueRegistrationModal';
import type { League } from '@/hooks/useLeagueRegistrations';

export const JoinLeagueScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { allLeagues, registrations, loading, registerForLeague, isRegistered, refetch } = useLeagueRegistrations();
  const { player } = usePlayerProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [showModal, setShowModal] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleOpenRegistration = (league: League) => {
    setSelectedLeague(league);
    setShowModal(true);
  };

  const handleRegister = async (leagueId: string) => {
    await registerForLeague(leagueId);
    await refetch();
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return Colors.success;
      case 'waitlist': return Colors.warning;
      case 'closed': return Colors.error;
      default: return Colors.textMuted;
    }
  };

  const getStatusBg = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return Colors.successLight;
      case 'waitlist': return Colors.warningLight;
      case 'closed': return Colors.errorLight;
      default: return Colors.background;
    }
  };

  const activeRegistrations = registrations.filter(r => r.status === 'active');
  const openLeagues = allLeagues.filter(l => l.status === 'Open' || l.status === 'Waitlist' || l.status === 'Registration Open' || l.status === 'Registration Closing Soon');
  const closedLeagues = allLeagues.filter(l => l.status === 'Closed' || l.status === 'Completed');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={[Palette.dark900, Palette.dark700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradHeader}>
        <TouchableOpacity style={styles.gradBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.gradTitle}>Join a League</Text>
          <Text style={styles.gradSub}>{player?.skill_level ? `Your level: ${player.skill_level}/10` : 'League registration'}</Text>
        </View>
      </LinearGradient>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.content}>
          {loading && !refreshing ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Active Registrations Banner */}
              {activeRegistrations.length > 0 && (
                <View style={styles.activeCard}>
                  <View style={styles.activeCardHeader}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={styles.activeCardTitle}>Your Active Registrations</Text>
                  </View>
                  <Text style={styles.activeCardSub}>
                    You are currently registered for {activeRegistrations.length} league{activeRegistrations.length > 1 ? 's' : ''}:
                  </Text>
                  {activeRegistrations.map(reg => (
                    <View key={reg.id} style={styles.activeRegRow}>
                      <View style={styles.activeRegInfo}>
                        <Text style={styles.activeRegName}>{reg.league_name}</Text>
                        <Text style={styles.activeRegDate}>
                          Registered {new Date(reg.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Waitlist notice */}
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color="#92400e" />
                <Text style={styles.infoBannerText}>
                  <Text style={{ fontWeight: FontWeight.bold }}>Important: </Text>
                  If you register for a league with a status of "Waitlist", Top Tennis League will make all efforts to place you in a division. If we are unable to, we will refund your registration fees in full.
                </Text>
              </View>

              {/* Available Leagues */}
              {openLeagues.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No open leagues</Text>
                  <Text style={styles.emptySub}>Check back soon for new league registrations.</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Available Leagues</Text>
                  <Text style={styles.sectionSub}>
                    You can register for multiple leagues. Tap any league you wish to participate in.
                  </Text>
                  {openLeagues.map(league => {
                    const registered = isRegistered(league.id);
                    const isClosed = league.status?.toLowerCase() === 'closed';
                    const isWaitlist = league.status?.toLowerCase() === 'waitlist';
                    return (
                      <View key={league.id} style={styles.leagueCard}>
                        <View style={styles.leagueCardTop}>
                          <View style={styles.leagueInfo}>
                            <Text style={styles.leagueName}>{league.name}</Text>
                            {league.prize && (
                              <View style={styles.detailRow}>
                                <Ionicons name="cash-outline" size={13} color={Colors.success} />
                                <Text style={[styles.detailText, { color: Colors.success, fontWeight: FontWeight.semibold }]}>
                                  Sign-Up Fee: {league.prize}
                                </Text>
                              </View>
                            )}
                            {league.location && (
                              <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                                <Text style={styles.detailText}>{league.location}</Text>
                              </View>
                            )}
                          </View>
                          {registered ? (
                            <View style={styles.registeredBadge}>
                              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                              <Text style={styles.registeredText}>Registered</Text>
                            </View>
                          ) : (
                            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(league.status) }]}>
                              <Text style={[styles.statusText, { color: getStatusColor(league.status) }]}>
                                {league.status}
                              </Text>
                            </View>
                          )}
                        </View>

                        {league.description && (
                          <Text style={styles.leagueDesc}>{league.description}</Text>
                        )}

                        <View style={styles.metaRow}>
                          {league.season && (
                            <View style={styles.metaItem}>
                              <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                              <Text style={styles.metaText}>Start: {league.season}</Text>
                            </View>
                          )}
                          {league.category && (
                            <View style={styles.metaItem}>
                              <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                              <Text style={styles.metaText}>{league.category}</Text>
                            </View>
                          )}
                          {league.level && (
                            <View style={styles.metaItem}>
                              <Ionicons name="tennisball-outline" size={13} color={Colors.textMuted} />
                              <Text style={styles.metaText}>{league.level}</Text>
                            </View>
                          )}
                          {league.players != null && (
                            <View style={styles.metaItem}>
                              <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                              <Text style={styles.metaText}>{league.players} players</Text>
                            </View>
                          )}
                        </View>

                        {isWaitlist && (
                          <View style={styles.waitlistBanner}>
                            <Ionicons name="time-outline" size={14} color={Colors.warning} />
                            <Text style={styles.waitlistText}>
                              This league is on waitlist. We'll place you in a division if space becomes available.
                            </Text>
                          </View>
                        )}

                        {!registered && (
                          <TouchableOpacity
                            style={[styles.registerBtn, isClosed && styles.registerBtnDisabled]}
                            onPress={() => !isClosed && handleOpenRegistration(league)}
                            disabled={isClosed}
                          >
                            <Ionicons name="add-circle-outline" size={18} color="#fff" />
                            <Text style={styles.registerBtnText}>
                              {isClosed ? 'Registration Closed' : 'Register Now'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </>
              )}

              {/* Closed / past leagues */}
              {closedLeagues.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: Spacing.sm }]}>Past Leagues</Text>
                  {closedLeagues.map(league => (
                    <View key={league.id} style={[styles.leagueCard, styles.leagueCardCompleted]}>
                      <Text style={styles.leagueName}>{league.name}</Text>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedText}>Completed</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Multi-league note */}
              {activeRegistrations.length > 0 && (
                <View style={styles.blueBanner}>
                  <Ionicons name="information-circle-outline" size={16} color="#1d4ed8" />
                  <Text style={styles.blueBannerText}>
                    <Text style={{ fontWeight: FontWeight.bold }}>Multi-League Participation: </Text>
                    You can participate in multiple leagues simultaneously. Each league operates independently, so you can enjoy different formats and competition levels.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <LeagueRegistrationModal
        visible={showModal}
        league={selectedLeague}
        onClose={() => { setShowModal(false); setSelectedLeague(null); }}
        onRegister={handleRegister}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  gradHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
  gradBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  gradTitle: { fontSize: 22, fontWeight: FontWeight.black, color: '#fff' },
  gradSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: -Spacing.sm },

  // Active registrations card
  activeCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#bbf7d0', gap: Spacing.sm },
  activeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  activeCardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  activeCardSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  activeRegRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#bbf7d0' },
  activeRegInfo: { flex: 1 },
  activeRegName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#166534' },
  activeRegDate: { fontSize: FontSize.xs, color: '#16a34a', marginTop: 2 },
  activeBadge: { backgroundColor: '#dcfce7', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: '#bbf7d0' },
  activeBadgeText: { fontSize: FontSize.xs, color: '#166534', fontWeight: FontWeight.semibold },

  // Banners
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: Radius.md, padding: Spacing.md },
  infoBannerText: { flex: 1, fontSize: FontSize.xs, color: '#92400e', lineHeight: 18 },
  waitlistBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.warningLight, borderRadius: Radius.sm, padding: Spacing.sm },
  waitlistText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 16 },
  blueBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: Radius.md, padding: Spacing.md },
  blueBannerText: { flex: 1, fontSize: FontSize.xs, color: '#1e40af', lineHeight: 18 },

  // League cards
  leagueCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  leagueCardCompleted: { opacity: 0.6 },
  leagueCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leagueInfo: { flex: 1, gap: 4 },
  leagueName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  leagueDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  metaText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Badges
  registeredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  registeredText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  completedBadge: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start' },
  completedText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Buttons
  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.md },
  registerBtnDisabled: { backgroundColor: Colors.textMuted },
  registerBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },

  // Empty state
  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
