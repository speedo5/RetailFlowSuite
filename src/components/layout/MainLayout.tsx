import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { NavLink } from '@/components/NavLink';
import { useApp } from '@/context/AppContext';
import { LoginPage } from '@/pages/LoginPage';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { currentUser, isSessionLoading } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show loading spinner while session is being restored
  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <p className="text-muted-foreground">Restoring session...</p>
        </div>
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - hidden on mobile, visible on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      
      {/* Top Bar */}
      <div className="fixed top-0 right-0 left-0 lg:left-64 z-30 h-14 lg:h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 lg:px-6">
        {/* Mobile menu button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 lg:hidden" />
        
        <div className="flex items-center gap-2 lg:gap-4 ml-auto">
          <NotificationBell />
          <NavLink to="/profile" className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs lg:text-sm font-medium">
            {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </NavLink>
        </div>
      </div>
      
      <main className="lg:pl-64 pt-14 lg:pt-16 transition-all duration-300 w-full overflow-x-hidden">
        <div className="min-h-screen p-4 lg:p-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
