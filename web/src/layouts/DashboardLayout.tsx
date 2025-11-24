import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ClipboardList,
  FileText,
  Calendar,
  DollarSign,
  Receipt,
  Package,
  Palette,
  BookOpen,
  FileCheck,
  Briefcase,
  Hammer,
  MessageSquare,
  BarChart3,
  Settings,
  Bell,
  ChevronDown,
  Menu,
  X,
  UserCircle,
  LogOut,
  Plus,
  Search,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { getInitials } from '../lib/utils';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', path: '/leads', icon: Users },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Tasks', path: '/tasks', icon: ClipboardList },
  { name: 'Proposals', path: '/proposals', icon: FileText },
  { name: 'Schedule', path: '/schedule', icon: Calendar },
  { name: 'Budget', path: '/budget', icon: DollarSign },
  { name: 'Invoices', path: '/invoices', icon: Receipt },
  { name: 'Materials', path: '/materials', icon: Package },
  { name: 'Selections', path: '/selections', icon: Palette },
  { name: 'Daily Logs', path: '/daily-logs', icon: BookOpen },
  { name: 'Documents', path: '/documents', icon: FileCheck },
  { name: 'Bids', path: '/bids', icon: Briefcase },
  { name: 'Inspections', path: '/inspections', icon: Briefcase },
  { name: 'Equipment', path: '/equipment', icon: Hammer },
  { name: 'Messages', path: '/messages', icon: MessageSquare },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Users', path: '/users', icon: Users },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationCount] = useState(3);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-slate-900/95 backdrop-blur border-r border-slate-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 rounded-r-3xl overflow-x-hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 opacity-95" />
          <div className="relative flex items-center justify-between h-16 px-6 text-white">
            <div>
              <h1 className="text-xl font-bold">BuilderOS</h1>
            </div>
            <Badge className="bg-white/15 text-white border-white/20">v1.0.0</Badge>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 pr-1">
          <div className="px-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-semibold rounded-lg transition-all',
                    isActive
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                  )}
                >
                  <span
                    className={cn(
                      'mr-3 h-9 w-9 rounded-full inline-flex items-center justify-center text-sm font-semibold',
                      isActive ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-800 text-slate-300'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-slate-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="hidden md:flex items-center">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 h-4 w-4 text-gray-400" />
                  <input
                    className="w-72 rounded-full border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    placeholder="Search projects, tasks, docs..."
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="outline" className="hidden sm:inline-flex rounded-full border-slate-200 text-slate-900 bg-white hover:bg-slate-100">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <Button variant="ghost" className="rounded-full bg-white border border-slate-200 shadow-sm hover:border-indigo-200 hover:bg-indigo-50">
                Command ⌘K
              </Button>

              {/* Notifications */}
              <button className="relative p-2 rounded-full border border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50">
                <Bell className="h-5 w-5 text-slate-600" />
                {notificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {notificationCount}
                  </Badge>
                )}
              </button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 rounded-full bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar} alt={user?.firstName} />
                      <AvatarFallback>
                        {user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:block text-sm font-semibold">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="py-6 px-4 sm:px-6 lg:px-10 min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
