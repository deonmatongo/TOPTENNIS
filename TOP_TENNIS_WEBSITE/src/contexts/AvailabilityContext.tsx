import React, { createContext, useContext } from 'react';
import { useUserAvailability } from '@/hooks/useUserAvailability';

type AvailabilityContextType = ReturnType<typeof useUserAvailability>;

const AvailabilityContext = createContext<AvailabilityContextType | undefined>(undefined);

export const AvailabilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const availability = useUserAvailability();
  return (
    <AvailabilityContext.Provider value={availability}>
      {children}
    </AvailabilityContext.Provider>
  );
};

export const useAvailabilityContext = () => {
  const ctx = useContext(AvailabilityContext);
  if (!ctx) throw new Error('useAvailabilityContext must be used within an AvailabilityProvider');
  return ctx;
};
