import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from '../../components/ui/checkbox';
import { useToast } from '../../components/ui/use-toast';
import { Plus, Search, Filter, Calendar, Clock3 } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Progress } from '../../components/ui/progress';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'in_progress' | 'review' | 'done' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  projectName: string;
  projectId?: string;
  dueDate: string;
  completed: boolean;
}

interface ProjectOption {
  id: string;
  name: string;
}

const statusColors = {
  todo: 'secondary',
  'in-progress': 'default',
  in_progress: 'default',
  review: 'warning',
  completed: 'success',
  done: 'success',
} as const;

const priorityColors = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
} as const;

const statusColumns: { key: Task['status']; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'completed', label: 'Completed' },
];

const normalizeStatus = (status?: string): Task['status'] => {
  if (status === 'in_progress') return 'in-progress';
  if (status === 'done') return 'completed';
  return (status as Task['status']) || 'todo';
};

export function TasksPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'project' | 'due' | 'priority'>('project');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: Task['priority'];
    assignee: string;
    projectName: string;
    projectId?: string;
    dueDate: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    assignee: '',
    projectName: '',
    projectId: undefined,
    dueDate: '',
  });
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [viewForm, setViewForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    assignee: '',
    projectId: '',
    projectName: '',
    dueDate: '',
    status: 'todo' as Task['status'],
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => apiClient.get<{ projects: ProjectOption[] }>('/projects'),
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', searchTerm, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      return apiClient.get<{ tasks: Task[] }>(`/tasks?${params}`);
    },
  });

  const tasks = tasksData?.tasks || [];
  const projectOptions = projectsData?.projects || [];

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (projectFilter !== 'all') {
      list = list.filter(t => t.projectId === projectFilter || t.projectName === projectFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      list = list.filter(t => (t.status || 'todo') === statusFilter);
    }
    if (sortBy === 'project') {
      list.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    } else if (sortBy === 'due') {
      list.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    } else if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      list.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    }
    return list;
  }, [tasks, projectFilter, searchTerm, statusFilter, sortBy]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Task>) => apiClient.post('/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsCreateDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        assignee: '',
        projectName: '',
        projectId: undefined,
        dueDate: '',
      });
      toast({
        title: 'Success',
        description: 'Task created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task',
        variant: 'destructive',
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      apiClient.patch(`/tasks/${id}`, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => apiClient.patch(`/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setViewTask(null);
      toast({ title: 'Task updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not update task', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setViewTask(null);
      toast({ title: 'Task deleted' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not delete task', variant: 'destructive' }),
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      completed: false,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const groupedByStatus = statusColumns.map(col => ({
    key: col.key,
    label: col.label,
    tasks: filtered.filter(t => normalizeStatus(t.status) === col.key),
  }));

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">All tasks across projects with fast filters and sorting.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateTask}>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Log work against a project with priority and due date.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
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
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, projectId: undefined, projectName: '' });
                          return;
                        }
                        const project = projectOptions.find(p => p.id === value);
                        setFormData({
                          ...formData,
                          projectId: value,
                          projectName: project?.name || '',
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projectOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignee">Assignee</Label>
                    <Input
                      id="assignee"
                      name="assignee"
                      value={formData.assignee}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: Task['priority']) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      value={formData.dueDate}
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
                  {createMutation.isPending ? 'Creating...' : 'Create Task'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total', value: tasks.length },
          { label: 'In Progress', value: tasks.filter(t => ['in-progress', 'in_progress'].includes(t.status)).length },
          { label: 'Completed', value: tasks.filter(t => ['completed', 'done'].includes(t.status)).length },
          { label: 'Due Soon', value: tasks.filter(t => !!t.dueDate).length },
        ].map(stat => (
          <Card key={stat.label} className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
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
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v: 'project' | 'due' | 'priority') => setSortBy(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="due">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {groupedByStatus.map((col) => (
                <div
                  key={col.key}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId) {
                      updateMutation.mutate({
                        id: taskId,
                        data: { status: col.key, completed: col.key === 'completed' },
                      });
                    }
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold text-gray-800">{col.label}</span>
                    </div>
                    <Badge variant="outline">{col.tasks.length}</Badge>
                  </div>
                  <div className="space-y-3 p-3 min-h-[240px]">
                    {col.tasks.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-8">No tasks</div>
                    ) : (
                      col.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-md border border-gray-200 bg-gray-50 p-3 shadow-sm cursor-move"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="font-semibold text-gray-900">{task.title}</div>
                            <Checkbox
                              checked={task.completed}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({ id: task.id, completed: !!checked })
                              }
                            />
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                            {task.projectName && <Badge variant="secondary">{task.projectName}</Badge>}
                            <Badge variant={priorityColors[task.priority]}>{task.priority}</Badge>
                            <Badge variant={statusColors[normalizeStatus(task.status)] || 'secondary'}>
                              {normalizeStatus(task.status)}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-4 w-4" />
                              {task.assignee || 'Unassigned'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <Progress
                              value={
                                task.completed
                                  ? 100
                                  : normalizeStatus(task.status) === 'in-progress'
                                    ? 50
                                    : normalizeStatus(task.status) === 'review'
                                      ? 75
                                      : 10
                              }
                              className="w-[70%]"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setViewTask(task);
                                setViewForm({
                                  title: task.title,
                                  description: task.description,
                                  priority: task.priority,
                                  assignee: task.assignee,
                                  projectId: task.projectId || '',
                                  projectName: task.projectName || '',
                                  dueDate: task.dueDate || '',
                                  status: normalizeStatus(task.status),
                                });
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    <Dialog open={!!viewTask} onOpenChange={(open) => !open && setViewTask(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
          <DialogDescription>Review, edit, or delete this task.</DialogDescription>
        </DialogHeader>
        {viewTask && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  value={viewForm.title}
                  onChange={(e) => setViewForm({ ...viewForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={viewForm.status} onValueChange={(v: Task['status']) => setViewForm({ ...viewForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={viewForm.description}
                onChange={(e) => setViewForm({ ...viewForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={viewForm.priority} onValueChange={(v: Task['priority']) => setViewForm({ ...viewForm, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Assignee</Label>
                <Input
                  value={viewForm.assignee}
                  onChange={(e) => setViewForm({ ...viewForm, assignee: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Project</Label>
                <Select
                  value={viewForm.projectId || 'none'}
                  onValueChange={(val) => {
                    if (val === 'none') {
                      setViewForm({ ...viewForm, projectId: '', projectName: '' });
                      return;
                    }
                    const proj = projectOptions.find(p => p.id === val);
                    setViewForm({ ...viewForm, projectId: val, projectName: proj?.name || '' });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={viewForm.dueDate}
                  onChange={(e) => setViewForm({ ...viewForm, dueDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between gap-2">
              <Button variant="destructive" onClick={() => deleteMutation.mutate(viewTask.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setViewTask(null)}>Close</Button>
                <Button
                  onClick={() =>
                    updateMutation.mutate({
                      id: viewTask.id,
                      data: {
                        ...viewForm,
                        projectId: viewForm.projectId || undefined,
                        projectName: viewForm.projectName,
                      },
                    })
                  }
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

export default TasksPage;
