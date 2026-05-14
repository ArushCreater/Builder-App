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
import { Plus, Search, CheckCircle2, XCircle, Clock, Edit, Trash2 } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface Inspection {
  id: string;
  type: string;
  projectId?: string;
  projectName: string;
  scheduledDate: string;
  status: 'scheduled' | 'passed' | 'failed' | 'pending';
  inspector: string;
  notes: string;
  completedDate?: string;
}

const statusColors = {
  'scheduled': 'default',
  'passed': 'success',
  'failed': 'destructive',
  'pending': 'warning',
} as const;

export function InspectionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: '',
    projectName: '',
    projectId: '',
    scheduledDate: '',
    inspector: '',
    notes: '',
    status: 'scheduled' as Inspection['status'],
    completedDate: '',
  });

  const { data: inspections, isLoading } = useQuery({
    queryKey: ['inspections', searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ inspections: Inspection[] }>(`/inspections?${params}`);
    },
  });
  const inspectionRows = useMemo(
    () =>
      (inspections?.inspections || []).map((i: any) => ({
        ...i,
        projectId: i.projectId || i.project_id || '',
        projectName: i.projectName || i.project_name || '',
        scheduledDate: i.scheduledDate || i.scheduled_date || i.date || '',
        completedDate: i.completedDate || i.completed_date || '',
        status: i.status || 'scheduled',
        notes: i.notes || '',
      })),
    [inspections?.inspections]
  );

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'inspections'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Inspection>) => apiClient.post('/inspections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      setIsCreateDialogOpen(false);
      setFormData({
        type: '',
        projectName: '',
        projectId: '',
        scheduledDate: '',
        inspector: '',
        notes: '',
        status: 'scheduled',
        completedDate: '',
      });
      toast({
        title: 'Success',
        description: 'Inspection scheduled successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule inspection',
        variant: 'destructive',
      });
    },
  });

  const handleCreateInspection = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      projectId: formData.projectId || undefined,
      projectName:
        formData.projectId && projectsData?.projects.find((p) => p.id === formData.projectId)
          ? projectsData.projects.find((p) => p.id === formData.projectId)?.name || ''
          : formData.projectName,
      scheduledDate: formData.scheduledDate || undefined,
      completedDate: formData.completedDate || undefined,
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
    mutationFn: (payload: { id: string; data: Partial<Inspection> }) =>
      apiClient.put(`/inspections/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      setIsCreateDialogOpen(false);
      setEditingId(null);
      setFormData({
        type: '',
        projectName: '',
        projectId: '',
        scheduledDate: '',
        inspector: '',
        notes: '',
        status: 'scheduled',
        completedDate: '',
      });
      toast({ title: 'Updated', description: 'Inspection updated successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Update failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/inspections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      toast({ title: 'Deleted', description: 'Inspection removed' });
    },
    onError: () => toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' }),
  });

  const filtered = useMemo(() => inspectionRows, [inspectionRows]);

  const handleEdit = (inspection: Inspection) => {
    setEditingId(inspection.id);
    setFormData({
      type: inspection.type,
      projectName: inspection.projectName,
      projectId: inspection.projectId || '',
      scheduledDate: inspection.scheduledDate,
      inspector: inspection.inspector,
      notes: inspection.notes,
      status: inspection.status,
      completedDate: inspection.completedDate || '',
    });
    setIsCreateDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Inspections</h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">Schedule and track building inspections</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Schedule Inspection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateInspection}>
              <DialogHeader>
                <DialogTitle>Schedule Inspection</DialogTitle>
                <DialogDescription>Schedule a new building inspection</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Inspection Type</Label>
                  <Input
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    placeholder="e.g., Foundation, Framing, Final"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <Label htmlFor="scheduledDate">Scheduled Date</Label>
                    <Input
                      id="scheduledDate"
                      name="scheduledDate"
                      type="date"
                      value={formData.scheduledDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Inspection['status']) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspector">Inspector</Label>
                  <Input
                    id="inspector"
                    name="inspector"
                    value={formData.inspector}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Additional information"
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
                      ? 'Saving...'
                      : 'Schedule Inspection'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Inspections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filtered.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {filtered.filter(i => i.status === 'scheduled').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filtered.filter(i => i.status === 'passed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {filtered.filter(i => i.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl sm:rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search inspections..."
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
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
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
                    <Clock className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-900">No inspections found</p>
                    <p className="mt-1 text-sm text-slate-500">Try a different search or filter.</p>
                  </div>
                ) : (
                  filtered.map((inspection) => (
                    <div key={inspection.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50">
                          {getStatusIcon(inspection.status)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-slate-900">{inspection.type}</h3>
                              <p className="mt-0.5 truncate text-sm text-slate-500">{inspection.projectName || 'No project'}</p>
                            </div>
                            <Badge variant={statusColors[inspection.status as Inspection['status']]} className="shrink-0">
                              {inspection.status}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Scheduled</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {inspection.scheduledDate ? formatDate(inspection.scheduledDate) : '-'}
                              </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {inspection.completedDate ? formatDate(inspection.completedDate) : '-'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-slate-600">
                            <p className="truncate"><span className="font-medium text-slate-700">Inspector:</span> {inspection.inspector || '-'}</p>
                            {inspection.notes && (
                              <p className="line-clamp-2"><span className="font-medium text-slate-700">Notes:</span> {inspection.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                        <Select
                          value={inspection.status}
                          onValueChange={(value) =>
                            updateMutation.mutate({ id: inspection.id, data: { status: value as Inspection['status'] } })
                          }
                        >
                          <SelectTrigger className="col-span-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="passed">Passed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(inspection)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <ConfirmDialog
                          title="Delete inspection?"
                          description="This permanently removes the inspection. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(inspection.id)}
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
                  <TableHead>Type</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inspection) => (
                  <TableRow key={inspection.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(inspection.status)}
                        {inspection.type}
                      </div>
                    </TableCell>
                    <TableCell>{inspection.projectName}</TableCell>
                    <TableCell>{formatDate(inspection.scheduledDate)}</TableCell>
                    <TableCell>{inspection.inspector}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[inspection.status as Inspection['status']]}>
                        {inspection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inspection.completedDate ? formatDate(inspection.completedDate) : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{inspection.notes}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Select
                          value={inspection.status}
                          onValueChange={(value) =>
                            updateMutation.mutate({ id: inspection.id, data: { status: value as Inspection['status'] } })
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="passed">Passed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(inspection)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title="Delete inspection?"
                          description="This permanently removes the inspection. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(inspection.id)}
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

export default InspectionsPage;
