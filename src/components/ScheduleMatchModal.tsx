
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMatches } from "@/hooks/useMatches";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Loader2 } from "lucide-react";

interface ScheduleMatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ScheduleMatchModal = ({ open, onOpenChange }: ScheduleMatchModalProps) => {
  const { user } = useAuth();
  const { createMatch } = useMatches();
  const { players } = useLeaderboard();
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [formData, setFormData] = useState({
    opponent_id: '',
    match_date: '',
    match_time: '',
    court_location: ''
  });

  // Filter out current user from opponent list
  const availableOpponents = players.filter(player => player.user_id !== user?.id);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const address = data.display_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setFormData(prev => ({ ...prev, court_location: address }));
        } catch {
          toast.error('Could not resolve location name');
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        toast.error('Location access denied');
        setGeoLoading(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.opponent_id || !formData.match_date || !formData.match_time || !formData.court_location) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const matchDateTime = `${formData.match_date}T${formData.match_time}:00`;
      await createMatch({
        player2_id: formData.opponent_id,
        match_date: matchDateTime,
        court_location: formData.court_location
      });
      
      toast.success('Match scheduled successfully!');
      onOpenChange(false);
      setFormData({
        opponent_id: '',
        match_date: '',
        match_time: '',
        court_location: ''
      });
    } catch (error) {
      console.error('Error scheduling match:', error);
      toast.error('Failed to schedule match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule New Match</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="opponent">Opponent</Label>
            <Select value={formData.opponent_id} onValueChange={(value) => setFormData(prev => ({ ...prev, opponent_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select opponent" />
              </SelectTrigger>
              <SelectContent>
                {availableOpponents.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name} (Level: {player.usta_rating || player.skill_level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="match_date">Date</Label>
              <Input
                id="match_date"
                type="date"
                value={formData.match_date}
                onChange={(e) => setFormData(prev => ({ ...prev, match_date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label htmlFor="match_time">Time</Label>
              <Input
                id="match_time"
                type="time"
                value={formData.match_time}
                onChange={(e) => setFormData(prev => ({ ...prev, match_time: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="court_location">Court Location</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="court_location"
                value={formData.court_location}
                onChange={(e) => setFormData(prev => ({ ...prev, court_location: e.target.value }))}
                placeholder="e.g., Central Tennis Club - Court 1"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                title="Use my current location"
              >
                {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Match'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleMatchModal;
