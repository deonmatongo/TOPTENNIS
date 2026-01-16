
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import { 
  Home, 
  Calendar, 
  User, 
  FileText, 
  BarChart3, 
  Trophy,
  Settings,
  LogOut,
  Shield,
  Users,
  Bell,
  XCircle
} from "lucide-react";

interface DashboardSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobile?: boolean;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

const DashboardSidebar = ({ activeTab, setActiveTab, isMobile = false, sidebarOpen = false, setSidebarOpen }: DashboardSidebarProps) => {
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "matches", label: "Matches", icon: Calendar },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "matching", label: "Find Partners", icon: Users },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "notification-settings", label: "Notification Settings", icon: Settings },
    { id: "cancellation-history", label: "Cancellation History", icon: XCircle },
    { id: "profile", label: "Profile", icon: User },
    { id: "register", label: "League Menu", icon: FileText },
    { id: "my-leagues", label: "My Leagues", icon: Trophy },
    { id: "my-divisions", label: "My Divisions", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "competition", label: "Competition", icon: Trophy },
  ];

  return (
    <div className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-border shadow-tennis-xl z-50 transition-transform duration-300 ${
      isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
    }`}>
      {/* Logo/Brand Section */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">🎾</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Tennis Pro</h2>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        </div>
      </div>
      
      {/* Navigation Menu */}
      <nav className="px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start text-left h-11 text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
              onClick={() => {
                setActiveTab(item.id);
                if (isMobile && setSidebarOpen) {
                  setSidebarOpen(false);
                }
              }}
            >
              <Icon className="w-4 h-4 mr-3" />
              <span className="flex-1">{item.label}</span>
              {item.id === 'notifications' && unreadCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 min-w-[1.25rem] h-5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
      
      {/* Bottom Actions */}
      <div className="absolute bottom-6 left-4 right-4 space-y-2 border-t border-border pt-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent/50 h-10"
          onClick={() => navigate('/admin')}
        >
          <Shield className="w-4 h-4 mr-3" />
          Admin Panel
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive h-10"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default DashboardSidebar;
