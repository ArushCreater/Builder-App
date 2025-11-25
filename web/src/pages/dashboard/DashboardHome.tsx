import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import {
  Users,
  FolderKanban,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Target,
  ShieldAlert,
  Sparkles,
  FileText,
  CalendarRange,
  Briefcase,
  ArrowRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCurrency, formatRelativeTime } from '../../lib/utils';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalLeads: number;
  totalRevenue: number;
  revenueGrowth: number;
  completedTasks: number;
  pendingTasks: number;
  overdueProjects: number;
  planningProjects: number;
  atRiskBudget: number;
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  progress: number;
  budget: number;
  spent: number;
  dueDate: string;
}

const projectChartData = [
  { name: 'Jan', projects: 12 },
  { name: 'Feb', projects: 19 },
  { name: 'Mar', projects: 15 },
  { name: 'Apr', projects: 25 },
  { name: 'May', projects: 22 },
  { name: 'Jun', projects: 30 },
];

const revenueChartData = [
  { name: 'Jan', revenue: 45000 },
  { name: 'Feb', revenue: 52000 },
  { name: 'Mar', revenue: 48000 },
  { name: 'Apr', revenue: 61000 },
  { name: 'May', revenue: 55000 },
  { name: 'Jun', revenue: 67000 },
];

export function DashboardHome() {
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: () => apiClient.get<{ projects: any[] }>('/projects'),
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: () => apiClient.get<{ leads: any[] }>('/leads'),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => apiClient.get<{ tasks: any[] }>('/tasks'),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => apiClient.get<{ invoices: any[] }>('/invoices'),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['dashboard-events'],
    queryFn: () => apiClient.get<{ events: any[] }>('/schedule/events'),
  });

  const statsLoading = projectsLoading || leadsLoading;

  // Calculate stats from actual data
  const projects = projectsData?.projects || [];
  const leads = leadsData?.leads || [];

  const tasks = tasksData?.tasks || [];
  const invoices = invoicesData?.invoices || [];
  const events = eventsData?.events || [];

  const stats: DashboardStats = {
    totalProjects: projects.length,
    activeProjects: projects.filter((p: any) => p.status === 'IN_PROGRESS').length,
    planningProjects: projects.filter((p: any) => p.status === 'PLANNING').length,
    totalLeads: leads.length,
    totalRevenue: projects.reduce((sum: number, p: any) => sum + (p.actualCost || 0), 0),
    revenueGrowth: 12.5, // TODO: Calculate from historical data
    completedTasks: tasks.filter((t: any) => t.status === 'done').length,
    pendingTasks: tasks.filter((t: any) => t.status !== 'done').length,
    overdueProjects: projects.filter((p: any) => p.endDate && new Date(p.endDate) < new Date()).length,
    atRiskBudget: projects.filter((p: any) => {
      const est = Number(p.estimatedBudget || 0);
      const act = Number(p.actualCost || 0);
      return est > 0 && act / est >= 0.9;
    }).length,
  };

  // Generate recent activity from projects and leads
  const recentActivity: RecentActivity[] = [
    ...projects.slice(0, 3).map((p: any) => ({
      id: p.id,
      type: 'project',
      title: 'Project updated',
      description: p.name,
      timestamp: p.updatedAt || p.createdAt,
      user: 'System',
    })),
    ...leads.slice(0, 2).map((l: any) => ({
      id: l.id,
      type: 'lead',
      title: 'New lead',
      description: `${l.firstName} ${l.lastName}`,
      timestamp: l.createdAt,
      user: 'System',
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  // Get active projects
  const activeProjects: Project[] = projects
    .filter((p: any) => p.status && p.status.toUpperCase() !== 'COMPLETED')
    .slice(0, 5)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      status: p.status.toUpperCase(),
      progress: p.progress || 0,
      budget: p.budget || 0,
      spent: p.spent || 0,
      dueDate: p.endDate,
    }));

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Projects',
      value: stats?.totalProjects || 0,
      icon: FolderKanban,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Projects',
      value: stats?.activeProjects || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Planning Pipeline',
      value: stats?.planningProjects || 0,
      icon: Target,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Total Leads',
      value: stats?.totalLeads || 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue || 0),
      icon: DollarSign,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      growth: stats?.revenueGrowth,
    },
    {
      title: 'Open Invoices',
      value: invoices.filter((i: any) => i.status !== 'paid').length || 0,
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  const alerts = [
    stats.overdueProjects > 0 && {
      id: 'alert-overdue',
      title: 'Overdue projects',
      detail: `${stats.overdueProjects} project(s) past end date`,
      severity: 'high',
    },
    stats.atRiskBudget > 0 && {
      id: 'alert-budget',
      title: 'Budget at risk',
      detail: `${stats.atRiskBudget} project(s) >90% of budget`,
      severity: 'medium',
    },
    stats.pendingTasks > 0 && {
      id: 'alert-tasks',
      title: 'Pending tasks',
      detail: `${stats.pendingTasks} task(s) awaiting action`,
      severity: 'low',
    },
  ].filter(Boolean) as Array<{ id: string; title: string; detail: string; severity: 'high' | 'medium' | 'low' }>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute -right-16 -top-12 h-36 w-36 bg-white/5 rounded-full blur-3xl" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold border border-white/15 uppercase tracking-wide">
              Live Control Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mt-3">Project Command Hub</h1>
            <p className="text-slate-200 mt-2 max-w-2xl">
              Track schedules, costs, and team momentum in one view. Inspired by ClickUp-style clarity with builder-grade depth.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="rounded-full bg-white text-slate-900 hover:bg-slate-100 px-5 border border-white/20 shadow">
              Quick create
            </Button>
            <Button variant="outline" className="rounded-full border-white/25 text-white bg-white/10 hover:bg-white/15 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generate report
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border border-slate-200 shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                <div className={`p-2 rounded-xl ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                {stat.growth && (
                  <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    +{stat.growth}% vs last month
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Projects Velocity
            </CardTitle>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100">6 mo trend</Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={projectChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="projects" radius={[12, 12, 4, 4]} fill="url(#colorProjects)" />
                <defs>
                  <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Revenue Momentum
            </CardTitle>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Forecast</Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Active Projects and Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border border-slate-200 shadow-sm bg-white lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Active Projects</CardTitle>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100">
              {activeProjects.length} in flight
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeProjects?.map((project) => (
                <div key={project.id} className="space-y-2 rounded-2xl border border-gray-100 p-4 hover:border-indigo-100 hover:shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{project.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
                      </p>
                    </div>
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100">{project.status}</Badge>
                  </div>
                  <Progress value={project.progress} />
                  <p className="text-xs text-gray-500">
                    Due: {new Date(project.dueDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Alerts & Risks</CardTitle>
            <Badge className="bg-red-50 text-red-700 border-red-100">{alerts.length} open</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.length === 0 && <p className="text-sm text-gray-500">No alerts right now.</p>}
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 bg-gray-50"
                >
                  <div className="mt-1">
                    {alert.severity === 'high' ? (
                      <ShieldAlert className="h-5 w-5 text-red-600" />
                    ) : alert.severity === 'medium' ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Badge className="bg-sky-50 text-sky-700 border-sky-100">Live</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity?.map((activity) => (
                <div key={activity.id} className="flex gap-3 items-start rounded-xl border border-gray-100 p-3 hover:border-indigo-100 transition">
                  <div className="mt-1">
                    {activity.type === 'task_completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : activity.type === 'task_pending' ? (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-indigo-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {activity.user} • {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Summary & Operations */}
      <div className="grid gap-6 xl:grid-cols-4">
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Tasks Summary</CardTitle>
            <Badge className="bg-purple-50 text-purple-700 border-purple-100">Team</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 p-4">
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.completedTasks || 0}</p>
                  <p className="text-sm text-gray-500">Completed Tasks</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 p-4">
                <div className="p-3 bg-amber-50 rounded-xl">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.pendingTasks || 0}</p>
                  <p className="text-sm text-gray-500">Pending Tasks</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Pipeline & Conversions</CardTitle>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Sales</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Leads</span>
              <span className="font-semibold text-gray-900">{stats.totalLeads}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Projects (planning)</span>
              <span className="font-semibold text-gray-900">{stats.planningProjects}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">At-risk budgets</span>
              <span className="font-semibold text-red-600">{stats.atRiskBudget}</span>
            </div>
            <Progress value={Math.min(100, (stats.activeProjects / Math.max(stats.totalProjects, 1)) * 100)} />
            <p className="text-xs text-gray-500">Active/total projects ratio</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white xl:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Cashflow & Invoices</CardTitle>
            <Badge className="bg-amber-50 text-amber-700 border-amber-100">
              {invoices.length} total
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(
                    invoices.filter((i: any) => i.status !== 'paid').reduce((sum: number, i: any) => sum + (i.amount || 0), 0)
                  )}
                </p>
                <p className="text-xs text-amber-600 font-semibold mt-1">
                  {invoices.filter((i: any) => i.status !== 'paid').length} open
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Paid this month</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(
                    invoices
                      .filter((i: any) => i.status === 'paid')
                      .reduce((sum: number, i: any) => sum + (i.amount || 0), 0)
                  )}
                </p>
                <p className="text-xs text-green-600 font-semibold mt-1">Cleared</p>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Next due</p>
                <p className="text-lg font-semibold">
                  {invoices.find((i: any) => i.dueDate)?.dueDate
                    ? new Date(invoices.find((i: any) => i.dueDate).dueDate).toLocaleDateString()
                    : '—'}
                </p>
                <p className="text-xs text-gray-500">Across all projects</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {invoices.slice(0, 4).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 w-full md:w-[48%]">
                  <div>
                    <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">{inv.projectName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(inv.amount || 0)}</p>
                    <Badge variant={inv.status === 'paid' ? 'success' : 'secondary'}>{inv.status}</Badge>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && <p className="text-sm text-gray-500">No invoices yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Upcoming Deadlines</CardTitle>
            <Badge className="bg-orange-50 text-orange-700 border-orange-100">Timeline</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projects
                .filter((p: any) => p.endDate)
                .sort((a: any, b: any) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
                .slice(0, 4)
                .map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.city}, {p.state}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      {new Date(p.endDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              {projects.filter((p: any) => p.endDate).length === 0 && (
                <p className="text-sm text-gray-500">No deadlines scheduled.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule + Quick actions */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border border-slate-200 shadow-sm bg-white xl:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Schedule Highlights</CardTitle>
            <Badge className="bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1">
              <CalendarRange className="h-4 w-4" /> {events.length} events
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {events
              .slice(0, 6)
              .map((e: any) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.projectName || 'Unassigned'} • {e.type}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    {e.startDate ? new Date(e.startDate).toLocaleDateString() : '—'}
                  </div>
                </div>
              ))}
            {events.length === 0 && <p className="text-sm text-gray-500">No scheduled items.</p>}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Quick Actions</CardTitle>
            <Badge className="bg-slate-50 text-slate-700 border-slate-100">Shortcuts</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Create project', icon: Briefcase },
              { label: 'Log a document', icon: FileText },
              { label: 'Schedule event', icon: CalendarRange },
              { label: 'Add task', icon: CheckCircle2 },
            ].map((item) => (
              <Button key={item.label} variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardHome;
