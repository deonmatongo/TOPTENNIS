import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { User, Edit3, Trophy, Calendar, MapPin, Mail, Phone, Target, Flame, Users, Network, Camera, Save, X } from "lucide-react";
interface ProfileTabProps {
  player: any;
}
const ProfileTab = ({
  player
}: ProfileTabProps) => {
  const {
    profile,
    updateProfile
  } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    phone: player?.phone || '',
    location: profile?.location || '',
    city: profile?.city || '',
    zip_code: profile?.zip_code || ''
  });
  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        phone: editedData.phone,
        location: editedData.location,
        city: editedData.city,
        zip_code: editedData.zip_code
      });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };
  const handleNetworkingToggle = async (enabled: boolean) => {
    try {
      await updateProfile({
        networking_enabled: enabled
      });
      toast.success(`Networking ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error("Failed to update networking preference");
    }
  };
  const handleCancelEdit = () => {
    setEditedData({
      phone: player?.phone || '',
      location: profile?.location || '',
      city: profile?.city || '',
      zip_code: profile?.zip_code || ''
    });
    setIsEditing(false);
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-16 w-16 border-4 border-background shadow-lg">
              <AvatarImage src={profile?.profile_picture_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xl font-bold">
                {player?.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <Button size="sm" variant="outline" className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full p-0 shadow-md">
              <Camera className="h-3 w-3" />
            </Button>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{player?.name || 'Player'}</h1>
            <p className="text-muted-foreground flex items-center space-x-2">
              <Trophy className="w-4 h-4" />
              <span>Level {player?.usta_rating || `${player?.skill_level || 5.0}`}</span>
              <span className="text-muted-foreground/60">•</span>
              <span>Member #{profile?.membership_id || 'Generating...'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Personal Information - Merged with Playing Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-primary" />
              <span>Personal Information & Playing Preferences</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name - Non-editable */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                <div className="text-sm font-medium p-3 bg-muted/30 rounded-md text-muted-foreground/70 cursor-not-allowed">
                  {profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : player?.name || 'Not provided'}
                </div>
              </div>

              {/* Email - Non-editable */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <div className="flex items-center space-x-2 text-sm font-medium p-3 bg-muted/30 rounded-md text-muted-foreground/70 cursor-not-allowed">
                  <Mail className="w-4 h-4 text-muted-foreground/70" />
                  <span>{profile?.email || player?.email || 'Not provided'}</span>
                </div>
              </div>

              {/* Phone Number - Editable */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                {isEditing ? <Input value={editedData.phone} onChange={e => setEditedData({
                ...editedData,
                phone: e.target.value
              })} placeholder="Enter your phone number" /> : <div className="flex items-center space-x-2 text-sm font-medium p-3 bg-muted/50 rounded-md">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{profile?.phone || player?.phone || 'Not provided'}</span>
                  </div>}
              </div>

              {/* Home Court Address - Editable */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Home Court Address</label>
                {isEditing ? <Input value={editedData.location} onChange={e => setEditedData({
                ...editedData,
                location: e.target.value
              })} placeholder="Enter your home court address" /> : <div className="flex items-center space-x-2 text-sm font-medium p-3 bg-muted/50 rounded-md">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{profile?.location || 'Not provided'}</span>
                  </div>}
              </div>

              {/* City - Editable */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">City</label>
                {isEditing ? <Input value={editedData.city} onChange={e => setEditedData({
                ...editedData,
                city: e.target.value
              })} placeholder="Enter your city" /> : <div className="text-sm font-medium p-3 bg-muted/50 rounded-md">
                    {profile?.city || 'Not provided'}
                  </div>}
              </div>

              {/* ZIP Code - Editable */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">ZIP Code</label>
                {isEditing ? <Input value={editedData.zip_code} onChange={e => setEditedData({
                ...editedData,
                zip_code: e.target.value
              })} placeholder="Enter your ZIP code" /> : <div className="text-sm font-medium p-3 bg-muted/50 rounded-md">
                    {profile?.zip_code || 'Not provided'}
                  </div>}
              </div>
            </div>

            <Separator />

            {/* Playing Preferences - Merged into Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Playing Preferences
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Skill Level - Non-editable */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Skill Level
                  </label>
                  <div className="p-3 bg-muted/30 rounded-md text-muted-foreground/70 cursor-not-allowed">
                    <div className="font-medium">
                      {player?.usta_rating || `Level ${player?.skill_level || 'Not set'}`}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Official tennis rating (cannot be changed)
                    </div>
                  </div>
                </div>

                {/* Competitiveness */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Flame className="w-4 h-4" />
                    Competitiveness
                  </label>
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="font-medium capitalize">
                      {player?.competitiveness || 'Not set'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Match intensity preference
                    </div>
                  </div>
                </div>

                {/* Gender - Non-editable */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Gender
                  </label>
                  <div className="p-3 bg-muted/30 rounded-md text-muted-foreground/70 cursor-not-allowed">
                    <div className="font-medium capitalize">
                      {player?.gender || 'Not specified'}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Your gender identity (cannot be changed)
                    </div>
                  </div>
                </div>

                {/* Gender Preference */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Opponent Gender Preference
                  </label>
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="font-medium">
                      {player?.gender_preference === 'no-preference' && 'No preference'}
                      {player?.gender_preference === 'same-gender' && 'Same gender'}
                      {player?.gender_preference === 'mixed' && 'Mixed matches'}
                      {!player?.gender_preference && 'Not set'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Preferred opponent gender
                    </div>
                  </div>
                </div>

                {/* Age Range - Non-editable */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Age Range
                  </label>
                  <div className="p-3 bg-muted/30 rounded-md text-muted-foreground/70 cursor-not-allowed">
                    <div className="font-medium">
                      {player?.age_range === '18-25' && '18-25'}
                      {player?.age_range === '26-40' && '26-40'}
                      {player?.age_range === '41-54' && '41-54'}
                      {player?.age_range === '55-plus' && '55+'}
                      {!player?.age_range && 'Not set'}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Your age group (cannot be changed)
                    </div>
                  </div>
                </div>

                {/* Travel Distance */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Travel Distance
                  </label>
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="font-medium">
                      {player?.travel_distance === '0-5' && 'Within 5 miles'}
                      {player?.travel_distance === '0-10' && '0-10 miles'}
                      {player?.travel_distance === '0-15' && '0-15 miles'}
                      {player?.travel_distance === '0-20' && '0-20 miles'}
                      {player?.travel_distance === '0-30' && '0-30 miles'}
                      {player?.travel_distance === 'no-limit' && "Distance doesn't matter"}
                      {!player?.travel_distance && 'Not set'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Maximum distance willing to travel
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Age Competition Preference */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Competition Bracket Preference
                  </label>
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="font-medium">
                      {player?.age_competition_preference === 'within-bracket' && 'Compete within my age bracket'}
                      {player?.age_competition_preference === 'below-bracket' && 'Compete below my age bracket'}
                      {player?.age_competition_preference === 'no-preference' && 'No preference'}
                      {!player?.age_competition_preference && 'Not set'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Age bracket competition preference
                    </div>
                  </div>
                </div>
              </div>

              {/* Preference Summary Badges */}
              <div className="space-y-2 pt-4 border-t">
                <h4 className="text-sm font-medium text-muted-foreground">Match Preferences Summary</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="justify-center p-2">
                    <Trophy className="w-3 h-3 mr-1" />
                    {player?.usta_rating || `Level ${player?.skill_level || 'N/A'}`}
                  </Badge>
                  <Badge variant="outline" className="justify-center p-2">
                    <Flame className="w-3 h-3 mr-1" />
                    {player?.competitiveness || 'N/A'}
                  </Badge>
                  <Badge variant="outline" className="justify-center p-2">
                    <Users className="w-3 h-3 mr-1" />
                    {player?.gender_preference === 'no-preference' && 'Any gender'}
                    {player?.gender_preference === 'same-gender' && 'Same gender'}
                    {player?.gender_preference === 'mixed' && 'Mixed'}
                    {!player?.gender_preference && 'N/A'}
                  </Badge>
                  <Badge variant="outline" className="justify-center p-2">
                    <Calendar className="w-3 h-3 mr-1" />
                    {player?.age_range || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Networking Preferences */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    Build Your Network
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Allow other players to send you connection requests and view your profile
                  </p>
                </div>
                <Switch checked={profile?.networking_enabled ?? true} onCheckedChange={handleNetworkingToggle} />
              </div>
              
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                <p className="font-medium mb-1">Networking Settings:</p>
                <p>• <strong>On:</strong> Can request and accept connections, profile visible to others</p>
                <p>• <strong>Off:</strong> Profile visible but other players cannot send connection requests</p>
              </div>
            </div>

            {isEditing && <div className="flex items-center space-x-2 pt-4 border-t">
                <Button onClick={handleSaveProfile} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button onClick={handleCancelEdit} variant="outline" className="flex-1">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>}

            {!isEditing && <div className="pt-4 border-t">
                <Button onClick={() => setIsEditing(true)} className="w-full">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>}
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default ProfileTab;