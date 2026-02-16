import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { useMatchResponses, MatchWithResponse } from '@/hooks/useMatchResponses';
import { MatchResponseModal } from './MatchResponseModal';
import { PendingMatchInviteCard } from './PendingMatchInviteCard';
import { Skeleton } from '@/components/ui/skeleton';

export const MatchInvitesList = () => {
  const { pendingInvites, isLoading, respondToMatch } = useMatchResponses();
  const [selectedMatch, setSelectedMatch] = useState<MatchWithResponse | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleRespond = (
    action: 'accept' | 'decline' | 'propose',
    proposedStart?: Date,
    proposedEnd?: Date,
    comment?: string
  ) => {
    if (!selectedMatch) return;

    respondToMatch.mutate({
      matchId: selectedMatch.id,
      action,
      proposedStart,
      proposedEnd,
      comment
    });
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Match Invitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (pendingInvites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Match Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No pending match invitations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Match Invitations ({pendingInvites.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingInvites.map((match) => (
            <PendingMatchInviteCard
              key={match.id}
              match={match}
              onRespond={(match) => {
                setSelectedMatch(match);
                setShowModal(true);
              }}
            />
          ))}
        </CardContent>
      </Card>

      <MatchResponseModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedMatch(null);
        }}
        match={selectedMatch}
        onRespond={handleRespond}
      />
    </>
  );
};
