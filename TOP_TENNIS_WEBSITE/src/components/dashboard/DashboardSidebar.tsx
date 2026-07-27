
import React from "react";
import { Badge } from "@/components/ui/badge";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationsContext } from "@/contexts/NotificationsContext";
import { useMatchResponses } from "@/hooks/useMatchResponses";
import { toast } from "sonner";
import {
  Home,
  CalendarDays,
  User,
  FileText,
  Trophy,
  Settings,
  LogOut,
  Shield,
  Users,
  Bell,
  XCircle,
  X,
  Award,
  CalendarCheck,
} from "lucide-react";

const NAVY = "#0B1526";

interface DashboardSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobile?: boolean;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

const NAV_GROUPS = [
  {
    label: null,
    items: [{ id: "overview", label: "Overview", icon: Home, badge: null as string | null }],
  },
  {
    label: "Play",
    items: [
      { id: "matches", label: "Matches", icon: Trophy, badge: null as string | null },
      { id: "calendar", label: "Schedule", icon: CalendarDays, badge: "calendar" as string | null },
      { id: "matching", label: "Find Partners", icon: Users, badge: null as string | null },
      { id: "competition", label: "Competition", icon: Award, badge: null as string | null },
    ],
  },
  {
    label: "Leagues",
    items: [
      { id: "register", label: "League Menu", icon: FileText, badge: null as string | null },
      { id: "my-leagues", label: "My Leagues", icon: CalendarCheck, badge: null as string | null },
      { id: "my-divisions", label: "My Divisions", icon: Users, badge: null as string | null },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "profile", label: "Profile", icon: User, badge: null as string | null },
      { id: "notifications", label: "Notifications", icon: Bell, badge: "notifications" as string | null },
      { id: "notification-settings", label: "Notif. Settings", icon: Settings, badge: null as string | null },
      { id: "cancellation-history", label: "Cancellations", icon: XCircle, badge: null as string | null },
    ],
  },
];

const DashboardSidebar = ({
  activeTab,
  setActiveTab,
  isMobile = false,
  sidebarOpen = false,
  setSidebarOpen,
}: DashboardSidebarProps) => {
  const { unreadCount } = useNotificationsContext();
  const { pendingInvites } = useMatchResponses();
  const pendingInviteCount = pendingInvites.length;
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast.success("Signed out successfully");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const getBadgeCount = (badgeKey: string | null) => {
    if (badgeKey === "notifications") return unreadCount;
    if (badgeKey === "calendar") return pendingInviteCount;
    return 0;
  };

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    if (isMobile && setSidebarOpen) setSidebarOpen(false);
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      style={{ backgroundColor: NAVY }}
    >
      {/* Logo */}
      <div
        className="px-5 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/app-icon.png" alt="Top Tennis" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-bold text-sm leading-none">
            <span className="text-white">Top</span>
            <span className="text-orange-400"> Tennis</span>
            <span
              className="block text-[9px] font-medium tracking-widest uppercase mt-0.5"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              League
            </span>
          </span>
        </Link>
        <button
          className="lg:hidden flex items-center justify-center h-7 w-7 rounded-lg transition-colors"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p
                className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const badgeCount = getBadgeCount(item.badge);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-all text-left"
                    style={{
                      backgroundColor: isActive ? "rgba(249,115,22,0.18)" : "transparent",
                      color: isActive ? "#f97316" : "rgba(255,255,255,0.55)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.06)";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
                      }
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badgeCount > 0 && (
                      <Badge
                        className="text-white text-[10px] px-1.5 py-0 min-w-[1.2rem] h-4 flex items-center justify-center border-0"
                        style={{
                          backgroundColor:
                            item.badge === "notifications" ? "#ef4444" : "#f97316",
                        }}
                      >
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div
        className="px-3 py-4 space-y-0.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={() => navigate("/admin")}
          className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-all"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
          }}
        >
          <Shield className="w-4 h-4 shrink-0" />
          <span>Admin Panel</span>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-all"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239,68,68,0.12)";
            (e.currentTarget as HTMLElement).style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardSidebar;
