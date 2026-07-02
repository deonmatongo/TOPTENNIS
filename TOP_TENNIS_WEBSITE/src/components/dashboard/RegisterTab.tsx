
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, DollarSign, Users, CheckCircle } from 'lucide-react';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { toast } from 'sonner';
import LeagueRegistrationModal from './LeagueRegistrationModal';

const RegisterTab = () => {
  const { 
    registrations, 
    loading, 
    registerForLeague, 
    isRegisteredForLeague,
    getRegisteredLeagueIds 
  } = useLeagueRegistrations();
  
  const [selectedLeague, setSelectedLeague] = useState<{
    id: string;
    league: string;
    description: string;
    price: string;
  } | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  const leagues = [
    {
      id: 'mens-singles-summer-2025',
      league: "Men's Singles",
      description: "Men's singles league for competitive adult players. Evening and weekend matches available. Registration Deadline: July 3rd",
      startDate: '07/13/2025',
      price: '$35.00',
      status: 'Open'
    },
    {
      id: 'mens-doubles-fall-2025',
      league: "Men's Doubles",
      description: "Men's doubles league for players who enjoy team competition. Flexible scheduling for working professionals. Registration Deadline: August 28th",
      startDate: '09/07/2025',
      price: '$40.00',
      status: 'Open'
    },
    {
      id: 'ladies-singles-summer-2025',
      league: "Ladies' Singles",
      description: "Women's singles league with competitive matches. Perfect for improving individual skills. Registration Deadline: July 3rd",
      startDate: '07/13/2025',
      price: '$35.00',
      status: 'Open'
    },
    {
      id: 'ladies-doubles-fall-2025',
      league: "Ladies' Doubles",
      description: "Women's doubles league focusing on strategy and teamwork. Social and competitive atmosphere. Registration Deadline: August 28th",
      startDate: '09/07/2025',
      price: '$40.00',
      status: 'Open'
    },
    {
      id: 'mixed-doubles-fall-2025',
      league: 'Mixed Doubles',
      description: 'Mixed doubles league for men and women. Great way to meet new players and enjoy competitive tennis. Registration Deadline: August 28th',
      startDate: '09/07/2025',
      price: '$45.00',
      status: 'Open'
    }
  ];

  const handleOpenRegistration = (league: typeof leagues[0]) => {
    setSelectedLeague({
      id: league.id,
      league: league.league,
      description: league.description,
      price: league.price
    });
    setShowRegistrationModal(true);
  };

  const handleRegistration = async (leagueId: string, leagueName: string) => {
    try {
      console.log('Registering for league:', leagueId, leagueName);
      await registerForLeague(leagueId, leagueName);
    } catch (error) {
      console.error('Registration failed:', error);
      if (error.message?.includes('duplicate key')) {
        throw new Error('You are already registered for this league');
      } else {
        throw new Error('Failed to register for league. Please try again.');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Open</Badge>;
      case 'waitlist':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Waitlist</Badge>;
      case 'closed':
        return <Badge variant="destructive">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const registeredLeagueIds = getRegisteredLeagueIds();
  const hasRegistrations = registeredLeagueIds.length > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">League Menu</h1>
          <p className="text-gray-600">Loading your registrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">League Menu</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Register for multiple tennis leagues in your area</p>
      </div>

      {hasRegistrations && (
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              Your Active Registrations
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              You are currently registered for {registrations.length} league{registrations.length > 1 ? 's' : ''}:
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-3">
              {registrations.map((registration) => (
                <div key={registration.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200 gap-2 sm:gap-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-green-800 text-sm sm:text-base truncate">{registration.league_name}</p>
                    <p className="text-xs sm:text-sm text-green-600">
                      Registered on {new Date(registration.registration_date || '').toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs sm:text-sm self-start sm:self-center">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Available Leagues
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            You can register for multiple leagues. Click on any league you wish to participate in. 
            Note: If you don't see a league you're looking for, please check your profile settings 
            and ensure your gender and age information is correct.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="mb-4 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs sm:text-sm text-amber-800">
              <strong>Important:</strong> If you register for a league with a status of "Waitlist", 
              Top Tennis League will make all efforts to place you in a division. If we are unable to, 
              we will refund your registration fees in full.
            </p>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {leagues.map((league) => {
              const isRegistered = isRegisteredForLeague(league.id);
              const isDisabled = league.status.toLowerCase() === 'closed';
              
              return (
                <Card key={league.id} className="border border-border">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-primary text-sm truncate">{league.league}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <DollarSign className="w-3 h-3 text-green-600" />
                          <span className="text-xs font-semibold text-green-600">Sign-Up Fee: {league.price}</span>
                        </div>
                      </div>
                        {getStatusBadge(league.status)}
                      </div>
                      
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {league.description}
                      </p>
                      
                      <div className="grid grid-cols-1 gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Start: {league.startDate}</span>
                        </div>
                      </div>
                      
                      <div className="pt-2">
                        {isRegistered ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 w-full justify-center py-2">
                            Registered
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => handleOpenRegistration(league)}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 touch-target"
                            disabled={isDisabled}
                            size="sm"
                          >
                            Register Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>League</TableHead>
                  <TableHead>League Description</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Start Date
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Sign-Up Fee
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leagues.map((league) => {
                  const isRegistered = isRegisteredForLeague(league.id);
                  const isDisabled = league.status.toLowerCase() === 'closed';
                  
                  return (
                    <TableRow key={league.id} className="hover:bg-muted/50">
                      <TableCell>
                        {isRegistered ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            Registered
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => handleOpenRegistration(league)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm"
                            disabled={isDisabled}
                          >
                            Register Now
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-primary">{league.league}</TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {league.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {league.startDate}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-green-600">
                        {league.price}
                      </TableCell>
                      <TableCell>{getStatusBadge(league.status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasRegistrations && (
            <div className="mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-800">
                <strong>Multi-League Participation:</strong> You can participate in multiple leagues simultaneously. 
                Each league operates independently, so you can enjoy different formats and competition levels.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLeague && (
        <LeagueRegistrationModal
          open={showRegistrationModal}
          onOpenChange={setShowRegistrationModal}
          league={selectedLeague}
          onRegister={handleRegistration}
        />
      )}
    </div>
  );
};

export default RegisterTab;
