import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Plus, Search, Edit, Trash2, Building2 } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
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
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Bid {
  id: string;
  projectId?: string;
  projectName: string;
  vendor: string;
  contact?: string;
  category: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  submittedDate: string;
  validUntil: string;
  notes: string;
  scope?: string;
}

const statusColors = {
  'pending': 'warning',
  'accepted': 'success',
  'rejected': 'destructive',
  'withdrawn': 'secondary',
} as const;

export function BidsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    projectId: '',
    projectName: '',
    vendor: '',
    contact: '',
    category: '',
    amount: '',
    status: 'pending' as Bid['status'],
    submittedDate: '',
    validUntil: '',
    notes: '',
    scope: '',
  });

  const { data: bids, isLoading } = useQuery({
    queryKey: ['bids', searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ bids: Bid[] }>(`/bids?${params}`);
    },
  });
  const bidRows = useMemo(
    () =>
      (bids?.bids || []).map((b: any) => ({
        ...b,
        projectId: b.projectId || b.project_id || '',
        projectName: b.projectName || b.project_name || '',
        category: b.category || b.scope || '',
        submittedDate: b.submittedDate || b.submitted_date || '',
        validUntil: b.validUntil || b.valid_until || '',
        amount: Number(b.amount ?? 0),
      })),
    [bids?.bids]
  );

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'bids'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects'),
  });

  const filtered = useMemo(() => bidRows, [bidRows]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/bids', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({
        projectId: '',
        projectName: '',
        vendor: '',
        contact: '',
        category: '',
        amount: '',
        status: 'pending',
        submittedDate: '',
        validUntil: '',
        notes: '',
        scope: '',
      });
      toast({ title: 'Saved', description: 'Bid saved successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save bid', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: any }) => apiClient.put(`/bids/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      setIsDialogOpen(false);
      setEditingId(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update bid', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/bids/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      toast({ title: 'Deleted', description: 'Bid removed' });
    },
    onError: () => toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProject = formData.projectId
      ? projectsData?.projects.find((p) => p.id === formData.projectId)
      : undefined;
    const payload = {
      ...formData,
      amount: parseFloat(formData.amount) || 0,
      projectId: formData.projectId || undefined,
      projectName: formData.projectName || selectedProject?.name || '',
      submittedDate: formData.submittedDate || undefined,
      validUntil: formData.validUntil || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (bid: Bid) => {
    setEditingId(bid.id);
    setFormData({
      projectId: bid.projectId || '',
      projectName: bid.projectName || '',
      vendor: bid.vendor,
      contact: bid.contact || '',
      category: bid.category,
      amount: bid.amount.toString(),
      status: bid.status,
      submittedDate: bid.submittedDate || '',
      validUntil: bid.validUntil || '',
      notes: bid.notes || '',
      scope: bid.scope || '',
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Bids</h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">Manage contractor bids and proposals</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? 'Edit Bid' : 'Request Bid'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Bid' : 'New Bid Request'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, projectId: '', projectName: '' });
                          return;
                        }
                        const proj = projectsData?.projects.find(p => p.id === value);
                        setFormData({ ...formData, projectId: value, projectName: proj?.name || '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projectsData?.projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor / Contractor</Label>
                    <Input
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Scope / Category</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Electrical, Plumbing, etc."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      placeholder="email or phone"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: Bid['status']) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="withdrawn">Withdrawn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Submitted Date</Label>
                    <Input
                      type="date"
                      value={formData.submittedDate}
                      onChange={(e) => setFormData({ ...formData, submittedDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Scope / Notes</Label>
                  <Input
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    placeholder="Deliverables, exclusions, timeline notes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Internal comments"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editingId ? updateMutation.isPending : createMutation.isPending}>
                  {editingId
                    ? updateMutation.isPending
                      ? 'Saving...'
                      : 'Save Changes'
                    : createMutation.isPending
                      ? 'Saving...'
                      : 'Create Bid'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filtered.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{filtered.filter(b => b.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{filtered.filter(b => b.status === 'accepted').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filtered.reduce((sum, b) => sum + (b.amount || 0), 0))}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl sm:rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search bids..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsData?.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
                    <Building2 className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-900">No bids found</p>
                    <p className="mt-1 text-sm text-slate-500">Try a different search or filter.</p>
                  </div>
                ) : (
                  filtered.map((bid) => (
                    <div key={bid.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-slate-900">{bid.vendor}</h3>
                              <p className="mt-0.5 truncate text-sm text-slate-500">{bid.projectName || 'No project'}</p>
                            </div>
                            <Badge variant={statusColors[bid.status as Bid['status']]} className="shrink-0">
                              {bid.status}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount</p>
                              <p className="mt-1 font-semibold text-slate-900">{formatCurrency(bid.amount)}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valid until</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {bid.validUntil ? formatDate(bid.validUntil) : '-'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-slate-600">
                            <p className="truncate"><span className="font-medium text-slate-700">Category:</span> {bid.category || '-'}</p>
                            <p className="truncate"><span className="font-medium text-slate-700">Contact:</span> {bid.contact || '-'}</p>
                            <p><span className="font-medium text-slate-700">Submitted:</span> {bid.submittedDate ? formatDate(bid.submittedDate) : '-'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                        <Select
                          value={bid.status}
                          onValueChange={(value) =>
                            updateMutation.mutate({ id: bid.id, data: { status: value as Bid['status'] } })
                          }
                        >
                          <SelectTrigger className="col-span-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(bid)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <ConfirmDialog
                          title="Delete bid?"
                          description="This permanently removes the bid. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(bid.id)}
                          trigger={
                            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((bid) => (
                  <TableRow key={bid.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {bid.projectName}
                      </div>
                    </TableCell>
                    <TableCell>{bid.vendor}</TableCell>
                    <TableCell>{bid.category || '—'}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(bid.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[bid.status as Bid['status']]}>
                        {bid.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{bid.submittedDate ? formatDate(bid.submittedDate) : '—'}</TableCell>
                    <TableCell>{bid.validUntil ? formatDate(bid.validUntil) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Select
                          value={bid.status}
                          onValueChange={(value) =>
                            updateMutation.mutate({ id: bid.id, data: { status: value as Bid['status'] } })
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(bid)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title="Delete bid?"
                          description="This permanently removes the bid. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(bid.id)}
                          trigger={
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          }
                        />
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
  );
}

export default BidsPage;
