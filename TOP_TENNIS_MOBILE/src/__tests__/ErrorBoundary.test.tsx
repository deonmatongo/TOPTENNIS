import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Boom = () => { throw new Error('Test crash'); };

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <></>
      </ErrorBoundary>
    );
    expect(() => getByText('Something went wrong')).toThrow();
  });

  it('shows fallback UI when a child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('resets after tapping Try Again', () => {
    const { getByText, queryByText, rerender } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    // Swap in a healthy child so the reset can succeed
    rerender(
      <ErrorBoundary>
        <></>
      </ErrorBoundary>
    );
    fireEvent.press(getByText('Try Again'));
    expect(queryByText('Something went wrong')).toBeNull();
  });
});
