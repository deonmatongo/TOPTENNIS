import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface TimeProposal {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface ProposeMultipleTimesModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (proposals: TimeProposal[]) => Promise<void>;
  currentDate?: string;
  currentStartTime?: string;
  currentEndTime?: string;
}

export const ProposeMultipleTimesModal = ({
  open,
  onClose,
  onSubmit,
  currentDate,
  currentStartTime,
  currentEndTime,
}: ProposeMultipleTimesModalProps) => {
  const [proposals, setProposals] = useState<TimeProposal[]>([
    {
      id: crypto.randomUUID(),
      date: currentDate || '',
      start_time: currentStartTime || '09:00',
      end_time: currentEndTime || '10:00',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const addProposal = () => {
    setProposals([
      ...proposals,
      {
        id: crypto.randomUUID(),
        date: currentDate || '',
        start_time: '09:00',
        end_time: '10:00',
      },
    ]);
  };

  const removeProposal = (id: string) => {
    if (proposals.length === 1) {
      toast.error('You must have at least one time proposal');
      return;
    }
    setProposals(proposals.filter((p) => p.id !== id));
  };

  const updateProposal = (id: string, field: keyof TimeProposal, value: string) => {
    setProposals(
      proposals.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const handleSubmit = async () => {
    // Validate all proposals
    for (const proposal of proposals) {
      if (!proposal.date || !proposal.start_time || !proposal.end_time) {
        toast.error('Please fill in all fields for each proposal');
        return;
      }
      if (proposal.start_time >= proposal.end_time) {
        toast.error('End time must be after start time for all proposals');
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit(proposals);
      toast.success(`Proposed ${proposals.length} alternative time${proposals.length > 1 ? 's' : ''}`);
      onClose();
    } catch (error) {
      toast.error('Failed to propose times');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Propose Multiple Alternative Times
          </DialogTitle>
          <DialogDescription>
            Give your opponent several options to choose from
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {proposals.map((proposal, idx) => (
            <div key={proposal.id} className="flex items-start gap-3 p-4 border rounded-lg">
              <Badge variant="outline" className="mt-2">
                #{idx + 1}
              </Badge>
              <div className="flex-1 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`date-${proposal.id}`}>Date</Label>
                  <Input
                    id={`date-${proposal.id}`}
                    type="date"
                    value={proposal.date}
                    onChange={(e) => updateProposal(proposal.id, 'date', e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`start-${proposal.id}`}>Start Time</Label>
                    <Input
                      id={`start-${proposal.id}`}
                      type="time"
                      value={proposal.start_time}
                      onChange={(e) => updateProposal(proposal.id, 'start_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`end-${proposal.id}`}>End Time</Label>
                    <Input
                      id={`end-${proposal.id}`}
                      type="time"
                      value={proposal.end_time}
                      onChange={(e) => updateProposal(proposal.id, 'end_time', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              {proposals.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProposal(proposal.id)}
                  className="mt-2"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addProposal}
            className="w-full"
            disabled={proposals.length >= 5}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Time Option {proposals.length >= 5 && '(Max 5)'}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : `Propose ${proposals.length} Time${proposals.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
