import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Users, Trophy, Calendar, MapPin, ArrowRight, Clock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LeagueRegistrationModal from "@/components/dashboard/LeagueRegistrationModal";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LEAGUE_ACTIVITIES_AVAILABLE = false;

type Category = "All" | "Singles" | "Doubles";

const leagues = [
  {
    id: "mens-singles",
    title: "Men's Singles",
    category: "Singles" as const,
    players: 24,
    spots: 8,
    level: "Intermediate",
    season: "Spring 2025",
    location: "Downtown Tennis Center",
    description: "Competitive singles ladder for intermediate male players. Matches scheduled flexibly around your availability.",
    prize: "$500 Championship Prize",
    status: "Open" as const,
  },
  {
    id: "womens-singles",
    title: "Women's Singles",
    category: "Singles" as const,
    players: 18,
    spots: 6,
    level: "Advanced",
    season: "Spring 2025",
    location: "Riverside Courts",
    description: "High-level singles competition for advanced female players. Strong field, structured bracket.",
    prize: "$500 Championship Prize",
    status: "Open" as const,
  },
  {
    id: "mens-doubles",
    title: "Men's Doubles",
    category: "Doubles" as const,
    players: 16,
    spots: 2,
    level: "Beginner – Intermediate",
    season: "Spring 2025",
    location: "City Park Tennis Complex",
    description: "Team-based doubles for men of all levels. Find a partner or we'll match you with one.",
    prize: "$400 Championship Prize",
    status: "Closing Soon" as const,
  },
  {
    id: "womens-doubles",
    title: "Women's Doubles",
    category: "Doubles" as const,
    players: 12,
    spots: 12,
    level: "Intermediate – Advanced",
    season: "Spring 2025",
    location: "Tennis Academy",
    description: "Competitive doubles for experienced female players. Partner registration required.",
    prize: "$400 Championship Prize",
    status: "Open" as const,
  },
  {
    id: "mixed-doubles",
    title: "Mixed Doubles",
    category: "Doubles" as const,
    players: 20,
    spots: 10,
    level: "All Levels",
    season: "Spring 2025",
    location: "Community Sports Center",
    description: "Fun co-ed doubles open to all skill levels. The most social league we run.",
    prize: "$300 Championship Prize",
    status: "Open" as const,
  },
];

