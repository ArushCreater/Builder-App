import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { useToast } from '../../components/ui/use-toast';
import { Plus, Search, Calendar, DollarSign, LayoutGrid, KanbanSquare, Rows, Upload, UserPlus } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';

interface Project {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  startDate?: string;
  endDate?: string;
  estimatedBudget: number;
  actualCost: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

const statusColors = {
  PLANNING: 'secondary',
  IN_PROGRESS: 'default',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
} as const;

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'board' | 'table'>('grid');
  const [quickTaskDialog, setQuickTaskDialog] = useState(false);
  const [quickDocDialog, setQuickDocDialog] = useState(false);
  const [quickAssignDialog, setQuickAssignDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickDocName, setQuickDocName] = useState('');
  const [quickPM, setQuickPM] = useState('');
  const quickDocFileRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'residential',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    estimatedBudget: '',
    startDate: '',
    endDate: '',
  });

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', searchTerm, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      return apiClient.get<{ projects: Project[] }>(`/projects?${params}`);
    },
  });

  const projects = projectsData?.projects || [];
  const filtered = projects;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post<{ project: Project }>('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] });
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        type: 'residential',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        estimatedBudget: '',
        startDate: '',
        endDate: '',
      });
      toast({
        title: 'Success',
        description: 'Project created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project',
        variant: 'destructive',
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: { id: string; status: Project['status'] }) =>
      apiClient.put<{ project: Project }>(`/projects/${data.id}`, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleStatusDrop = (projectId: string, status: Project['status']) => {
    updateStatusMutation.mutate({ id: projectId, status });
  };

  const taskQuickMutation = useMutation({
    mutationFn: (payload: { projectId: string; title: string }) =>
      apiClient.post(`/projects/${payload.projectId}/tasks`, { title: payload.title }),
    onSuccess: () => {
      setQuickTaskDialog(false);
      setQuickTaskTitle('');
      toast({ title: 'Task added' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not add task', variant: 'destructive' }),
  });

  const docQuickMutation = useMutation({
    mutationFn: (payload: { projectId: string; name: string; fileSize?: number; mimeType?: string }) =>
      apiClient.post(`/projects/${payload.projectId}/documents`, {
        name: payload.name,
        type: 'file',
        category: 'other',
        fileSize: payload.fileSize,
        mimeType: payload.mimeType,
      }),
    onSuccess: () => {
      setQuickDocDialog(false);
      setQuickDocName('');
      toast({ title: 'Document added' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not add document', variant: 'destructive' }),
  });

  const assignQuickMutation = useMutation({
    mutationFn: (payload: { projectId: string; ownerId: string }) =>
      apiClient.put(`/projects/${payload.projectId}`, { ownerId: payload.ownerId }),
    onSuccess: () => {
      setQuickAssignDialog(false);
      setQuickPM('');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Assigned' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not assign', variant: 'destructive' }),
  });

  const openQuickTask = (id: string) => {
    setSelectedProjectId(id);
    setQuickTaskDialog(true);
  };
  const openQuickDoc = (id: string) => {
    setSelectedProjectId(id);
    setQuickDocDialog(true);
  };
  const openQuickAssign = (id: string) => {
    setSelectedProjectId(id);
    setQuickAssignDialog(true);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      type: formData.type,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zipCode: formData.zipCode,
      estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : 0,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">Manage your construction projects</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateProject}>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>Add a new construction project</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Project Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="renovation">Renovation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedBudget">Estimated Budget</Label>
                    <Input
                      id="estimatedBudget"
                      name="estimatedBudget"
                      type="number"
                      value={formData.estimatedBudget}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PLANNING">Planning</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'board' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('board')}
              >
                <KanbanSquare className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('table')}
              >
                <Rows className="h-4 w-4" />
              </Button>
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
              {viewMode === 'grid' && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filtered?.map((project) => (
                    <Card
                      key={project.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <Badge variant={statusColors[project.status]}>
                            {project.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {project.description}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-600">Budget Used</span>
                            <span className="font-medium">
                              {project.estimatedBudget > 0
                                ? Math.round((project.actualCost / project.estimatedBudget) * 100)
                                : 0}%
                            </span>
                          </div>
                          <Progress
                            value={project.estimatedBudget > 0
                              ? (project.actualCost / project.estimatedBudget) * 100
                              : 0}
                          />
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-gray-600">
                              <DollarSign className="h-4 w-4 mr-1" />
                              Budget
                            </div>
                            <span className="font-medium">
                              {formatCurrency(project.actualCost)} / {formatCurrency(project.estimatedBudget)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-gray-600">
                              <Calendar className="h-4 w-4 mr-1" />
                              Schedule
                            </div>
                            <span className="font-medium text-right">
                              {project.startDate ? formatDate(project.startDate) : '—'} →{' '}
                              {project.endDate ? formatDate(project.endDate) : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-gray-600">Location</div>
                            <span className="font-medium text-right">{project.city}, {project.state}</span>
                          </div>
                          {project.endDate && (
                            <div className="flex items-center justify-between">
                              <div className="text-gray-600">Deadline</div>
                              <span className="font-medium">{formatDate(project.endDate)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Tasks: —</span>
                          <span>Docs: —</span>
                          <span>Owner: —</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openQuickTask(project.id); }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openQuickDoc(project.id); }}>
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openQuickAssign(project.id); }}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {viewMode === 'board' && (
                <div className="grid md:grid-cols-3 gap-4">
                  {(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'] as Project['status'][]).map((status) => {
                    const columnProjects = filtered.filter((p) => p.status === status);
                    const titleMap: Record<Project['status'], string> = {
                      PLANNING: 'Planning',
                      IN_PROGRESS: 'In Progress',
                      ON_HOLD: 'On Hold',
                      COMPLETED: 'Completed',
                      CANCELLED: 'Cancelled',
                    };
                    return (
                      <div key={status} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <span className="font-semibold text-gray-800">{titleMap[status]}</span>
                          <Badge variant={statusColors[status]}>{columnProjects.length}</Badge>
                        </div>
                        <div
                          className="space-y-3 p-3 min-h-[200px]"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            const projectId = e.dataTransfer.getData('text/plain');
                            if (projectId) handleStatusDrop(projectId, status);
                          }}
                        >
                          {columnProjects.length === 0 ? (
                            <div className="text-sm text-gray-400 text-center py-6">No projects</div>
                          ) : (
                            columnProjects.map((project) => (
                            <Card
                              key={project.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => navigate(`/projects/${project.id}`)}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', project.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                            >
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base">{project.name}</CardTitle>
                                  <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
                                </CardHeader>
                            <CardContent className="space-y-2 text-xs text-gray-600">
                              <div className="flex items-center justify-between">
                                <span>Budget</span>
                                <span className="font-semibold text-gray-900">
                                  {formatCurrency(project.actualCost)} / {formatCurrency(project.estimatedBudget)}
                                </span>
                              </div>
                              {project.endDate && (
                                <div className="flex items-center justify-between">
                                  <span>Deadline</span>
                                  <span className="font-semibold text-gray-900">
                                    {formatDate(project.endDate)}
                                  </span>
                                </div>
                              )}
                                <Progress
                                  value={
                                    project.estimatedBudget > 0
                                      ? (project.actualCost / project.estimatedBudget) * 100
                                      : 0
                                  }
                                />
                                <div className="flex items-center justify-between">
                                  <span>Location</span>
                                  <span className="font-semibold text-gray-900">
                                    {project.city}, {project.state}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 justify-end pt-2">
                                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openQuickTask(project.id); }}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openQuickDoc(project.id); }}>
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openQuickAssign(project.id); }}>
                                    <UserPlus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Budget</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dates</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{project.name}</div>
                            <div className="text-sm text-gray-500 line-clamp-1">{project.description}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[project.status]}>{project.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(project.actualCost)} / {formatCurrency(project.estimatedBudget)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {project.city}, {project.state}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {project.startDate ? formatDate(project.startDate) : '—'} →{' '}
                            {project.endDate ? formatDate(project.endDate) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>
                                View
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openQuickTask(project.id)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openQuickDoc(project.id)}>
                                <Upload className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openQuickAssign(project.id)}>
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick action dialogs */}
      <Dialog open={quickTaskDialog} onOpenChange={setQuickTaskDialog}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedProjectId && quickTaskTitle) {
                taskQuickMutation.mutate({ projectId: selectedProjectId, title: quickTaskTitle });
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Quick Add Task</DialogTitle>
              <DialogDescription>Add a task to the selected project</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="quick-task">Task Title</Label>
              <Input
                id="quick-task"
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQuickTaskDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={taskQuickMutation.isPending || !selectedProjectId}>
                {taskQuickMutation.isPending ? 'Adding...' : 'Add Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={quickDocDialog} onOpenChange={setQuickDocDialog}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedProjectId && quickDocName) {
                const size = (quickDocFileRef.current as any)?._size as number | undefined;
                const mime = (quickDocFileRef.current as any)?._mime as string | undefined;
                docQuickMutation.mutate({
                  projectId: selectedProjectId,
                  name: quickDocName,
                  fileSize: size,
                  mimeType: mime,
                });
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Quick Upload</DialogTitle>
            <DialogDescription>Add a document placeholder to the project</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="quick-doc">File Name</Label>
            <Input
              id="quick-doc"
              value={quickDocName}
              onChange={(e) => setQuickDocName(e.target.value)}
              required
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => quickDocFileRef.current?.click()}
              >
                Choose File
              </Button>
              {quickDocName && <span className="text-sm text-gray-600">{quickDocName}</span>}
              <input
                ref={quickDocFileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setQuickDocName(file.name);
                    // store size/mime in ref via attributes
                    (quickDocFileRef.current as any)._size = file.size;
                    (quickDocFileRef.current as any)._mime = file.type;
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setQuickDocDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={docQuickMutation.isPending || !selectedProjectId}>
              {docQuickMutation.isPending ? 'Adding...' : 'Add File'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

      <Dialog open={quickAssignDialog} onOpenChange={setQuickAssignDialog}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedProjectId && quickPM) {
                assignQuickMutation.mutate({ projectId: selectedProjectId, ownerId: quickPM });
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Assign PM</DialogTitle>
              <DialogDescription>Set a project owner/PM id</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="quick-pm">Owner/PM</Label>
              <Input
                id="quick-pm"
                value={quickPM}
                onChange={(e) => setQuickPM(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQuickAssignDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={assignQuickMutation.isPending || !selectedProjectId}>
                {assignQuickMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectsPage;
