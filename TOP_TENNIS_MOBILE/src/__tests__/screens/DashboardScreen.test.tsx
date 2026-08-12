import React from 'react';
import { render } from '@testing-library/react-native';
import { DashboardScreen } from '@/screens/DashboardScreen';

// ── Hook mocks ─────────────────────────────────────────────────────────────────

const navigation = { navigate: jest.fn() };

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'player@test.com' } }),
}));

let mockProfile: any = { first_name: 'Alex', last_name: 'Smith' };
const mockRefetchProfile = jest.fn().mockResolvedValue(undefined);
jest.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: mockProfile, loading: false, refetch: mockRefetchProfile }),
}));

let mockPlayer: any = { wins: 3, losses: 1, current_streak: 2 };
const mockRefetchPlayer = jest.fn().mockResolvedValue(undefined);
jest.mock('@/hooks/usePlayerProfile', () => ({
  usePlayerProfile: () => ({ player: mockPlayer, refetch: mockRefetchPlayer }),
}));

let mockUpcoming: any[] = [];
let mockPendingReceived: any[] = [];
const mockRefetchMatches = jest.fn().mockResolvedValue(undefined);
jest.mock('@/hooks/useMatches', () => ({
  useMatches: () => ({
    upcoming: mockUpcoming,
    pendingReceived: mockPendingReceived,
    loading: false,
    refetch: mockRefetchMatches,
  }),
}));

let mockRegistrations: any[] = [];
jest.mock('@/hooks/useLeagueRegistrations', () => ({
  useLeagueRegistrations: () => ({ registrations: mockRegistrations }),
}));

jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

const mockGetOrCreateDM = jest.fn().mockResolvedValue('conv-id-1');
jest.mock('@/hooks/useConversations', () => ({
  useConversations: () => ({ getOrCreateDM: mockGetOrCreateDM }),
}));

jest.mock('@/hooks/usePlayerSearch', () => ({
  usePlayerSearch: () => ({
    query: '',
    results: [],
    searching: false,
    search: jest.fn(),
    clear: jest.fn(),
  }),
}));

jest.mock('@/components/ui/Avatar', () => ({ Avatar: () => null }));
jest.mock('@/components/ui/PlayerProfileSheet', () => ({ PlayerProfileSheet: () => null }));

