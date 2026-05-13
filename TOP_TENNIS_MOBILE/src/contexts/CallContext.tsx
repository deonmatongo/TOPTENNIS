import React, { createContext, useContext, ReactNode } from 'react';
import { useCall, Call, CallType } from '@/hooks/useCall';

interface CallContextType {
  incomingCall: Call | null;
  activeCall: Call | null;
  livekitToken: string | null;
  startCall: (calleeId: string, type: CallType, conversationId?: string, isGroup?: boolean) => Promise<{ call: Call; token: string }>;
  answerCall: (call: Call) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  endCall: (callId: string) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCallContext = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallProvider');
  return ctx;
};

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const call = useCall();
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>;
};
