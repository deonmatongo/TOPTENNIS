import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Menu, X, ChevronDown, MapPin, User, Settings, LogOut, BarChart3, Bell, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNotifications } from "@/hooks/useNotifications";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RealtimeStatus } from "@/components/ui/RealtimeStatus";
import { toast } from "sonner";
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLeaguesOpen, setIsLeaguesOpen] = useState(false);
  const [isSinglesOpen, setIsSinglesOpen] = useState(false);
  const [isDoublesOpen, setIsDoublesOpen] = useState(false);
  const {
    user,
    signOut
  } = useAuth();
  const {
    profile
  } = useUserProfile();
  const {
    unreadCount
  } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };
  return <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isDashboard ? 'bg-card border-b-2 border-border' : isScrolled ? 'bg-white/95 backdrop-blur-lg border-b border-gray-200/60 shadow-xl' : 'bg-white/90 backdrop-blur-md border-b border-gray-100/40'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group" aria-label="Top Tennis League Home">
            <img src="/logo.png" alt="Top Tennis League Logo" className="h-32 w-48 md:h-36 md:w-56 lg:h-40 lg:w-64 object-contain" />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link to="/" className="nav-link group relative px-3 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors">
              Home
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </Link>
            
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="nav-link group relative px-3 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 bg-transparent hover:bg-transparent focus:bg-transparent data-[active]:bg-transparent data-[state=open]:bg-transparent border-0 shadow-none h-auto">
                    <span className="flex items-center">
                      <span>Register for a League</span>
                    </span>
                    <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-orange-600 transform scale-x-0 group-hover:scale-x-100 group-data-[state=open]:scale-x-100 transition-transform origin-left"></span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="bg-white/95 backdrop-blur-lg border border-gray-200/60 shadow-xl rounded-xl mt-3 min-w-[400px]">
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Link to="/leagues#singles" className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b border-gray-200 pb-2 block hover:text-orange-600 transition-colors">
                            Singles
                          </Link>
                          <div className="space-y-2">
                            <Link to="/leagues#mens-singles" className="block px-3 py-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all">
                              Men's Singles
                            </Link>
                            <Link to="/leagues#womens-singles" className="block px-3 py-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all">
                              Women's Singles
                            </Link>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <Link to="/leagues#doubles" className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b border-gray-200 pb-2 block hover:text-orange-600 transition-colors">
                            Doubles
                          </Link>
                          <div className="space-y-2">
                            <Link to="/leagues#mens-doubles" className="block px-3 py-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all">
                              Men's Doubles
                            </Link>
                            <Link to="/leagues#womens-doubles" className="block px-3 py-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all">
                              Women's Doubles
                            </Link>
                            <Link to="/leagues#mixed-doubles" className="block px-3 py-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all">
                              Mixed Doubles
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <a href="#locations" className="nav-link group relative px-3 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors flex items-center space-x-1">
              <MapPin className="h-4 w-4" />
              <span>Courts</span>
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </a>
            
            <Link to="/rules" className="nav-link group relative px-3 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors">
              Rules
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </Link>
            
            <Link to="/contact" className="nav-link group relative px-3 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors">
              Contact Us
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="hidden lg:flex items-center space-x-3">
            {user && <RealtimeStatus />}
            <ThemeToggle />
            {user ?
          // Authenticated User Menu
          <div className="flex items-center space-x-4">
                {/* Notifications */}
                <Button variant="ghost" size="sm" className="relative p-2 text-gray-700 hover:text-orange-600 hover:bg-orange-50" onClick={() => navigate('/dashboard?tab=notifications')}>
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>}
                </Button>

                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2 p-2 hover:bg-orange-50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.profile_picture_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm">
                          {profile?.first_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {profile?.membership_id || 'Member'}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-56">
                     <DropdownMenuItem onClick={() => navigate('/dashboard?tab=profile')}>
                       <User className="mr-2 h-4 w-4" />
                       My Profile
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => navigate('/dashboard?tab=messages')}>
                       <Mail className="mr-2 h-4 w-4" />
                       Inbox
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                       <LogOut className="mr-2 h-4 w-4" />
                       Sign Out
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                </DropdownMenu>
              </div> :
          // Guest User Buttons
          <>
                <Link to="/register">
                  <Button variant="ghost" size="sm" className="text-gray-700 hover:text-orange-600 hover:bg-orange-50">
                    Sign Up
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                    <User className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
              </>}
          </div>

          {/* Mobile Menu Button */}
          <Button variant="ghost" size="sm" className="lg:hidden p-2 text-gray-700 hover:text-orange-600 hover:bg-orange-50" onClick={toggleMenu} aria-label="Toggle navigation menu">
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ${isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
          <nav className="py-4 border-t border-gray-200">
            <div className="space-y-1">
              <Link to="/" className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all" onClick={() => setIsMenuOpen(false)}>
                Home
              </Link>
              
              {/* Mobile Leagues Section */}
              <div className="space-y-1">
                <button
                  onClick={() => setIsLeaguesOpen(!isLeaguesOpen)}
                  className="w-full flex items-center justify-between px-3 py-3 text-base font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all"
                >
                  <span>Leagues</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isLeaguesOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <div className={`overflow-hidden transition-all duration-300 ${isLeaguesOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="pl-6 space-y-1 py-2">
                    {/* Singles Dropdown */}
                    <div className="space-y-1">
                      <button
                        onClick={() => setIsSinglesOpen(!isSinglesOpen)}
                        className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors"
                      >
                        <span>Singles</span>
                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isSinglesOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ${isSinglesOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="pl-4 space-y-1">
                          <Link to="/leagues#mens-singles" className="block py-2 text-sm text-gray-500 hover:text-orange-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Men's Singles</Link>
                          <Link to="/leagues#womens-singles" className="block py-2 text-sm text-gray-500 hover:text-orange-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Women's Singles</Link>
                        </div>
                      </div>
                    </div>
                    
                    {/* Doubles Dropdown */}
                    <div className="space-y-1 pt-2">
                      <button
                        onClick={() => setIsDoublesOpen(!isDoublesOpen)}
                        className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors"
                      >
                        <span>Doubles</span>
                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isDoublesOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ${isDoublesOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="pl-4 space-y-1">
                          <Link to="/leagues#mens-doubles" className="block py-2 text-sm text-gray-500 hover:text-orange-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Men's Doubles</Link>
                          <Link to="/leagues#womens-doubles" className="block py-2 text-sm text-gray-500 hover:text-orange-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Women's Doubles</Link>
                          <Link to="/leagues#mixed-doubles" className="block py-2 text-sm text-gray-500 hover:text-orange-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Mixed Doubles</Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <a href="#locations" className="flex items-center space-x-2 px-3 py-3 text-base font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all" onClick={() => setIsMenuOpen(false)}>
                <MapPin className="h-4 w-4" />
                <span>Courts</span>
              </a>
              
              <Link to="/rules" className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all" onClick={() => setIsMenuOpen(false)}>
                Rules
              </Link>
              
              <Link to="/contact" className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50/80 rounded-lg transition-all" onClick={() => setIsMenuOpen(false)}>
                Contact Us
              </Link>
              
              {/* Mobile Action Buttons */}
              <div className="pt-4 space-y-3 border-t border-gray-200 mt-4">
                {user && (
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Connection</span>
                    <RealtimeStatus />
                  </div>
                )}
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</span>
                  <ThemeToggle />
                </div>
                {user ?
              // Authenticated Mobile Menu
              <>
                    <div className="flex items-center space-x-3 px-3 py-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile?.profile_picture_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold">
                          {profile?.first_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {profile?.membership_id || 'Member'}
                        </div>
                      </div>
                    </div>
                    
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start bg-transparent border-orange-300 text-orange-700 hover:bg-orange-50">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>

                    <Link to="/dashboard?tab=notifications" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start bg-transparent border-gray-300 text-gray-700 hover:bg-orange-50">
                        <Bell className="h-4 w-4 mr-2" />
                        Notifications
                        {unreadCount > 0 && <Badge className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5">
                            {unreadCount}
                          </Badge>}
                      </Button>
                    </Link>

                    <Button onClick={handleSignOut} variant="outline" className="w-full justify-start bg-transparent border-red-300 text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </> :
              // Guest Mobile Menu
              <>
                    <Link to="/register" className="block" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-center bg-transparent border-gray-300 text-gray-700 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300">
                        Sign Up
                      </Button>
                    </Link>
                    <Link to="/login" className="block" onClick={() => setIsMenuOpen(false)}>
                      <Button className="w-full justify-center bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                        <User className="h-4 w-4 mr-2" />
                        Sign In
                      </Button>
                    </Link>
                  </>}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>;
};
export default Header;