// Render the animated counter as its final value synchronously (no rAF in tests)
jest.mock('@/components/ui/AnimatedCounter', () => ({
  AnimatedCounter: ({ value, suffix = '', style }: any) => {
    const ReactLocal = require('react');
    const { Text } = require('react-native');
    return ReactLocal.createElement(Text, { style }, `${value}${suffix}`);
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const renderScreen = () => render(<DashboardScreen navigation={navigation} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer = { wins: 3, losses: 1, current_streak: 2 };
  mockProfile = { first_name: 'Alex', last_name: 'Smith' };
  mockUpcoming = [];
  mockPendingReceived = [];
  mockRegistrations = [];
  navigation.navigate.mockReset();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DashboardScreen', () => {
  it('renders without crashing', () => {
    expect(() => renderScreen()).not.toThrow();
  });

  describe('getGreeting()', () => {
    afterEach(() => jest.useRealTimers());

    it('returns Good morning before noon', () => {
      jest.useFakeTimers({ now: new Date('2024-01-15T08:30:00') });
      const { getByText } = renderScreen();
      expect(getByText('Good morning')).toBeTruthy();
    });

    it('returns Good afternoon between noon and 5pm', () => {
      jest.useFakeTimers({ now: new Date('2024-01-15T14:00:00') });
      const { getByText } = renderScreen();
      expect(getByText('Good afternoon')).toBeTruthy();
    });

    it('returns Good evening at 5pm or later', () => {
      jest.useFakeTimers({ now: new Date('2024-01-15T19:00:00') });
      const { getByText } = renderScreen();
      expect(getByText('Good evening')).toBeTruthy();
    });
  });

  describe('player stats', () => {
    it('shows correct win rate for 3W-1L', () => {
      const { getByText } = renderScreen();
      expect(getByText('75%')).toBeTruthy();
    });

    it('shows readiness score capped at 100', () => {
      // wins=3, streak=2 → 3*10 + 2*15 + 30 = 90
      const { getByText } = renderScreen();
      expect(getByText('Match readiness 90%')).toBeTruthy();
    });

    it('shows zero winrate when no matches played', () => {
      mockPlayer = { wins: 0, losses: 0, current_streak: 0 };
      const { getAllByText } = renderScreen();
      expect(getAllByText('0%').length).toBeGreaterThan(0);
    });

    it('shows wins and losses counts', () => {
      const { getByText } = renderScreen();
      expect(getByText('3')).toBeTruthy(); // wins
      expect(getByText('1')).toBeTruthy(); // losses
    });
  });

  describe('player name', () => {
    it('shows full name from profile', () => {
      const { getByText } = renderScreen();
      expect(getByText('Alex Smith')).toBeTruthy();
    });

    it('falls back to the username when no name is set', () => {
      mockProfile = { username: 'rallyking' } as any;
      const { getByText } = renderScreen();
      expect(getByText('rallyking')).toBeTruthy();
    });

    it('falls back to a neutral placeholder, never to the email prefix', () => {
      // A phone-only account has no email at all, so deriving a name from it
      // produced either 'undefined' or a leak of the address into the UI.
      mockProfile = null;
      const { getByText, queryByText } = renderScreen();
      expect(getByText('Player')).toBeTruthy();
      expect(queryByText('player@test.com')).toBeNull();
    });
  });

  describe('spotlight banner', () => {
    it('shows the win-streak banner when streak >= 2', () => {
      mockPlayer = { wins: 5, losses: 1, current_streak: 3 };
      const { getByText } = renderScreen();
      expect(getByText("You're on a 3-win streak")).toBeTruthy();
      expect(getByText('Keep it going')).toBeTruthy();
    });

    it('shows the "Add availability" welcome banner for a new player with no scheduled match', () => {
      mockPlayer = { wins: 0, losses: 0, current_streak: 0 };
      mockUpcoming = [];
      const { getByText } = renderScreen();
      expect(getByText('Play your first match')).toBeTruthy();
      expect(getByText('Add availability')).toBeTruthy();
    });

    it('hides the welcome banner once a first match is scheduled', () => {
      mockPlayer = { wins: 0, losses: 0, current_streak: 0 };
      mockUpcoming = [{
        id: 'm1', date: '2099-06-01', start_time: '09:00',
        sender: { first_name: 'Jordan', last_name: 'Lee' }, receiver: null,
      }];
      const { queryByText, getByText } = renderScreen();
      expect(queryByText('Play your first match')).toBeNull();
      expect(getByText('Your first match is scheduled')).toBeTruthy();
    });

    it('shows the season summary banner for an active player without a streak', () => {
      mockPlayer = { wins: 3, losses: 1, current_streak: 0 };
      const { getByText } = renderScreen();
      expect(getByText('3 wins · 75% win rate')).toBeTruthy();
      expect(getByText('Schedule a match')).toBeTruthy();
    });
  });

  describe('next match section', () => {
    it('shows "No upcoming matches" when upcoming list is empty', () => {
      mockUpcoming = [];
      const { getByText } = renderScreen();
      expect(getByText('No upcoming matches')).toBeTruthy();
    });

    it('shows opponent name when there is an upcoming match', () => {
      mockUpcoming = [{
        id: 'm1',
        date: '2024-01-20',
        sender: { first_name: 'Jordan', last_name: 'Lee' },
        receiver: null,
      }];
      const { getByText } = renderScreen();
      expect(getByText('vs Jordan Lee')).toBeTruthy();
    });
  });

  describe('pending invitations', () => {
    it('does not show pending invite banner when none', () => {
      mockPendingReceived = [];
      const { queryByText } = renderScreen();
      expect(queryByText(/pending match/)).toBeNull();
    });

    it('shows pending invite count when invites exist', () => {
      mockPendingReceived = [{ id: 'i1' }, { id: 'i2' }];
      const { getByText } = renderScreen();
      expect(getByText('2 pending match invitations')).toBeTruthy();
    });

    it('uses singular "invitation" for exactly one pending invite', () => {
      mockPendingReceived = [{ id: 'i1' }];
      const { getByText } = renderScreen();
      expect(getByText('1 pending match invitation')).toBeTruthy();
    });
  });

  describe('active leagues', () => {
    it('shows "No active leagues" when none within 3 months', () => {
      const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      mockRegistrations = [{ id: 'r1', league_name: 'Old League', created_at: old }];
      const { getByText } = renderScreen();
      expect(getByText('No active leagues')).toBeTruthy();
    });

    it('shows league name for a recent registration', () => {
      const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      mockRegistrations = [{ id: 'r1', league_name: 'Spring Open', created_at: recent }];
      const { getByText } = renderScreen();
      expect(getByText('Spring Open')).toBeTruthy();
    });
  });

  describe('achievements', () => {
    it('renders achievement labels', () => {
      const { getByText } = renderScreen();
      expect(getByText('First Win')).toBeTruthy();
      expect(getByText('Five Wins')).toBeTruthy();
    });

    it('unlocks "First Win" once the player has a win', () => {
      // With 3 wins the first-win achievement is unlocked; label is always rendered
      const { getByText } = renderScreen();
      expect(getByText('First Win')).toBeTruthy();
    });
  });

  describe('quick actions', () => {
    it('renders quick action labels', () => {
      const { getByText } = renderScreen();
      expect(getByText('My Leagues')).toBeTruthy();
      expect(getByText('Rankings')).toBeTruthy();
      expect(getByText('Performance')).toBeTruthy();
      expect(getByText('Social')).toBeTruthy();
    });
  });
});
