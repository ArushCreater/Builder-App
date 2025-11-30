import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [localEvents, setLocalEvents] = useState<ScheduleEvent[]>([]);
  const ganttRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    mode: 'move' | 'start' | 'end';
    start: string;
    end: string;
    startX: number;
  } | null>(null);
  const CELL_WIDTH = 72; // px per day in the Gantt grid for predictable interaction and tighter view
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

  const updateDatesMutation = useMutation({
    mutationFn: (payload: { id: string; startDate: string; endDate: string }) =>
      apiClient.put(`/schedule/events/${payload.id}`, { startDate: payload.startDate, endDate: payload.endDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-events'] }),
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

  useEffect(() => {
    setLocalEvents(filteredEvents);
  }, [filteredEvents]);

  const minDate = useMemo(() => {
    if (!localEvents.length) return undefined;
    return localEvents.reduce(
      (min, ev) => (new Date(ev.startDate) < new Date(min) ? ev.startDate : min),
      localEvents[0].startDate
    );
  }, [localEvents]);

  const maxDate = useMemo(() => {
    if (!localEvents.length) return undefined;
    return localEvents.reduce(
      (max, ev) => (new Date(ev.endDate) > new Date(max) ? ev.endDate : max),
      localEvents[0].endDate
    );
  }, [localEvents]);

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
      ...localEvents.map(e => ({
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
  }, [localEvents, projects]);

  const timelineDays = useMemo(() => {
    if (!minDate || !maxDate) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      const end = new Date(today);
      end.setDate(today.getDate() + 30);
      const days: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d).toISOString().split('T')[0]);
      }
      return days;
    }
    const start = new Date(minDate);
    start.setDate(start.getDate() - 3);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 7);
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().split('T')[0]);
    }
    return days;
  }, [minDate, maxDate]);

  const computeBar = (start: string, end: string) => {
    const startIdx = timelineDays.findIndex(d => d === start);
    const endIdx = timelineDays.findIndex(d => d === end);
    const safeStart = startIdx >= 0 ? startIdx : 0;
    const safeEnd = endIdx >= 0 ? endIdx : safeStart;
    const left = safeStart;
    const width = Math.max(1, safeEnd - safeStart + 1);
    return { left, width };
  };

  const updateEventDates = (id: string, newStart: string, newEnd: string) => {
    setLocalEvents(prev =>
      prev.map(ev => (ev.id === id ? { ...ev, startDate: newStart, endDate: newEnd } : ev))
    );
    // Persist to backend (only for real schedule events, not derived tasks)
    if (!id.startsWith('task-') && !id.startsWith('proj-')) {
      updateDatesMutation.mutate({ id, startDate: newStart, endDate: newEnd });
    }
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragState || !ganttRef.current) return;
      const dayWidth = CELL_WIDTH;
      const deltaDays = Math.round((e.clientX - dragState.startX) / dayWidth);
      const origStart = new Date(dragState.start);
      const origEnd = new Date(dragState.end);
      if (dragState.mode === 'move') {
        const newStart = new Date(origStart);
        newStart.setDate(origStart.getDate() + deltaDays);
        const newEnd = new Date(origEnd);
        newEnd.setDate(origEnd.getDate() + deltaDays);
        updateEventDates(dragState.id, newStart.toISOString().split('T')[0], newEnd.toISOString().split('T')[0]);
      } else if (dragState.mode === 'start') {
        const newStart = new Date(origStart);
        newStart.setDate(origStart.getDate() + deltaDays);
        const newStartStr = newStart.toISOString().split('T')[0];
        updateEventDates(dragState.id, newStartStr, dragState.end);
      } else if (dragState.mode === 'end') {
        const newEnd = new Date(origEnd);
        newEnd.setDate(origEnd.getDate() + deltaDays);
        const newEndStr = newEnd.toISOString().split('T')[0];
        updateEventDates(dragState.id, dragState.start, newEndStr);
      }
    };
    const handleUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, timelineDays]);

  const handleBarMouseDown = (e: React.MouseEvent, id: string, mode: 'move' | 'start' | 'end', start: string, end: string) => {
    e.preventDefault();
    setDragState({ id, mode, start, end, startX: e.clientX });
  };

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const prefix = Array.from({ length: start.getDay() }, () => null);
    const days = Array.from({ length: end.getDate() }, (_, i) => new Date(year, month, i + 1));
    return [...prefix, ...days];
  }, [currentMonth]);

  const goMonth = (delta: number) => {
    const next = new Date(currentMonth);
    next.setMonth(currentMonth.getMonth() + delta);
    setCurrentMonth(next);
  };

  const eventsForDay = (dateStr: string) =>
    filteredEvents.filter(e => e.startDate === dateStr || e.endDate === dateStr);

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
            <div className="space-y-4 fade-in">
              {ganttItems.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No timelines yet. Add events or set project dates.</div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-md">
                  <div className="flex border-b border-gray-100 bg-gray-50 text-xs text-gray-600">
                    <div className="w-64 px-3 py-3 font-semibold">Item</div>
                    <div className="flex-1 overflow-x-auto">
                      <div className="min-w-[900px]">
                        <div className="grid" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, ${CELL_WIDTH}px)` }}>
                          {timelineDays.map((d) => (
                            <div key={d} className="px-2 py-2 text-center border-l border-gray-100 bg-white">
                              {new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-64 border-r border-gray-100 bg-white">
                      {ganttItems.map((item) => (
                        <div key={item.id} className="px-3 py-3 border-b border-gray-100">
                          <div className="font-semibold text-sm text-gray-900">{item.label}</div>
                          <div className="text-xs text-gray-500">{item.projectName || 'No project'}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 overflow-x-auto bg-white" ref={ganttRef}>
                      <div className="relative min-w-[900px]">
                        <div className="grid" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, ${CELL_WIDTH}px)` }}>
                          {timelineDays.map((d) => (
                            <div
                              key={d}
                              className="h-full border-l border-gray-100 last:border-r border-dashed border-gray-200"
                              onClick={(e) => {
                                const projectId = selectedProject !== 'all' ? selectedProject : '';
                                setFormData({
                                  ...formData,
                                  projectId,
                                  startDate: d,
                                  endDate: d,
                                });
                                setEditingId(null);
                                setIsDialogOpen(true);
                                e.stopPropagation();
                              }}
                            />
                          ))}
                        </div>
                        <div className="absolute inset-0 pointer-events-none">
                          {ganttItems.map((item, idx) => {
                            const bar = computeBar(item.start, item.end);
                            const top = idx * 64 + 10;
                            const today = new Date().toISOString().split('T')[0];
                            const todayIdx = timelineDays.findIndex(d => d === today);
                            return (
                              <div key={item.id} className="absolute left-0 right-0 slide-up" style={{ top }}>
                                <div
                                  className="absolute h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg flex items-center text-xs text-white px-3 gap-2 cursor-grab ring-1 ring-white/40"
                                  style={{
                                    left: `calc(${bar.left} * ${CELL_WIDTH}px)`,
                                    width: `calc(${bar.width} * ${CELL_WIDTH}px)`,
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                  }}
                                  onMouseDown={(e) => handleBarMouseDown(e, item.id, 'move', item.start, item.end)}
                                >
                                  <span className="font-semibold">{item.label}</span>
                                </div>
                                <div
                                  className="absolute h-10 w-2 bg-indigo-700 rounded-l cursor-ew-resize"
                                  style={{
                                    left: `calc(${bar.left} * ${CELL_WIDTH}px)`,
                                  }}
                                  onMouseDown={(e) => handleBarMouseDown(e, item.id, 'start', item.start, item.end)}
                                />
                                <div
                                  className="absolute h-10 w-2 bg-indigo-700 rounded-r cursor-ew-resize"
                                  style={{
                                    left: `calc(${bar.left + bar.width} * ${CELL_WIDTH}px - 8px)`,
                                  }}
                                  onMouseDown={(e) => handleBarMouseDown(e, item.id, 'end', item.start, item.end)}
                                />
                                {todayIdx >= 0 && (
                                  <div
                                    className="absolute top-[-8px] bottom-[-4px] w-[2px] bg-red-500"
                                    style={{ left: `calc(${todayIdx} * ${CELL_WIDTH}px)` }}
                                  >
                                    <div className="absolute -top-3 left-[-12px] text-[10px] text-red-600">Today</div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : view === 'calendar' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">
                  {currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => goMonth(-1)}>Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => goMonth(1)}>Next</Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="font-semibold">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {daysInMonth.map((day, idx) => {
                  if (!day) return <div key={`pad-${idx}`} />;
                  const dateStr = day.toISOString().split('T')[0];
                  const hasEvents = eventsForDay(dateStr).length > 0;
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`rounded-lg border p-2 text-left transition-all ${
                        isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">{day.getDate()}</span>
                        {hasEvents && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                      </div>
                      {hasEvents && (
                        <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                          {eventsForDay(dateStr).map(e => e.title).join(', ')}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {selectedDate ? `Events on ${formatDate(selectedDate)}` : 'Events'}
                </h3>
                <div className="space-y-3">
                  {eventsForDay(selectedDate).length === 0 && (
                    <div className="text-sm text-gray-500">No events for this day.</div>
                  )}
                  {eventsForDay(selectedDate).map(event => (
                    <div key={event.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-gray-900">{event.title}</div>
                        <Badge variant={typeBadges[event.type].variant}>{typeBadges[event.type].label}</Badge>
                      </div>
                      <div className="text-xs text-gray-500">{event.projectName || 'No project'}</div>
                      <div className="text-xs text-gray-600 mt-1">{event.description}</div>
                    </div>
                  ))}
                </div>
              </div>
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
