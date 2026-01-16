import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Trophy, Calendar, MapPin, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LeagueRegistrationModal from "@/components/dashboard/LeagueRegistrationModal";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Leagues = () => {
  const [selectedLeague, setSelectedLeague] = useState<any>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [pendingLeague, setPendingLeague] = useState<any>(null);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const { registerForLeague } = useLeagueRegistrations();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const leagues = [
    {
      id: "mens-singles",
      title: "Men's Singles League",
      category: "Singles",
      players: 24,
      level: "Intermediate",
      season: "Spring 2024",
      location: "Downtown Tennis Center",
      description: "Competitive singles league for intermediate level male players.",
      prize: "$500 Championship Prize",
      status: "Registration Open"
    },
    {
      id: "womens-singles",
      title: "Women's Singles League",
      category: "Singles", 
      players: 18,
      level: "Advanced",
      season: "Spring 2024",
      location: "Riverside Courts",
      description: "High-level singles competition for advanced female players.",
      prize: "$500 Championship Prize",
      status: "Registration Open"
    },
    {
      id: "mens-doubles",
      title: "Men's Doubles League",
      category: "Doubles",
      players: 16,
      level: "Beginner-Intermediate",
      season: "Spring 2024", 
      location: "City Park Tennis Complex",
      description: "Team-based doubles league for men of all skill levels.",
      prize: "$400 Championship Prize",
      status: "Registration Closing Soon"
    },
    {
      id: "womens-doubles",
      title: "Women's Doubles League",
      category: "Doubles",
      players: 12,
      level: "Intermediate-Advanced",
      season: "Spring 2024",
      location: "Tennis Academy",
      description: "Competitive doubles league for experienced female players.",
      prize: "$400 Championship Prize", 
      status: "Registration Open"
    },
    {
      id: "mixed-doubles",
      title: "Mixed Doubles League",
      category: "Doubles",
      players: 20,
      level: "All Levels",
      season: "Spring 2024",
      location: "Community Sports Center",
      description: "Fun mixed doubles league welcoming all skill levels.",
      prize: "$300 Championship Prize",
      status: "Registration Open"
    }
  ];

  const singlesLeagues = leagues.filter(league => league.category === "Singles");
  const doublesLeagues = leagues.filter(league => league.category === "Doubles");

  // Handle URL hash to filter leagues
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && leagues.find(league => league.id === hash)) {
      setActiveLeagueId(hash);
    } else {
      setActiveLeagueId(null);
    }
  }, [location.hash]);

  const getDisplayLeagues = () => {
    const hash = location.hash.replace('#', '');
    
    // Show specific league
    if (activeLeagueId) {
      return leagues.filter(league => league.id === activeLeagueId);
    }
    
    // Show category (singles or doubles)
    if (hash === 'singles') {
      return singlesLeagues;
    }
    if (hash === 'doubles') {
      return doublesLeagues;
    }
    
    // Show all leagues
    return leagues;
  };

  const displayLeagues = getDisplayLeagues();
  const showAllLeagues = !activeLeagueId && !location.hash.replace('#', '').match(/^(singles|doubles)$/);
  const showCategoryView = !activeLeagueId && location.hash.replace('#', '').match(/^(singles|doubles)$/);
  const currentCategory = location.hash.replace('#', '');

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Registration Open":
        return "bg-green-100 text-green-800";
      case "Registration Closing Soon":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleRegisterClick = (league: any) => {
    if (!user) {
      // Show membership confirmation dialog for non-authenticated users
      setPendingLeague(league);
      setShowMembershipDialog(true);
      return;
    }
    
    // User is logged in, proceed to registration with correct league data
    setSelectedLeague({
      id: league.id,
      name: league.title,
      description: league.description,
      category: league.category,
      level: league.level,
      season: league.season
    });
    setShowRegistrationModal(true);
  };

  const handleCurrentMember = () => {
    setShowMembershipDialog(false);
    toast.info("Please log in with your existing account");
    navigate("/login");
  };

  const handleNotMember = () => {
    setShowMembershipDialog(false);
    toast.info("Please sign up to register for leagues");
    navigate("/register");
  };

  const handleRegistration = async (leagueId: string, leagueName: string) => {
    try {
      await registerForLeague(leagueId, leagueName);
      setShowRegistrationModal(false);
      toast.success(`Successfully registered for ${leagueName}!`);
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white overflow-x-hidden">
      <Header />
      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-24">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          {(activeLeagueId || showCategoryView) && (
            <Button 
              variant="ghost" 
              onClick={() => navigate('/leagues')}
              className="mb-3 sm:mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to All Leagues
            </Button>
          )}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
            {activeLeagueId 
              ? displayLeagues[0]?.title || 'Tennis League'
              : showCategoryView
              ? currentCategory === 'singles' ? 'Singles Leagues' : 'Doubles Leagues'
              : 'Tennis Leagues'
            }
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            {activeLeagueId
              ? displayLeagues[0]?.description || 'Competitive tennis league'
              : showCategoryView
              ? currentCategory === 'singles' 
                ? 'Individual competition for men and women'
                : 'Team-based competition for men, women, and mixed'
              : 'Join competitive tennis leagues for all skill levels. From singles to doubles, youth to adult - find your perfect match.'
            }
          </p>
        </div>

        {/* Category View - Singles or Doubles */}
        {showCategoryView && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayLeagues.map((league) => (
              <Card key={league.id} id={league.id} className="hover:shadow-lg transition-shadow duration-300 scroll-mt-24">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {league.category}
                    </Badge>
                    <Badge className={getStatusColor(league.status)}>
                      {league.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{league.title}</CardTitle>
                  <CardDescription className="text-gray-600">
                    {league.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-orange-600" />
                      <span>{league.players} Players</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Trophy className="h-4 w-4 text-orange-600" />
                      <span>{league.level}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      <span>{league.season}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-orange-600" />
                      <span className="truncate">{league.location}</span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold text-orange-600 mb-3">
                      {league.prize}
                    </div>
                    <Button 
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleRegisterClick(league)}
                    >
                      Register Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Single League View */}
        {!showAllLeagues && displayLeagues.length === 1 && (
          <div className="max-w-2xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {displayLeagues[0].category}
                  </Badge>
                  <Badge className={getStatusColor(displayLeagues[0].status)}>
                    {displayLeagues[0].status}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{displayLeagues[0].title}</CardTitle>
                <CardDescription className="text-gray-600 text-base">
                  {displayLeagues[0].description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="font-medium">{displayLeagues[0].players} Players</div>
                      <div className="text-xs text-gray-500">Registered</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="font-medium">{displayLeagues[0].level}</div>
                      <div className="text-xs text-gray-500">Skill Level</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="font-medium">{displayLeagues[0].season}</div>
                      <div className="text-xs text-gray-500">Season</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="font-medium">{displayLeagues[0].location}</div>
                      <div className="text-xs text-gray-500">Location</div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-6">
                  <div className="text-lg font-semibold text-orange-600 mb-4">
                    {displayLeagues[0].prize}
                  </div>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700 py-6 text-lg"
                    onClick={() => handleRegisterClick(displayLeagues[0])}
                  >
                    Register Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Singles Section */}
        {showAllLeagues && (
          <div id="singles" className="scroll-mt-24 mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Singles Leagues</h2>
            <p className="text-gray-600 mb-6">Individual competition for men and women</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {singlesLeagues.map((league) => (
              <Card key={league.id} id={league.id} className="hover:shadow-lg transition-shadow duration-300 scroll-mt-24">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {league.category}
                    </Badge>
                    <Badge className={getStatusColor(league.status)}>
                      {league.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{league.title}</CardTitle>
                  <CardDescription className="text-gray-600">
                    {league.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-orange-600" />
                      <span>{league.players} Players</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Trophy className="h-4 w-4 text-orange-600" />
                      <span>{league.level}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      <span>{league.season}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-orange-600" />
                      <span className="truncate">{league.location}</span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold text-orange-600 mb-3">
                      {league.prize}
                    </div>
                    <Button 
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleRegisterClick(league)}
                    >
                      Register Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          </div>
        )}

        {/* Doubles Section */}
        {showAllLeagues && (
          <div id="doubles" className="scroll-mt-24 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Doubles Leagues</h2>
          <p className="text-gray-600 mb-6">Team-based competition for men, women, and mixed</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doublesLeagues.map((league) => (
              <Card key={league.id} id={league.id} className="hover:shadow-lg transition-shadow duration-300 scroll-mt-24">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {league.category}
                    </Badge>
                    <Badge className={getStatusColor(league.status)}>
                      {league.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{league.title}</CardTitle>
                  <CardDescription className="text-gray-600">
                    {league.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-orange-600" />
                      <span>{league.players} Players</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Trophy className="h-4 w-4 text-orange-600" />
                      <span>{league.level}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      <span>{league.season}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-orange-600" />
                      <span className="truncate">{league.location}</span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold text-orange-600 mb-3">
                      {league.prize}
                    </div>
                    <Button 
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleRegisterClick(league)}
                    >
                      Register Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          </div>
        )}

        {/* Additional Info Section */}
        {showAllLeagues && (
          <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-orange-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold">Register</h3>
              <p className="text-gray-600 text-sm">Choose your league and complete registration</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-orange-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold">Play</h3>
              <p className="text-gray-600 text-sm">Compete in scheduled matches throughout the season</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-orange-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold">Win</h3>
              <p className="text-gray-600 text-sm">Compete for prizes and championship titles</p>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Membership Status Dialog */}
      <AlertDialog open={showMembershipDialog} onOpenChange={setShowMembershipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Membership Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you a current member of our tennis club?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction
              onClick={handleCurrentMember}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Yes, I'm a Current Member
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleNotMember}
              className="bg-gray-600 hover:bg-gray-700"
            >
              No, I'm Not a Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* League Registration Modal */}
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

export default Leagues;