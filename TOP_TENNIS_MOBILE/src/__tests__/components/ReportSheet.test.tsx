import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ReportSheet } from '@/components/ui/ReportSheet';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'player@test.com' } }),
}));

const getDB = () => (jest.requireMock('@/services/supabase').supabase.from as jest.Mock)();

beforeEach(() => jest.clearAllMocks());

describe('ReportSheet', () => {
  it('renders reasons when visible', () => {
    const { getByText } = render(
      <ReportSheet visible onClose={jest.fn()} context="message" targetUserId="u2" refId="m1" />,
    );
    expect(getByText('Harassment or bullying')).toBeTruthy();
    expect(getByText('Spam or scam')).toBeTruthy();
  });

  it('submit is disabled until a reason is chosen, then files a report', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    const { getByText } = render(
      <ReportSheet visible onClose={onClose} context="profile" targetUserId="u2" refId="u2" subjectLabel="Sam" />,
    );

    fireEvent.press(getByText('Impersonation'));
    fireEvent.press(getByText('Submit report'));

    await waitFor(() =>
      expect(getDB().insert).toHaveBeenCalledWith(
        expect.objectContaining({ reporter_id: 'u1', target_user_id: 'u2', context: 'profile', reason: 'Impersonation' }),
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    alertSpy.mockRestore();
  });
});
