import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  Users,
  FolderKanban,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
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
  // TODO: Replace with real API calls when backend endpoints are ready
  // Using mock data for now
  const stats: DashboardStats = {
    totalProjects: 24,
    activeProjects: 12,
    totalLeads: 45,
    totalRevenue: 328000,
    revenueGrowth: 12.5,
    completedTasks: 156,
    pendingTasks: 43,
  };
  const statsLoading = false;

  const recentActivity: RecentActivity[] = [
    {
      id: '1',
      type: 'project',
      title: 'New project started',
      description: 'Downtown Office Renovation',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      user: 'John Doe',
    },
    {
      id: '2',
      type: 'task',
      title: 'Task completed',
      description: 'Foundation inspection approved',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      user: 'Jane Smith',
    },
  ];

  const activeProjects: Project[] = [
    {
      id: '1',
      name: 'Residential Complex A',
      status: 'IN_PROGRESS',
      progress: 65,
      budget: 500000,
      spent: 325000,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
    {
      id: '2',
      name: 'Commercial Building Renovation',
      status: 'IN_PROGRESS',
      progress: 40,
      budget: 750000,
      spent: 300000,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
    },
  ];

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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening with your projects.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.growth && (
                  <p className="text-xs text-green-600 mt-1">
                    +{stat.growth}% from last month
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="projects" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Active Projects and Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeProjects?.map((project) => (
                <div key={project.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
                      </p>
                    </div>
                    <Badge>{project.status}</Badge>
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

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity?.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="mt-1">
                    {activity.type === 'task_completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : activity.type === 'task_pending' ? (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.title}</p>
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

      {/* Tasks Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.completedTasks || 0}</p>
                <p className="text-sm text-gray-500">Completed Tasks</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pendingTasks || 0}</p>
                <p className="text-sm text-gray-500">Pending Tasks</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardHome;
