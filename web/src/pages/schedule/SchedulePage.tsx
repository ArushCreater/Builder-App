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
import { Calendar as CalendarIcon, List, Plus, Clock3, MapPin, GanttChartSquare, Trash2, Edit, ChevronLeft, ChevronRight, Search, User, ZoomIn, ZoomOut, X } from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';
import { useToast } from '../../components/ui/use-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

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

const typeBadges: Record<ScheduleEvent['type'], { label: string; variant: 'secondary' | 'default' | 'warning' | 'destructive' | 'success' | 'outline' }> = {
  task: { label: 'Task', variant: 'secondary' },
  meeting: { label: 'Meeting', variant: 'default' },
  inspection: { label: 'Inspection', variant: 'warning' },
  delivery: { label: 'Delivery', variant: 'outline' },
};

const normalizeDate = (value?: string | null) => {
  if (!value) return '';
  return value.split('T')[0];
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const getDurationDays = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Math.max(1, Math.round((endTime - startTime) / DAY_IN_MS) + 1);
};

export function SchedulePage() {
  const [view, setView] = useState<'calendar' | 'list' | 'gantt'>('gantt');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
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
  
  // Configuration for Gantt View
  const [zoomLevel, setZoomLevel] = useState(1);
  const CELL_WIDTH = 100 * zoomLevel; // Significantly increased base width
  const ROW_HEIGHT = 64; // Taller rows
  const BAR_HEIGHT = 36; // Taller bars

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
  const projects = useMemo(
    () =>
      (projectsData?.projects || []).map(p => ({
        ...p,
        startDate: normalizeDate((p as any).startDate || (p as any).start_date || p.startDate) || '',
        endDate: normalizeDate((p as any).endDate || (p as any).end_date || p.endDate) || '',
      })),
    [projectsData?.projects]
  );
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
    const eventTaskIds = new Set(events.filter(e => e.type === 'task').map(e => e.id));
    const eventKeys = new Set(
      events.map(e => {
        const start = normalizeDate(e.startDate);
        const end = normalizeDate(e.endDate || e.startDate);
        return `${e.projectId || 'none'}|${(e.title || '').toLowerCase()}|${start}|${end}|${e.type}`;
      })
    );

    const taskEvents: ScheduleEvent[] = tasks
      .filter(t => !!t.dueDate)
      .filter(t => !eventTaskIds.has(t.id))
      .filter(t => {
        const start = normalizeDate(t.dueDate) || '';
        const key = `${t.projectId || 'none'}|${(t.title || '').toLowerCase()}|${start}|${start}|task`;
        return !eventKeys.has(key);
      })
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        projectName: t.projectName || 'No project',
        projectId: t.projectId,
        startDate: normalizeDate(t.dueDate) || '',
        endDate: normalizeDate(t.dueDate) || '',
        type: 'task',
        description: t.description || '',
        assignee: t.assignee || 'Unassigned',
        location: '',
      }));

    const merged = [...events, ...taskEvents].map(e => ({
      ...e,
      startDate: normalizeDate(e.startDate),
      endDate: normalizeDate(e.endDate) || normalizeDate(e.startDate),
    }));
    const filtered = merged.filter(e => {
      if (selectedProject !== 'all' && e.projectId !== selectedProject) return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
    return filtered.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [events, tasks, selectedProject, typeFilter, searchQuery]);

  useEffect(() => {
    setLocalEvents(filteredEvents);
  }, [filteredEvents]);

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

  type GanttItem = {
    id: string;
    label: string;
    projectName: string;
    start: string;
    end: string;
    type: ScheduleEvent['type'];
    assignee: string;
    isProject?: boolean;
  };

  const ganttItems: GanttItem[] = useMemo(() => {
    const projectItems: GanttItem[] = projects
      .filter(p => p.startDate && p.endDate)
      .map(p => ({
        id: `proj-${p.id}`,
        label: `${p.name} (Project)`,
        projectName: p.name,
        start: p.startDate!,
        end: p.endDate!,
        type: 'task' as ScheduleEvent['type'],
        assignee: '',
        isProject: true,
      }));

    const eventItems: GanttItem[] = localEvents.map(e => ({
      id: e.id,
      label: e.title,
      projectName: e.projectName,
      start: e.startDate,
      end: e.endDate,
      type: e.type,
      assignee: e.assignee,
    }));

    const sortByStart = (a: GanttItem, b: GanttItem) => (a.start || '').localeCompare(b.start || '');
    return [...projectItems.sort(sortByStart), ...eventItems.sort(sortByStart)];
  }, [localEvents, projects]);

  const minDate = useMemo(() => {
    const dated = ganttItems.filter(ev => ev.start && ev.end);
    if (!dated.length) return undefined;
    return dated.reduce((min, ev) => (new Date(ev.start) < new Date(min) ? ev.start : min), dated[0].start);
  }, [ganttItems]);

  const maxDate = useMemo(() => {
    const dated = ganttItems.filter(ev => ev.start && ev.end);
    if (!dated.length) return undefined;
    return dated.reduce((max, ev) => (new Date(ev.end) > new Date(max) ? ev.end : max), dated[0].end);
  }, [ganttItems]);

  const timelineDays = useMemo(() => {
    const today = new Date();
    const start = minDate ? new Date(minDate) : new Date(today);
    const end = maxDate ? new Date(maxDate) : new Date(today);
    
    start.setDate(start.getDate() - 5);
    end.setDate(end.getDate() + 14);

    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().split('T')[0]);
    }
    return days;
  }, [minDate, maxDate]);

  const timelineMonths = useMemo(() => {
    const months: { label: string; days: number; startIdx: number }[] = [];
    let currentMonth = '';
    let count = 0;
    
    timelineDays.forEach((day, idx) => {
      const d = new Date(day);
      const monthLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      if (monthLabel !== currentMonth) {
        if (currentMonth) {
          months.push({ label: currentMonth, days: count, startIdx: idx - count });
        }
        currentMonth = monthLabel;
        count = 1;
      } else {
        count++;
      }
    });
    if (currentMonth) {
      months.push({ label: currentMonth, days: count, startIdx: timelineDays.length - count });
    }
    return months;
  }, [timelineDays]);

  const computeBar = (start: string, end: string) => {
    const startIdx = timelineDays.findIndex(d => d === start);
    const endIdx = timelineDays.findIndex(d => d === end);
    const safeStart = startIdx >= 0 ? startIdx : 0;
    const safeEnd = endIdx >= 0 ? endIdx : safeStart;
    const left = safeStart;
    const width = Math.max(1, safeEnd - safeStart + 1);
    return { left, width };
  };

  const totalTimelineDays = Math.max(timelineDays.length, 1);

  const updateEventDates = (id: string, newStart: string, newEnd: string) => {
    setLocalEvents(prev =>
      prev.map(ev => (ev.id === id ? { ...ev, startDate: newStart, endDate: newEnd } : ev))
    );
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
  }, [dragState, timelineDays, CELL_WIDTH]);

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

  const eventsForDay = (dateStr: string | null) => {
    if (!dateStr) return [];
    return filteredEvents.filter(e => {
      const start = normalizeDate(e.startDate);
      const end = normalizeDate(e.endDate || e.startDate);
      if (!start || !dateStr) return false;
      return start <= dateStr && dateStr <= end;
    });
  };

  const getBarColor = (type: string, isProject: boolean) => {
      if (isProject) return 'bg-slate-800 border-slate-900 text-white';
      switch (type) {
        case 'meeting': return 'bg-emerald-500 border-emerald-600 text-white';
        case 'inspection': return 'bg-amber-500 border-amber-600 text-white';
        case 'delivery': return 'bg-purple-500 border-purple-600 text-white';
        default: return 'bg-blue-500 border-blue-600 text-white';
      }
  };

  const handleZoom = (direction: 'in' | 'out') => {
      if (direction === 'in') {
          setZoomLevel(prev => Math.min(prev + 0.2, 2.0));
      } else {
          setZoomLevel(prev => Math.max(prev - 0.2, 0.6));
      }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Schedule</h1>
          <p className="text-slate-500 mt-1">Manage project timelines and resource allocation.</p>
        </div>
        <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Event
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
                        placeholder="e.g., Foundation Pour"
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
                        <Label>Start Date</Label>
                        <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>End Date</Label>
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
      </div>

      <Card className="flex-1 flex flex-col shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full sm:w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search events..." 
                    className="pl-8 h-9" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-9 w-full sm:w-[180px]">
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
                <SelectTrigger className="h-9 w-full sm:w-[140px]">
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {view === 'gantt' && (
                    <div className="hidden items-center gap-1 rounded-md bg-slate-100 p-1 md:flex">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleZoom('out')}>
                            <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleZoom('in')}>
                            <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
                
                <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="rounded-md bg-slate-100 p-1">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-transparent sm:h-8 sm:w-auto sm:flex">
                    <TabsTrigger value="gantt" className="h-8 text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <GanttChartSquare className="mr-2 h-3.5 w-3.5" />
                    Gantt
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="h-8 text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    Calendar
                    </TabsTrigger>
                    <TabsTrigger value="list" className="h-8 text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <List className="mr-2 h-3.5 w-3.5" />
                    List
                    </TabsTrigger>
                </TabsList>
                </Tabs>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                  <p className="text-slate-500 text-sm">Loading schedule...</p>
              </div>
            </div>
          ) : view === 'list' ? (
            <div className="p-6 overflow-y-auto h-full space-y-3">
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    <CalendarIcon className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">No events found</h3>
                  <p className="text-slate-500 max-w-sm mt-1">
                    Try adjusting your filters or search terms, or add a new event to get started.
                  </p>
                  <Button className="mt-4" onClick={() => { setIsDialogOpen(true); setEditingId(null); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add Event
                  </Button>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="group flex items-center gap-4 p-4 border border-slate-100 rounded-lg hover:border-indigo-100 hover:bg-indigo-50/30 transition-all bg-white shadow-sm"
                  >
                    <div className={cn(
                        "h-12 w-12 rounded-lg flex items-center justify-center shrink-0",
                        event.type === 'meeting' ? 'bg-emerald-100 text-emerald-600' :
                        event.type === 'inspection' ? 'bg-amber-100 text-amber-600' :
                        event.type === 'delivery' ? 'bg-purple-100 text-purple-600' :
                        'bg-blue-100 text-blue-600'
                    )}>
                        {event.type === 'meeting' ? <User className="h-6 w-6" /> :
                         event.type === 'inspection' ? <Search className="h-6 w-6" /> :
                         event.type === 'delivery' ? <MapPin className="h-6 w-6" /> :
                         <Clock3 className="h-6 w-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 truncate">{event.title}</h3>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal border-slate-200">
                            {typeBadges[event.type].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5 font-medium text-slate-600">
                           {event.projectName || 'General Task'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          {formatDate(event.startDate)} {event.endDate !== event.startDate && `— ${formatDate(event.endDate)}`}
                        </span>
                        {event.assignee && (
                            <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {event.assignee}
                            </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => handleEdit(event)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete schedule item?"
                        description="This permanently removes the schedule item. This cannot be undone."
                        confirmText="Delete"
                        confirmVariant="destructive"
                        confirmDisabled={deleteMutation.isPending}
                        onConfirm={() => deleteMutation.mutate(event.id)}
                        trigger={
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : view === 'gantt' ? (
            <div className="flex flex-col h-full bg-slate-50/50">
              {ganttItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <p>No timeline data available.</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:hidden">
                    <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Timeline</p>
                          <p className="text-xs text-slate-500">
                            {minDate && maxDate ? `${formatDate(minDate)} - ${formatDate(maxDate)}` : 'Project schedule overview'}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                          {ganttItems.length} items
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {ganttItems.map((item) => {
                        const bar = computeBar(item.start, item.end);
                        const durationDays = getDurationDays(item.start, item.end);
                        const leftPercent = (bar.left / totalTimelineDays) * 100;
                        const widthPercent = Math.max((bar.width / totalTimelineDays) * 100, 8);
                        const isProject = Boolean(item.isProject);

                        return (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {isProject ? (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                      PROJ
                                    </Badge>
                                  ) : (
                                    <Badge variant={typeBadges[item.type].variant} className="h-5 px-1.5 text-[10px]">
                                      {typeBadges[item.type].label}
                                    </Badge>
                                  )}
                                  <h3 className="truncate text-sm font-semibold text-slate-900">{item.label}</h3>
                                </div>
                                <p className="mt-1 truncate text-xs text-slate-500">{item.projectName}</p>
                              </div>
                              {item.assignee && (
                                <Avatar className="h-8 w-8 shrink-0 border border-white shadow-sm">
                                  <AvatarFallback className="text-[11px] bg-indigo-100 text-indigo-700">
                                    {item.assignee.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>

                            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500">
                                <span>{formatDate(item.start)}</span>
                                <span>{durationDays} {durationDays === 1 ? 'day' : 'days'}</span>
                                <span>{formatDate(item.end)}</span>
                              </div>
                              <div className="relative h-3 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={cn(
                                    "absolute top-0 h-full rounded-full",
                                    isProject ? "bg-slate-800" :
                                    item.type === 'meeting' ? "bg-emerald-500" :
                                    item.type === 'inspection' ? "bg-amber-500" :
                                    item.type === 'delivery' ? "bg-purple-500" :
                                    "bg-blue-500"
                                  )}
                                  style={{
                                    left: `${leftPercent}%`,
                                    width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
                                    minWidth: '18px',
                                  }}
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              {item.assignee && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                  {item.assignee}
                                </span>
                              )}
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                {item.start === item.end ? 'Single-day item' : 'Scheduled range'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="hidden flex-1 overflow-hidden md:flex">
                  <div className="w-[300px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                    <div className="h-[80px] border-b border-slate-200 bg-slate-50/80 p-4 font-semibold text-sm text-slate-700 flex items-center">
                        Task Name
                    </div>
                    <div className="overflow-y-hidden flex-1"> 
                         <div className="flex flex-col">
                            {ganttItems.map((item) => (
                                <div 
                                    key={item.id} 
                                    className="border-b border-slate-100 px-4 flex items-center justify-between hover:bg-slate-50 group transition-colors"
                                    style={{ height: ROW_HEIGHT }}
                                >
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="font-medium text-sm text-slate-900 truncate flex items-center gap-2">
                                            {item.isProject && <Badge variant="secondary" className="h-4 px-1 text-[10px]">PROJ</Badge>}
                                            {item.label}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate">
                                            {item.projectName}
                                        </div>
                                    </div>
                                    {item.assignee && (
                                        <Avatar className="h-6 w-6 border border-white shadow-sm">
                                            <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                                {item.assignee.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                         </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto bg-white" ref={ganttRef}>
                    <div className="min-w-max">
                        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 h-[80px]">
                            <div className="flex h-1/2 border-b border-slate-100">
                                {timelineMonths.map((month, i) => (
                                    <div 
                                        key={i} 
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50 border-r border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis"
                                        style={{ width: month.days * CELL_WIDTH }}
                                    >
                                        {month.label}
                                    </div>
                                ))}
                            </div>
                            <div className="flex h-1/2">
                                {timelineDays.map((d) => {
                                    const date = new Date(d);
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                    const isToday = d === new Date().toISOString().split('T')[0];
                                    return (
                                        <div 
                                            key={d} 
                                            className={cn(
                                                "flex-shrink-0 border-r border-slate-100 text-[10px] flex flex-col items-center justify-center font-medium",
                                                isWeekend ? "bg-slate-50 text-slate-400" : "text-slate-600",
                                                isToday ? "bg-indigo-50/50 text-indigo-600 font-bold" : ""
                                            )}
                                            style={{ width: CELL_WIDTH }}
                                        >
                                            <span className="opacity-50 text-[9px] uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                            <span>{date.getDate()}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex pointer-events-none">
                                {timelineDays.map((d) => {
                                    const date = new Date(d);
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                    const isToday = d === new Date().toISOString().split('T')[0];
                                    return (
                                        <div 
                                            key={d} 
                                            className={cn(
                                                "h-full border-r border-slate-100 flex-shrink-0",
                                                isWeekend ? "bg-slate-50/40" : "",
                                                isToday ? "bg-indigo-50/30" : ""
                                            )}
                                            style={{ width: CELL_WIDTH }}
                                        />
                                    );
                                })}
                            </div>

                            <div className="relative">
                                {ganttItems.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="border-b border-slate-100 w-full relative group hover:bg-slate-50/50 transition-colors"
                                        style={{ height: ROW_HEIGHT }}
                                    />
                                ))}

                                <div className="absolute inset-0 pointer-events-none">
                                    {ganttItems.map((item, idx) => {
                                        const bar = computeBar(item.start, item.end);
                                        const top = idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
                                        const height = BAR_HEIGHT;
                                        
                                        const isProject = (item as any).isProject;
                                        const barColorClass = getBarColor(item.type, isProject);

                                        return (
                                            <div key={item.id} className="absolute left-0 right-0 pointer-events-auto" style={{ top, height }}>
                                                <div
                                                    className={cn(
                                                        "absolute rounded-md shadow-sm border text-[11px] text-white px-3 flex items-center gap-2 cursor-grab select-none hover:shadow-md transition-shadow overflow-hidden whitespace-nowrap",
                                                        barColorClass
                                                    )}
                                                    style={{
                                                        left: `calc(${bar.left} * ${CELL_WIDTH}px + 4px)`,
                                                        width: `calc(${bar.width} * ${CELL_WIDTH}px - 8px)`,
                                                        height: '100%'
                                                    }}
                                                    onMouseDown={(e) => handleBarMouseDown(e, item.id, 'move', item.start, item.end)}
                                                    title={`${item.label} (${item.start} - ${item.end})`}
                                                >
                                                    <span className="font-medium truncate flex-1 text-sm">{item.label}</span>
                                                </div>
                                                
                                                {!isProject && (
                                                    <>
                                                        <div
                                                            className="absolute w-2 h-full cursor-w-resize z-10 hover:bg-white/20 rounded-l-md"
                                                            style={{ left: `calc(${bar.left} * ${CELL_WIDTH}px + 4px)` }}
                                                            onMouseDown={(e) => handleBarMouseDown(e, item.id, 'start', item.start, item.end)}
                                                        />
                                                        <div
                                                            className="absolute w-2 h-full cursor-e-resize z-10 hover:bg-white/20 rounded-r-md"
                                                            style={{ left: `calc(${bar.left + bar.width} * ${CELL_WIDTH}px - 12px)` }}
                                                            onMouseDown={(e) => handleBarMouseDown(e, item.id, 'end', item.start, item.end)}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {(() => {
                                        const today = new Date().toISOString().split('T')[0];
                                        const todayIdx = timelineDays.findIndex(d => d === today);
                                        if (todayIdx >= 0) {
                                            return (
                                                <div 
                                                    className="absolute top-0 bottom-0 border-l-2 border-red-500 z-30 pointer-events-none opacity-60"
                                                    style={{ left: `calc(${todayIdx} * ${CELL_WIDTH}px + ${CELL_WIDTH/2}px)` }}
                                                >
                                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-slate-800">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goMonth(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goMonth(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date().toISOString().split('T')[0]); }}>
                  Today
                </Button>
              </div>
              
              <div className="flex flex-col flex-1 gap-6">
                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden flex-1 shadow-sm min-h-[400px]">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="bg-slate-50 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {d}
                    </div>
                    ))}
                    
                    {daysInMonth.map((day, idx) => {
                    if (!day) return <div key={`pad-${idx}`} className="bg-white min-h-[80px]" />;
                    const dateStr = day.toISOString().split('T')[0];
                    const dayEvents = eventsForDay(dateStr);
                    const isSelected = selectedDate === dateStr;
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    
                    return (
                        <div
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={cn(
                            "bg-white p-2 min-h-[80px] transition-colors cursor-pointer hover:bg-slate-50 flex flex-col gap-1",
                            isSelected && "ring-2 ring-indigo-500 ring-inset z-10",
                            isToday && "bg-indigo-50/30"
                        )}
                        >
                        <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                                "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                                isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                            )}>
                                {day.getDate()}
                            </span>
                            {dayEvents.length > 0 && (
                                <span className="text-[10px] font-medium text-slate-400">
                                    {dayEvents.length}
                                </span>
                            )}
                        </div>
                        
                        <div className="space-y-1 overflow-y-auto max-h-[60px] custom-scrollbar">
                            {dayEvents.slice(0, 3).map((e) => (
                                <div 
                                    key={e.id} 
                                    className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded truncate border border-transparent",
                                        e.type === 'meeting' ? "bg-emerald-100 text-emerald-700" :
                                        e.type === 'inspection' ? "bg-amber-100 text-amber-700" :
                                        e.type === 'delivery' ? "bg-purple-100 text-purple-700" :
                                        "bg-blue-100 text-blue-700"
                                    )}
                                    title={e.title}
                                >
                                    {e.title}
                                </div>
                            ))}
                        </div>
                        </div>
                    );
                    })}
                </div>

                {selectedDate && (
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">
                                Events on {formatDate(selectedDate)}
                            </h3>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        {eventsForDay(selectedDate).length === 0 ? (
                            <div className="text-slate-500 text-sm py-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                                No events scheduled for this day
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {eventsForDay(selectedDate).map((event) => (
                                    <div 
                                        key={event.id}
                                        className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col gap-2 hover:border-indigo-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-slate-900 truncate">{event.title}</span>
                                            <Badge variant={typeBadges[event.type].variant} className="text-[10px] h-5">
                                                {typeBadges[event.type].label}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-500 flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <Clock3 className="h-3 w-3" />
                                                <span>{formatDate(event.startDate)} - {formatDate(event.endDate)}</span>
                                            </div>
                                            {event.location && (
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3 w-3" />
                                                    <span>{event.location}</span>
                                                </div>
                                            )}
                                            {event.assignee && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <User className="h-3 w-3" />
                                                    <span>{event.assignee}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SchedulePage;
