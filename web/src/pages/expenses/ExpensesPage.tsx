import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import { Plus, Search, Banknote, Building, CreditCard, Calendar as CalendarIcon, Receipt } from 'lucide-react';
import { formatCurrency, formatDateShort } from '../../lib/utils';

type Expense = {
  id: string;
  title: string;
  type: 'project' | 'non-project';
  category: string;
  vendor: string;
  amount: number;
  tax?: number;
  total?: number;
  status?: string;
  paymentMethod?: string;
  date?: string;
  dueDate?: string;
  projectId?: string;
  projectName?: string;
  notes?: string;
  receiptUrl?: string;
  receiptName?: string;
  receiptType?: string;
};

type ProjectOption = { id: string; name: string };

const statusBadges: Record<string, { label: string; variant: 'secondary' | 'default' | 'warning' | 'destructive' | 'outline' | 'success' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'success' },
  overdue: { label: 'Overdue', variant: 'destructive' },
};

export default function ExpensesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<'project' | 'non-project'>('project');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    title: '',
    type: 'project',
    category: '',
    vendor: '',
    amount: 0,
    tax: 0,
    total: 0,
    status: 'pending',
    paymentMethod: 'credit_card',
    date: '',
    dueDate: '',
    projectId: '',
    projectName: '',
    notes: '',
    receiptUrl: '',
    receiptName: '',
    receiptType: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'expenses'],
    queryFn: () => apiClient.get<{ projects: ProjectOption[] }>('/projects'),
  });

  const { data: expenseData, isLoading } = useQuery({
    queryKey: ['expenses', segment, searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('type', segment);
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ expenses: Expense[] }>(`/expenses?${params}`);
    },
  });

  const expenses = useMemo(() => expenseData?.expenses || [], [expenseData?.expenses]);

  const totals = useMemo(() => {
    const sum = expenses.reduce(
      (acc, e) => {
        acc.amount += e.amount || 0;
        acc.tax += e.tax || 0;
        acc.total += e.total || e.amount || 0;
        return acc;
      },
      { amount: 0, tax: 0, total: 0 }
    );
    return sum;
  }, [expenses]);

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Expense>) => apiClient.post('/expenses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({ title: '', type: segment, status: 'pending', paymentMethod: 'credit_card' });
      toast({ title: 'Saved', description: 'Expense recorded' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save expense', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<Expense> }) =>
      apiClient.put(`/expenses/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDialogOpen(false);
      setEditingId(null);
      toast({ title: 'Updated', description: 'Expense updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update expense', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Deleted', description: 'Expense removed' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete expense', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Expense> = {
      ...formData,
      total: formData.total && formData.total > 0 ? formData.total : (formData.amount || 0) + (formData.tax || 0),
    };
    if (segment === 'non-project') {
      payload.projectId = '';
      payload.projectName = '';
    } else if (payload.projectId) {
      const proj = projectsData?.projects.find(p => p.id === payload.projectId);
      payload.projectName = proj?.name || payload.projectName;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setIsDialogOpen(true);
    setSegment(exp.type as 'project' | 'non-project');
    setFormData({
      ...exp,
      amount: exp.amount ?? 0,
      tax: exp.tax ?? 0,
      total: exp.total ?? (exp.amount || 0),
    });
  };

  const filteredProjects = useMemo(
    () => (projectsData?.projects || []).map(p => ({ id: p.id, name: p.name })),
    [projectsData?.projects]
  );

  const renderExpenseCard = (exp: Expense) => (
    <div
      key={exp.id}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{exp.category || 'General'}</Badge>
            <Badge variant={statusBadges[exp.status || 'pending']?.variant || 'outline'}>
              {statusBadges[exp.status || 'pending']?.label || exp.status || 'Pending'}
            </Badge>
          </div>
          <h3 className="text-base font-semibold text-slate-900">{exp.title}</h3>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> {exp.date ? formatDateShort(exp.date) : 'No date'}
          </p>
          {exp.projectName && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Building className="h-3 w-3" /> {exp.projectName}
            </p>
          )}
          {exp.vendor && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Banknote className="h-3 w-3" /> {exp.vendor}
            </p>
          )}
        </div>
        <div className="text-right space-y-1">
          <div className="text-xl font-bold text-slate-900">{formatCurrency(exp.total || exp.amount || 0)}</div>
          <div className="text-xs text-slate-500">
            {exp.tax ? `Tax: ${formatCurrency(exp.tax)}` : null}
          </div>
          {exp.receiptUrl && (
            <a
              href={exp.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 text-xs hover:underline"
            >
              <Receipt className="h-3 w-3" /> Receipt
            </a>
          )}
        </div>
      </div>
      {exp.notes && <p className="text-sm text-slate-600 mt-3">{exp.notes}</p>}
      <div className="flex items-center gap-2 mt-3">
        <Button size="sm" variant="ghost" onClick={() => startEdit(exp)}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(exp.id)}>
          Delete
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 mt-1">
            Track project and non-project spending, approvals, and receipts.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setIsDialogOpen(true); setFormData({ ...formData, type: segment }); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(val: 'project' | 'non-project') => setFormData({ ...formData, type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="non-project">Non-project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    placeholder="e.g., Labor, Equipment, Permits"
                    value={formData.category || ''}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input value={formData.vendor || ''} onChange={e => setFormData({ ...formData, vendor: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={formData.amount ?? 0}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax</Label>
                  <Input
                    type="number"
                    value={formData.tax ?? 0}
                    onChange={e => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    type="number"
                    value={formData.total ?? (formData.amount || 0) + (formData.tax || 0)}
                    onChange={e => setFormData({ ...formData, total: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status || 'pending'}
                    onValueChange={val => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={formData.paymentMethod || 'credit_card'}
                    onValueChange={val => setFormData({ ...formData, paymentMethod: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={formData.dueDate || ''} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
                {formData.type === 'project' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={val => {
                        if (val === 'none') {
                          setFormData({ ...formData, projectId: '', projectName: '' });
                          return;
                        }
                        const proj = filteredProjects.find(p => p.id === val);
                        setFormData({ ...formData, projectId: val, projectName: proj?.name || '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {filteredProjects.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Input value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Receipt URL (optional)</Label>
                  <Input
                    value={formData.receiptUrl || ''}
                    onChange={e => setFormData({ ...formData, receiptUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? (updateMutation.isPending ? 'Saving...' : 'Save Changes') : createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-gray-500">{expenses.length} expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Subtotal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totals.amount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totals.tax)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{segment === 'project' ? 'Project expenses' : 'Non-project expenses'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={segment} onValueChange={v => setSegment(v as 'project' | 'non-project')}>
            <TabsList>
              <TabsTrigger value="project">Project Expenses</TabsTrigger>
              <TabsTrigger value="non-project">Non-project Expenses</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            {segment === 'project' && (
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {filteredProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                <p className="text-slate-500 text-sm">Loading expenses...</p>
              </div>
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              <div className="flex flex-col items-center gap-2">
                <div className="bg-slate-100 p-3 rounded-full">
                  <CreditCard className="h-6 w-6 text-slate-400" />
                </div>
                <p className="font-medium text-slate-900">No expenses found</p>
                <p className="text-sm">Add a new expense to get started.</p>
              </div>
            </div>
          ) : (
            <div className="max-h-[650px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {expenses.map(renderExpenseCard)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
