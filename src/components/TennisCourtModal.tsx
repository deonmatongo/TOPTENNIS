import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock, Phone, Globe, Users } from "lucide-react";

interface TennisCourtModalProps {
  court: any;
  isOpen: boolean;
  onClose: () => void;
}

const TennisCourtModal = ({ court, isOpen, onClose }: TennisCourtModalProps) => {
  if (!court) return null;

  const openInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${court.lat},${court.lng}`;
    window.open(url, '_blank');
  };

  const getDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="w-6 h-6 text-orange-500" />
            <span className="font-bold">{court.name}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Address */}
          <div>
            <h4 className="font-semibold text-sm mb-1">Location</h4>
            <p className="text-sm text-muted-foreground">{court.address}</p>
            {court.distance && (
              <Badge variant="secondary" className="mt-1">
                {court.distance} away
              </Badge>
            )}
          </div>

          {/* Coordinates */}
          <div>
            <h4 className="font-semibold text-sm mb-1">Coordinates</h4>
            <p className="text-sm text-muted-foreground font-mono">
              {court.lat.toFixed(6)}, {court.lng.toFixed(6)}
            </p>
          </div>

          {/* Amenities if available from OpenStreetMap data */}
          {court.tags && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Details</h4>
              <div className="space-y-1">
                {court.tags.surface && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>Surface: {court.tags.surface}</span>
                  </div>
                )}
                {court.tags.access && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Access: {court.tags.access}</span>
                  </div>
                )}
                {court.tags.fee && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Fee: {court.tags.fee}</span>
                  </div>
                )}
                {court.tags.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{court.tags.phone}</span>
                  </div>
                )}
                {court.tags.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a href={court.tags.website} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={getDirections} className="flex-1" variant="default">
              <Navigation className="w-4 h-4 mr-2" />
              Directions
            </Button>
            <Button onClick={openInMaps} variant="outline" className="flex-1">
              <MapPin className="w-4 h-4 mr-2" />
              View on Map
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TennisCourtModal;