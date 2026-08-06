import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  X,
  ChevronDown,
  MapPin,
  User,
  LogOut,
  BarChart3,
  Bell,
  Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNotificationsContext } from "@/contexts/NotificationsContext";
import { toast } from "sonner";

const NAVY = "#0B1526";

const NavLink = ({
  to,
  href,
  children,
  onClick,
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) => {
  const { pathname } = useLocation();
  const isActive = to ? pathname === to : false;
  const cls = `relative px-1 py-1.5 text-sm font-medium transition-colors duration-200
    after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:rounded-full after:transition-all after:duration-200
    ${isActive
      ? "text-orange-400 after:w-full after:bg-orange-400"
      : "text-white/80 hover:text-orange-400 after:w-0 after:bg-orange-400 hover:after:w-full"
    }`;
  if (href)
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  return (
    <Link to={to!} className={cls} onClick={onClick}>
      {children}
    </Link>
  );
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { unreadCount } = useNotificationsContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast.success("Signed out successfully");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  // Phone-only accounts have no email — never use it as a display name.
  // Mirrors public.display_name(): name -> username -> neutral placeholder.
  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : profile?.username || "Player";

  const initials =
    profile?.first_name?.charAt(0)?.toUpperCase() ||
    profile?.username?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: isDashboard
            ? NAVY
            : isScrolled
            ? `${NAVY}f5`
            : NAVY,
          borderBottom: isScrolled
            ? "1px solid rgba(255,255,255,0.07)"
            : "1px solid rgba(255,255,255,0.05)",
          boxShadow: isScrolled ? "0 4px 24px rgba(0,0,0,0.35)" : "none",
          backdropFilter: isScrolled ? "blur(16px)" : "none",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[4.25rem]">

            {/* ── Logo ── */}
            <Link
              to="/"
              className="flex items-center gap-2.5 shrink-0 group"
              aria-label="Top Tennis League Home"
            >
              <img
                src="/app-icon.png"
                alt="Top Tennis"
                className="h-12 w-12 rounded-xl object-cover shadow-sm group-hover:shadow-orange-300/40 group-hover:scale-105 transition-all duration-200"
              />
              <span className="hidden sm:block font-bold text-base tracking-tight leading-none">
                <span className="text-white">Top</span>
                <span className="text-orange-400"> Tennis</span>
                <span className="block text-[10px] font-medium text-white/40 tracking-widest uppercase mt-0.5">
                  League
                </span>
              </span>
            </Link>

            {/* ── Desktop Nav ── */}
            <nav className="hidden lg:flex items-center gap-6">
              <NavLink to="/">Home</NavLink>

              <NavLink to="/leagues">Leagues</NavLink>

              <NavLink href="#locations">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Courts
                </span>
              </NavLink>

              <NavLink to="/rules">Rules</NavLink>
              <NavLink to="/contact">Contact</NavLink>
            </nav>

            {/* ── Right actions ── */}
            <div className="hidden lg:flex items-center gap-2">

              {user ? (
                <div className="flex items-center gap-1">
                  {/* Notifications bell */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-9 w-9 p-0 rounded-xl text-white/70 hover:text-orange-400 hover:bg-white/10"
                    onClick={() => navigate("/dashboard?tab=notifications")}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Button>

                  {/* User menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-xl hover:bg-white/10"
                      >
                        <Avatar className="h-7 w-7 ring-2 ring-orange-400/40">
                          <AvatarImage src={profile?.profile_picture_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-white/90 max-w-[120px] truncate">
                          {displayName}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xl">
                      <DropdownMenuItem onClick={() => navigate("/dashboard?tab=profile")}>
                        <User className="mr-2 h-4 w-4" /> My Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/dashboard?tab=messages")}>
                        <Mail className="mr-2 h-4 w-4" /> Inbox
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                        <BarChart3 className="mr-2 h-4 w-4" /> Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="text-red-600 focus:text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/register">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-4 rounded-xl text-white/75 hover:text-orange-400 hover:bg-white/10"
                    >
                      Sign Up
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button
                      size="sm"
                      className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold shadow-sm shadow-orange-500/30 transition-all"
                    >
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* ── Mobile hamburger ── */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-9 w-9 p-0 rounded-xl text-white/70 hover:text-orange-400 hover:bg-white/10"
              onClick={() => setIsMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay ── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-all duration-300 ${
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={closeMenu}
        />

        {/* Drawer */}
        <div
          className={`absolute top-16 md:top-[4.25rem] left-0 right-0 bottom-0 overflow-y-auto transition-transform duration-300 ${
            isMenuOpen ? "translate-y-0" : "-translate-y-4"
          }`}
          style={{ backgroundColor: NAVY }}
        >
          <nav className="px-4 py-4 space-y-0.5">
            <Link
              to="/"
              className="flex items-center px-3 py-3 text-base font-medium text-white/80 hover:text-orange-400 hover:bg-white/5 rounded-xl transition-all"
              onClick={closeMenu}
            >
              Home
            </Link>

            <Link
              to="/leagues"
              className="flex items-center px-3 py-3 text-base font-medium text-white/80 hover:text-orange-400 hover:bg-white/5 rounded-xl transition-all"
              onClick={closeMenu}
            >
              Leagues
            </Link>

            <a
              href="#locations"
              className="flex items-center gap-2 px-3 py-3 text-base font-medium text-white/80 hover:text-orange-400 hover:bg-white/5 rounded-xl transition-all"
              onClick={closeMenu}
            >
              <MapPin className="h-4 w-4" /> Courts
            </a>

            <Link
              to="/rules"
              className="flex items-center px-3 py-3 text-base font-medium text-white/80 hover:text-orange-400 hover:bg-white/5 rounded-xl transition-all"
              onClick={closeMenu}
            >
              Rules
            </Link>

            <Link
              to="/contact"
              className="flex items-center px-3 py-3 text-base font-medium text-white/80 hover:text-orange-400 hover:bg-white/5 rounded-xl transition-all"
              onClick={closeMenu}
            >
              Contact
            </Link>
          </nav>

          {/* Bottom user section */}
          <div className="px-4 pb-8 pt-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar className="h-10 w-10 ring-2 ring-orange-400/30">
                    <AvatarImage src={profile?.profile_picture_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-white">{displayName}</p>
                    <p className="text-xs text-white/40">
                      {profile?.membership_id || "Member"}
                    </p>
                  </div>
                </div>

                <Link to="/dashboard" onClick={closeMenu}>
                  <Button variant="outline" className="w-full justify-start rounded-xl border-orange-500/30 text-orange-400 bg-transparent hover:bg-orange-500/10">
                    <BarChart3 className="h-4 w-4 mr-2" /> Dashboard
                  </Button>
                </Link>

                <Link to="/dashboard?tab=notifications" onClick={closeMenu}>
                  <Button variant="outline" className="w-full justify-start rounded-xl border-white/10 text-white/70 bg-transparent hover:bg-white/5 hover:text-white">
                    <Bell className="h-4 w-4 mr-2" /> Notifications
                    {unreadCount > 0 && (
                      <Badge className="ml-auto bg-red-500 text-white text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="w-full justify-start rounded-xl border-red-500/20 text-red-400 bg-transparent hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Link to="/register" className="block" onClick={closeMenu}>
                  <Button variant="outline" className="w-full rounded-xl border-white/10 text-white/75 bg-transparent hover:bg-white/5 hover:text-orange-400 hover:border-orange-500/30">
                    Sign Up
                  </Button>
                </Link>
                <Link to="/login" className="block" onClick={closeMenu}>
                  <Button className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
