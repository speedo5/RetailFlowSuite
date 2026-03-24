import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import logo from '@/assets/logo.png';
import {
  LayoutDashboard,
  Package,
  Smartphone,
  ShoppingCart,
  Users,
  DollarSign,
  FileBarChart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  History,
  Scale,
  Globe,
  Send,
  ClipboardList,
  UserCog,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  roles?: string[];
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Inventory', icon: Smartphone, href: '/inventory' },
  { label: 'Stock Allocation', icon: Send, href: '/stock-allocation' },
  { label: 'Allocation Audit', icon: ClipboardList, href: '/allocation-audit', roles: ['admin'] },
  { label: 'Sales (POS)', icon: ShoppingCart, href: '/pos' },
  { label: 'Regions', icon: Globe, href: '/regions', roles: ['admin'] },
  { label: 'User Management', icon: Users, href: '/users', roles: ['admin'] },
  { label: 'Commissions', icon: DollarSign, href: '/commissions' },
  { label: 'Receipts', icon: FileBarChart, href: '/receipts' },
  { label: 'Reconciliation', icon: Scale, href: '/reconciliation' },
  { label: 'Activity Log', icon: History, href: '/activity-log', roles: ['admin'] },
  { label: 'Reports', icon: FileBarChart, href: '/reports' },
];

const regionalNavItems: NavItem[] = [
  { label: 'My Region', icon: Globe, href: '/regional' },
  { label: 'Manage FOs', icon: UserCog, href: '/manage-fos' },
  { label: 'Sales (POS)', icon: ShoppingCart, href: '/pos' },
  { label: 'Stock Allocation', icon: Send, href: '/stock-allocation' },
  { label: 'Inventory', icon: Smartphone, href: '/inventory' },
  { label: 'Commissions', icon: DollarSign, href: '/commissions' },
  { label: 'Receipts', icon: FileBarChart, href: '/receipts' },
  { label: 'Reconciliation', icon: Scale, href: '/reconciliation' },
  { label: 'Reports', icon: FileBarChart, href: '/reports' },
];

const teamLeaderNavItems: NavItem[] = [
  { label: 'My Team', icon: Users, href: '/team-leader' },
  { label: 'Sales (POS)', icon: ShoppingCart, href: '/pos' },
  { label: 'Stock Allocation', icon: Send, href: '/stock-allocation' },
  { label: 'Commissions', icon: DollarSign, href: '/team-leader/commissions' },
  { label: 'Receipts', icon: FileBarChart, href: '/receipts' },
  { label: 'Reports', icon: FileBarChart, href: '/reports' },
];

const foNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/fo' },
  { label: 'My Stock', icon: Package, href: '/fo/my-stock' },
  { label: 'Submit Sale', icon: ShoppingCart, href: '/fo/submit-sale' },
  { label: 'My Commissions', icon: DollarSign, href: '/fo/commissions' },
  { label: 'Sales History', icon: FileBarChart, href: '/fo/sales-history' },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentUser, setCurrentUser, logout } = useApp();

  const isFO = currentUser?.role === 'field_officer';
  const isRegionalManager = currentUser?.role === 'regional_manager';
  const isTeamLeader = currentUser?.role === 'team_leader';
  const navItems = isFO ? foNavItems : isTeamLeader ? teamLeaderNavItems : isRegionalManager ? regionalNavItems : adminNavItems;
  
  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return currentUser && item.roles.includes(currentUser.role);
  });

  const handleNavClick = () => {
    // Close sidebar on mobile when navigating
    if (onClose) onClose();
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: 'Admin',
      regional_manager: 'Regional Manager',
      team_leader: 'Team Leader',
      field_officer: 'Field Officer',
    };
    return roleLabels[role] || role;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center border-b border-sidebar-border px-4 h-16', collapsed && 'justify-center px-2')}>
        {isFO ? (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg gradient-brand flex items-center justify-center text-white font-bold">
              FO
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-sm font-heading font-bold text-sidebar-foreground">FO Portal</h1>
                <p className="text-xs text-sidebar-foreground/60">Field Officer</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <img src={logo} alt="Finetech" className={cn('transition-all', collapsed ? 'w-8 h-8' : 'w-10 h-10')} />
            {!collapsed && (
              <div className="ml-3">
                <h1 className="text-sm font-heading font-bold text-sidebar-foreground">Finetech</h1>
                <p className="text-xs text-sidebar-foreground/60">Media Operations</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-3">
        {currentUser && !collapsed && (
          <div className="mb-3 rounded-lg bg-sidebar-accent p-3">
            <p className="text-sm font-medium text-sidebar-foreground">{currentUser.name}</p>
            <span className="inline-block mt-1 rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-xs font-medium text-sidebar-primary">
              {getRoleBadge(currentUser.role)}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            collapsed && 'px-2'
          )}
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
