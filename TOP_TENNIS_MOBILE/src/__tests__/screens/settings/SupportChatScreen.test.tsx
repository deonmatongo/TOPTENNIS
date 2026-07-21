import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SupportChatScreen } from '@/screens/settings/SupportChatScreen';

const navigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('SupportChatScreen', () => {
  it('renders the greeting and quick replies', () => {
    const { getByText } = render(<SupportChatScreen navigation={navigation} />);
    expect(getByText(/I’m the Top Tennis assistant/)).toBeTruthy();
    expect(getByText('Reschedule a match')).toBeTruthy();
    expect(getByText('Billing question')).toBeTruthy();
  });

  it('adds the user message and an assistant reply when a quick reply is tapped', () => {
    const { getByText, getAllByText } = render(<SupportChatScreen navigation={navigation} />);
    fireEvent.press(getByText('Reschedule a match'));
    // the label now exists twice: the chip and the sent bubble
    expect(getAllByText('Reschedule a match').length).toBeGreaterThanOrEqual(2);
    // assistant reply arrives after the typing delay
    act(() => { jest.advanceTimersByTime(700); });
    expect(getByText(/Propose new time/)).toBeTruthy();
  });

  it('gives a billing answer that offers a human hand-off button', () => {
    const { getByText, getAllByText, getByPlaceholderText } = render(<SupportChatScreen navigation={navigation} />);
    const input = getByPlaceholderText('Type a message…');
    fireEvent.changeText(input, 'I was charged twice, need a refund');
    fireEvent(input, 'submitEditing');
    act(() => { jest.advanceTimersByTime(700); });
    expect(getAllByText(/human agent/).length).toBeGreaterThanOrEqual(1);
    expect(getByText('Email a human agent')).toBeTruthy();
  });

  it('opens a mailto link when the human hand-off button is pressed', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);
    const { getByText, getByPlaceholderText } = render(<SupportChatScreen navigation={navigation} />);
    const input = getByPlaceholderText('Type a message…');
    fireEvent.changeText(input, 'talk to a human please');
    fireEvent(input, 'submitEditing');
    act(() => { jest.advanceTimersByTime(700); });
    fireEvent.press(getByText('Email a human agent'));
    expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:support@toptennis.app'));
    openURLSpy.mockRestore();
  });

  it('does not send an empty message', () => {
    const { getByPlaceholderText, queryAllByText } = render(<SupportChatScreen navigation={navigation} />);
    const input = getByPlaceholderText('Type a message…');
    fireEvent.changeText(input, '   ');
    fireEvent(input, 'submitEditing');
    act(() => { jest.advanceTimersByTime(700); });
    // still only the greeting bot bubble — no new user/bot messages
    expect(queryAllByText(/typing/).length).toBe(0);
  });
});