const statusConfig = {
  Open: { label: "Registration Open", className: "bg-green-100 text-green-700 border-green-200" },
  "Closing Soon": { label: "Closing Soon", className: "bg-amber-100 text-amber-700 border-amber-200" },
  Closed: { label: "Closed", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const tabs: Category[] = ["All", "Singles", "Doubles"];

const Leagues = () => {
  const [activeTab, setActiveTab] = useState<Category>("All");
  const [selectedLeague, setSelectedLeague] = useState<any>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [pendingLeague, setPendingLeague] = useState<any>(null);

  const { registerForLeague } = useLeagueRegistrations();
  const { user } = useAuth();
  const navigate = useNavigate();

  const filtered = activeTab === "All" ? leagues : leagues.filter(l => l.category === activeTab);

  const handleRegisterClick = (league: typeof leagues[0]) => {
    if (!user) {
      setPendingLeague(league);
      setShowMembershipDialog(true);
      return;
    }
    setSelectedLeague({ id: league.id, name: league.title, description: league.description, category: league.category, level: league.level, season: league.season });
    setShowRegistrationModal(true);
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

  if (!LEAGUE_ACTIVITIES_AVAILABLE) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        {/* Page hero */}
        <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: "#0B1526" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
            <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
              Leagues
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">Tennis Leagues</h1>
            <p className="text-base text-white/50 max-w-xl mx-auto">
              Competitive leagues for every format and skill level. Singles, Doubles, Mixed — all in one place.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-24 flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-2" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
            <Trophy className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">League Season Coming Soon</h2>
          <p className="text-gray-500 leading-relaxed">
            We're preparing the next season of leagues. Sign up for our newsletter to be the first to know when registration opens.
          </p>
          <Button onClick={() => navigate("/#newsletter")} className="mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-8">
            Get Notified
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Page hero ── */}
      <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: "#0B1526" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div>
              <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
                Spring 2025 Season
              </span>
              <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-3">
                Tennis Leagues
              </h1>
              <p className="text-base text-white/50 max-w-lg leading-relaxed">
                Competitive leagues for every format and skill level. Pick your division, register, and start climbing the ladder.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-6 shrink-0">
              {[
                { value: `${leagues.length}`, label: "Divisions" },
                { value: `${leagues.reduce((s, l) => s + l.players, 0)}+`, label: "Players" },
                { value: `${leagues.filter(l => l.status === "Open").length}`, label: "Open Now" },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-2xl font-black text-orange-400">{value}</div>
                  <div className="text-xs text-white/35 font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-10">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
                style={
                  activeTab === tab
                    ? { backgroundColor: "#f97316", color: "#fff" }
                    : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }
                }
              >
                {tab}
                {tab !== "All" && (
                  <span className="ml-2 text-xs opacity-60">
                    {leagues.filter(l => l.category === tab).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── League cards ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Section label */}
        {activeTab === "All" && (
          <>
            {/* Singles group */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-black text-gray-900">Singles</h2>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-sm text-gray-400">{leagues.filter(l => l.category === "Singles").length} divisions</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {leagues.filter(l => l.category === "Singles").map(league => (
                  <LeagueCard key={league.id} league={league} onRegister={handleRegisterClick} />
                ))}
              </div>
            </div>

            {/* Doubles group */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-black text-gray-900">Doubles</h2>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-sm text-gray-400">{leagues.filter(l => l.category === "Doubles").length} divisions</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {leagues.filter(l => l.category === "Doubles").map(league => (
                  <LeagueCard key={league.id} league={league} onRegister={handleRegisterClick} />
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab !== "All" && (
          <div className={`grid grid-cols-1 gap-5 ${activeTab === "Singles" ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
            {filtered.map(league => (
              <LeagueCard key={league.id} league={league} onRegister={handleRegisterClick} />
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* Dialogs */}
      <AlertDialog open={showMembershipDialog} onOpenChange={setShowMembershipDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you an existing member?</AlertDialogTitle>
            <AlertDialogDescription>
              Let us know so we can send you to the right place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction onClick={() => { setShowMembershipDialog(false); toast.info("Please log in"); navigate("/login"); }} className="bg-orange-500 hover:bg-orange-600 rounded-xl">
              Yes, I'm a Member — Log In
            </AlertDialogAction>
            <AlertDialogAction onClick={() => { setShowMembershipDialog(false); toast.info("Create an account to get started"); navigate("/register"); }} className="bg-gray-900 hover:bg-gray-800 rounded-xl">
              No, Sign Me Up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

// ── League card component ────────────────────────────────────────────────────

function LeagueCard({ league, onRegister }: { league: typeof leagues[0]; onRegister: (l: typeof leagues[0]) => void }) {
  const cfg = statusConfig[league.status];
  const spotsLeft = league.spots;
  const isFull = spotsLeft === 0;

  return (
    <div
      id={league.id}
      className="group flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 scroll-mt-24"
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: league.category === "Singles" ? "#f97316" : "#3b82f6" }} />

      <div className="flex flex-col flex-1 p-6 gap-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 block">{league.category}</span>
            <h3 className="text-lg font-black text-gray-900 leading-snug">{league.title}</h3>
          </div>
          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.className}`}>
            {cfg.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed">{league.description}</p>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { Icon: Users, text: `${league.players} players` },
            { Icon: Trophy, text: league.level },
            { Icon: Calendar, text: league.season },
            { Icon: MapPin, text: league.location },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-600">
              <Icon className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              <span className="truncate">{text}</span>
            </div>
          ))}
        </div>

        {/* Spots left indicator */}
        {!isFull && league.status !== "Closed" && (
          <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
            <Clock className="h-3.5 w-3.5" />
            {spotsLeft <= 4 ? `Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : `${spotsLeft} spots available`}
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-2 flex items-center justify-between gap-4 border-t border-gray-50">
          <span className="text-sm font-bold text-orange-500">{league.prize}</span>
          <Button
            onClick={() => onRegister(league)}
            disabled={isFull || league.status === "Closed"}
            className="shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Register <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Leagues;
