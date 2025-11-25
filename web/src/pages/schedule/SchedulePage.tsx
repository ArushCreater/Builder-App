import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Calendar, List, Plus, Clock3, MapPin, GanttChartSquare, Filter, Trash2, Edit } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { useToast } from '../../components/ui/use-toast';

interface ScheduleEvent {
  id: string;
  title: string;
  projectName: string;
  projectId?: string;
  startDate: string;
  endDate: string;
  type: 'task' | 'meeting' | 'inspection' | 'delivery';
  description: string;
  assignee: string;
  location?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee: string;
  projectName: string;
  projectId?: string;
  dueDate?: string;
}

const typeBadges: Record<ScheduleEvent['type'], { label: string; variant: 'secondary' | 'default' | 'warning' | 'destructive' | 'success' }> = {
  task: { label: 'Task', variant: 'secondary' },
  meeting: { label: 'Meeting', variant: 'default' },
  inspection: { label: 'Inspection', variant: 'warning' },
  delivery: { label: 'Delivery', variant: 'success' },
};

export function SchedulePage() {
  const [view, setView] = useState<'calendar' | 'list' | 'gantt'>('calendar');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    projectId: '',
    startDate: '',
    endDate: '',
    type: 'task' as ScheduleEvent['type'],
    assignee: '',
    description: '',
    location: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-schedule'],
    queryFn: () => apiClient.get<{ projects: ProjectOption[] }>('/projects'),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks-for-schedule'],
    queryFn: () => apiClient.get<{ tasks: Task[] }>('/tasks'),
  });

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['schedule-events', selectedProject, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedProject !== 'all') params.append('projectId', selectedProject);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      return apiClient.get<{ events: ScheduleEvent[] }>(`/schedule/events?${params}`);
    },
  });

  const events = eventsData?.events || [];
  const projects = projectsData?.projects || [];
  const tasks = tasksData?.tasks || [];

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      editingId ? apiClient.put(`/schedule/events/${editingId}`, data) : apiClient.post('/schedule/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-events'] });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({
        title: '',
        projectId: '',
        startDate: '',
        endDate: '',
        type: 'task',
        assignee: '',
        description: '',
        location: '',
      });
      toast({ title: 'Saved', description: 'Schedule updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not save event', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/schedule/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-events'] }),
    onError: () => toast({ title: 'Error', description: 'Could not delete event', variant: 'destructive' }),
  });

  const filteredEvents = useMemo(() => {
    const taskEvents: ScheduleEvent[] = tasks
      .filter(t => !!t.dueDate)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        projectName: t.projectName || 'No project',
        projectId: t.projectId,
        startDate: t.dueDate || '',
        endDate: t.dueDate || '',
        type: 'task',
        description: t.description || '',
        assignee: t.assignee || 'Unassigned',
        location: '',
      }));

    const merged = [...events, ...taskEvents];
    const filtered = merged.filter(e => {
      if (selectedProject !== 'all' && e.projectId !== selectedProject) return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [events, tasks, selectedProject, typeFilter]);

  const minDate = filteredEvents.length ? filteredEvents[0].startDate : undefined;
  const maxDate = filteredEvents.length ? filteredEvents[filteredEvents.length - 1].endDate : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find(p => p.id === formData.projectId);
    createMutation.mutate({
      ...formData,
      projectName: project?.name,
    });
  };

  const handleEdit = (event: ScheduleEvent) => {
    setEditingId(event.id);
    setFormData({
      title: event.title,
      projectId: event.projectId || '',
      startDate: event.startDate,
      endDate: event.endDate,
      type: event.type,
      assignee: event.assignee,
      description: event.description,
      location: event.location || '',
    });
    setIsDialogOpen(true);
  };

  const ganttItems = useMemo(() => {
    const combined = [
      ...filteredEvents.map(e => ({
        id: e.id,
        label: e.title,
        projectName: e.projectName,
        start: e.startDate,
        end: e.endDate,
        type: e.type,
      })),
      ...projects
        .filter(p => p.startDate && p.endDate)
        .map(p => ({
          id: `proj-${p.id}`,
          label: `${p.name} (project)`,
          projectName: p.name,
          start: p.startDate!,
          end: p.endDate!,
          type: 'task' as ScheduleEvent['type'],
        })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    return combined;
  }, [filteredEvents, projects]);

  const computeBar = (start: string, end: string) => {
    if (!minDate || !maxDate) return { left: '0%', width: '100%' };
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime() || startMs;
    const minMs = new Date(minDate).getTime();
    const maxMs = new Date(maxDate).getTime();
    const span = Math.max(maxMs - minMs, 1);
    const leftPct = Math.max(0, ((startMs - minMs) / span) * 100);
    const widthPct = Math.max(5, ((endMs - startMs) / span) * 100 || 5);
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500 mt-1">Calendar, list, and Gantt views for all project timelines.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? 'Edit Event' : 'Add Event'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Event' : 'Create Event'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, projectId: '' });
                          return;
                        }
                        setFormData({ ...formData, projectId: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: ScheduleEvent['type']) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="inspection">Inspection</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Input
                    value={formData.assignee}
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                    placeholder="Who is responsible?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Details, milestones, or notes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Site or meeting location"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingId(null); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Save Event'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Project" />
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="calendar">
                  <Calendar className="mr-2 h-4 w-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="mr-2 h-4 w-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="gantt">
                  <GanttChartSquare className="mr-2 h-4 w-4" />
                  Gantt
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : view === 'list' ? (
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">No events scheduled</p>
                  <p className="text-sm">Add events to see them here.</p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        <Badge variant={typeBadges[event.type].variant}>{typeBadges[event.type].label}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{event.projectName || 'No project'}</p>
                      <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-4 w-4" />
                          {formatDate(event.startDate)} - {formatDate(event.endDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {event.location || '—'}
                        </span>
                        <span>Assigned to: {event.assignee || 'Unassigned'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(event)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(event.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : view === 'gantt' ? (
            <div className="space-y-3">
              {ganttItems.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No timelines yet. Add events or set project dates.</div>
              ) : (
                ganttItems.map((item) => {
                  const bar = computeBar(item.start, item.end);
                  return (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm text-gray-700">
                        <div>
                          <div className="font-semibold text-gray-900">{item.label}</div>
                          <div className="text-xs text-gray-500">{item.projectName || 'No project'}</div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(item.start)} - {formatDate(item.end)}
                        </div>
                      </div>
                      <div className="mt-3 h-10 relative bg-gray-100 rounded-md overflow-hidden">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md bg-gradient-to-r from-blue-500 to-indigo-500 shadow-sm"
                          style={{ left: bar.left, width: bar.width }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold text-gray-800">Upcoming</span>
                </div>
                {filteredEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="font-semibold text-gray-900">{event.title}</div>
                      <div className="text-xs text-gray-500">
                        {event.projectName || 'No project'} • {formatDate(event.startDate)}
                      </div>
                    </div>
                    <Badge variant={typeBadges[event.type].variant}>{typeBadges[event.type].label}</Badge>
                  </div>
                ))}
                {filteredEvents.length === 0 && <div className="text-sm text-gray-500 py-4">No upcoming events</div>}
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold text-gray-800">Highlights</span>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Total events</span>
                    <span className="font-semibold">{filteredEvents.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Meetings</span>
                    <span className="font-semibold">{filteredEvents.filter(e => e.type === 'meeting').length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Inspections</span>
                    <span className="font-semibold">{filteredEvents.filter(e => e.type === 'inspection').length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Deliveries</span>
                    <span className="font-semibold">{filteredEvents.filter(e => e.type === 'delivery').length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SchedulePage;
