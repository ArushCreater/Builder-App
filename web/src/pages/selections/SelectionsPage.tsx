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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Plus, Search, Palette, Edit, Trash2 } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface Selection {
  id: string;
  category: string;
  item: string;
  description: string;
  choice: string;
  cost: number;
  status: 'pending' | 'approved' | 'ordered' | 'installed';
  projectName: string;
  projectId?: string;
  clientName: string;
  dueDate: string;
}

const statusColors = {
  'pending': 'warning',
  'approved': 'default',
  'ordered': 'default',
  'installed': 'success',
} as const;

export function SelectionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    item: '',
    description: '',
    choice: '',
    cost: '',
    projectName: '',
    projectId: '',
    clientName: '',
    dueDate: '',
    status: 'pending' as Selection['status'],
  });

  const { data: selectionsData, isLoading } = useQuery({
    queryKey: ['selections', searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ selections: Selection[] }>(`/selections?${params}`);
    },
  });
  const selections = useMemo(
    () =>
      (selectionsData?.selections || []).map((s: any) => ({
        ...s,
        projectId: s.projectId || s.project_id || '',
        projectName: s.projectName || s.project_name || '',
        clientName: s.clientName || s.client_name || '',
        dueDate: s.dueDate || s.due_date || '',
        cost: Number(s.cost ?? 0),
      })),
    [selectionsData?.selections]
  );

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'selections'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Selection>) => apiClient.post('/selections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selections'] });
      setIsCreateDialogOpen(false);
      setFormData({
        category: '',
        item: '',
        description: '',
        choice: '',
        cost: '',
        projectName: '',
        projectId: '',
        clientName: '',
        dueDate: '',
        status: 'pending',
      });
      toast({
        title: 'Success',
        description: 'Selection added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add selection',
        variant: 'destructive',
      });
    },
  });

  const handleCreateSelection = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProject = formData.projectId
      ? projectsData?.projects.find((p) => p.id === formData.projectId)
      : undefined;
    const payload = {
      ...formData,
      cost: parseFloat(formData.cost),
      projectId: formData.projectId || undefined,
      projectName: formData.projectName || selectedProject?.name || '',
      dueDate: formData.dueDate || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<Selection> }) =>
      apiClient.put(`/selections/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selections'] });
      setIsCreateDialogOpen(false);
      setEditingId(null);
      setFormData({
        category: '',
        item: '',
        description: '',
        choice: '',
        cost: '',
        projectName: '',
        projectId: '',
        clientName: '',
        dueDate: '',
        status: 'pending',
      });
      toast({ title: 'Updated', description: 'Selection updated successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Update failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/selections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selections'] });
      toast({ title: 'Deleted', description: 'Selection removed' });
    },
    onError: () => toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' }),
  });

  const filtered = useMemo(() => selections, [selections]);

  const handleEdit = (selection: Selection) => {
    setEditingId(selection.id);
    setFormData({
      category: selection.category,
      item: selection.item,
      description: selection.description,
      choice: selection.choice,
      cost: selection.cost.toString(),
      projectName: selection.projectName,
      projectId: selection.projectId || '',
      clientName: selection.clientName,
      dueDate: selection.dueDate,
      status: selection.status,
    });
    setIsCreateDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Selections</h1>
          <p className="text-gray-500 mt-1">Track client selections and design choices</p>
        </div>
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setFormData({
                category: '',
                item: '',
                description: '',
                choice: '',
                cost: '',
                projectName: '',
                projectId: '',
                clientName: '',
                dueDate: '',
                status: 'pending',
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Selection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateSelection}>
              <DialogHeader>
                <DialogTitle>Add New Selection</DialogTitle>
                <DialogDescription>Add a client selection item</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      placeholder="e.g., Flooring, Cabinets"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item">Item</Label>
                    <Input
                      id="item"
                      name="item"
                      value={formData.item}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="choice">Choice/Selection</Label>
                    <Input
                      id="choice"
                      name="choice"
                      value={formData.choice}
                      onChange={handleChange}
                      placeholder="Selected option"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost</Label>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project</Label>
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
                    <Label htmlFor="clientName">Client</Label>
                    <Input
                      id="clientName"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editingId ? updateMutation.isPending : createMutation.isPending}>
                  {editingId
                    ? updateMutation.isPending
                      ? 'Saving...'
                      : 'Save Changes'
                    : createMutation.isPending
                      ? 'Adding...'
                      : 'Add Selection'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Selections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filtered.length}</div>
            <p className="text-xs text-gray-500">Across all projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {filtered.filter(s => s.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filtered.filter(s => s.status === 'approved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filtered.reduce((sum, s) => sum + (s.cost || 0), 0))}</div>
            <p className="text-xs text-gray-500">Total of selected items</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search selections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[180px]">
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="installed">Installed</SelectItem>
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
            <div className="overflow-x-auto">

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Choice</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((selection) => (
                  <TableRow key={selection.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-gray-400" />
                        {selection.category}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{selection.item}</TableCell>
                    <TableCell>{selection.choice}</TableCell>
                    <TableCell>{selection.projectName || '—'}</TableCell>
                    <TableCell>{selection.clientName || '—'}</TableCell>
                    <TableCell>{formatCurrency(selection.cost)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[selection.status as Selection['status']]}>
                        {selection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{selection.dueDate ? formatDate(selection.dueDate) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Select
                          value={selection.status}
                          onValueChange={(value) =>
                            updateMutation.mutate({ id: selection.id, data: { status: value as Selection['status'] } })
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="ordered">Ordered</SelectItem>
                            <SelectItem value="installed">Installed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(selection)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title="Delete selection?"
                          description="This permanently removes the selection. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(selection.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SelectionsPage;
