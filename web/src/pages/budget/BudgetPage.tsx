import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Progress } from '../../components/ui/progress';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface BudgetItem {
  id: string;
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentage: number;
}

interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overBudgetItems: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function BudgetPage() {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const { data: summary } = useQuery({
    queryKey: ['budget-summary', selectedProject],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedProject !== 'all') params.append('project', selectedProject);
      return apiClient.get<BudgetSummary>(`/budget/summary?${params}`);
    },
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['budget-items', selectedProject],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedProject !== 'all') params.append('project', selectedProject);
      return apiClient.get<BudgetItem[]>(`/budget/items?${params}`);
    },
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects?fields=id,name'),
  });
  const projects = projectsData?.projects || [];

  const chartData = items?.map((item, index) => ({
    name: item.category,
    value: item.actual,
    color: COLORS[index % COLORS.length],
  }));

  const budgetProgress = summary ? (summary.totalSpent / summary.totalBudget) * 100 : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Budget Management</h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">Track project budgets and expenses</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => navigate('/expenses')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <Select value={selectedProject} onValueChange={setSelectedProject}>
        <SelectTrigger className="w-full sm:w-[250px]">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          {projects?.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
        <Card className="overflow-hidden rounded-2xl sm:rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalBudget || 0)}</div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl sm:rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalSpent || 0)}</div>
            <Progress value={budgetProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.totalRemaining || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Over Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.overBudgetItems || 0}</div>
            <p className="text-sm text-gray-500 mt-1">items</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budget Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget Details</CardTitle>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {items?.length ? (
                    items.map((item) => {
                      const isOverBudget = item.variance < 0;

                      return (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-slate-900">{item.category}</h3>
                              <p className="mt-1 text-sm text-slate-500">{Math.round(item.percentage || 0)}% of budget used</p>
                            </div>
                            <div className={isOverBudget ? 'text-red-600' : 'text-green-600'}>
                              {isOverBudget ? (
                                <TrendingDown className="h-5 w-5" />
                              ) : (
                                <TrendingUp className="h-5 w-5" />
                              )}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Budgeted</p>
                              <p className="mt-1 font-semibold text-slate-900">{formatCurrency(item.budgeted)}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Actual</p>
                              <p className="mt-1 font-semibold text-slate-900">{formatCurrency(item.actual)}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="text-slate-500">Variance</span>
                              <span className={isOverBudget ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>
                                {formatCurrency(Math.abs(item.variance))}
                              </span>
                            </div>
                            <Progress value={Math.min(Math.max(item.percentage || 0, 0), 100)} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
                      <p className="text-sm font-medium text-slate-900">No budget details found</p>
                      <p className="mt-1 text-sm text-slate-500">Choose another project or add expenses.</p>
                    </div>
                  )}
                </div>

                <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Budgeted</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell>{formatCurrency(item.budgeted)}</TableCell>
                      <TableCell>{formatCurrency(item.actual)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.variance < 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          )}
                          <span className={item.variance < 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(Math.abs(item.variance))}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BudgetPage;
