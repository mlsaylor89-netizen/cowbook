import { Link, useLocation } from 'wouter';
import { Home, List, Heart, FlaskConical, Menu, Plus, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { userDoc } = useAuth();
  const isViewer = userDoc?.role === 'viewer';

  const isPrint = location === '/print-report';

  if (isPrint) {
    return <div className="min-h-[100dvh] bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden sm:flex flex-col w-64 border-r bg-card h-[100dvh] sticky top-0 shrink-0">
        <div className="flex h-16 items-center px-6 border-b bg-primary text-primary-foreground">
          <h1 className="text-xl font-bold tracking-tight">HerdTrack</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <SidebarItem href="/" icon={Home} label="Home" active={location === '/'} />
          <SidebarItem href="/herd" icon={List} label="Herd" active={location.startsWith('/herd')} />
          <SidebarItem href="/breeding" icon={Heart} label="Record Breeding" active={location.startsWith('/breeding')} />
          <SidebarItem href="/heat" icon={Thermometer} label="Record Heat" active={location.startsWith('/heat')} />
          <SidebarItem href="/semen" icon={FlaskConical} label="Semen Inventory" active={location.startsWith('/semen')} />
          <SidebarItem href="/more" icon={Menu} label="More" active={location.startsWith('/more')} />
        </nav>
        {!isViewer && (
          <div className="p-4 border-t">
            <Button onClick={() => setLocation('/herd/new')} className="w-full h-12 font-bold" size="lg">
              <Plus className="mr-2 h-5 w-5" /> Add Animal
            </Button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="sm:hidden sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-primary px-4 shadow-sm text-primary-foreground">
          <h1 className="text-lg font-bold tracking-tight">HerdTrack</h1>
        </header>
        
        <main className="flex-1 pb-20 sm:pb-8 px-4 py-4 sm:px-8 sm:py-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-20 right-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={16}>
            <DropdownMenuItem className="h-12 text-base" onClick={() => setLocation('/breeding')}>Record Breeding</DropdownMenuItem>
            <DropdownMenuItem className="h-12 text-base" onClick={() => setLocation('/heat')}>Record Heat</DropdownMenuItem>
            <DropdownMenuItem className="h-12 text-base" onClick={() => setLocation('/treatment')}>Record Treatment</DropdownMenuItem>
            {!isViewer && (
              <DropdownMenuItem className="h-12 text-base" onClick={() => setLocation('/herd/new')}>Add Animal</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-t bg-card px-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavItem href="/" icon={Home} label="Home" active={location === '/'} />
        <NavItem href="/herd" icon={List} label="Herd" active={location.startsWith('/herd')} />
        <NavItem href="/breeding" icon={Heart} label="Breed" active={location.startsWith('/breeding')} />
        <NavItem href="/semen" icon={FlaskConical} label="Semen" active={location.startsWith('/semen')} />
        <NavItem href="/more" icon={Menu} label="More" active={location.startsWith('/more')} />
      </nav>
    </div>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center justify-center w-full h-full space-y-1 rounded-lg transition-colors ${active ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:bg-secondary/50'}`}>
      <Icon className="h-6 w-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function SidebarItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-sm font-medium ${active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'}`}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
