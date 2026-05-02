import { useState } from 'react';
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
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useToast } from '../../components/ui/use-toast';
import { Plus, Users, Cloud, Trash2 } from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface DailyLog {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  weather: string;
  temperature: string;
  workPerformed: string;
  crewSize: number;
  hoursWorked: number;
  equipmentUsed: string;
  materialsReceived: string;
  notes: string;
  photos: number;
  createdBy: string;
}

interface Project {
  id: string;
  name: string;
}

const WEATHER_OPTIONS = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Windy', 'Snowy', 'Foggy'];

const emptyForm = () => ({
  projectId: '',
  date: new Date().toISOString().split('T')[0],
  weather: '',
  temperature: '',
  workPerformed: '',
  crewSize: '',
  hoursWorked: '',
  equipmentUsed: '',
  materialsReceived: '',
  notes: '',
});

export function DailyLogsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm());

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['daily-logs'],
    queryFn: () => apiClient.get<{ logs: DailyLog[] }>('/daily-logs'),
  });
  const logs = logsData?.logs || [];

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get<{ projects: Project[] }>('/projects'),
  });
  const projects = projectsData?.projects || [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/daily-logs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      setIsCreateDialogOpen(false);
      setFormData(emptyForm());
      toast({ title: 'Daily log created' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create log', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/daily-logs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      setDeletingId(null);
      toast({ title: 'Log deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete log', variant: 'destructive' });
    },
  });

  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProject = projects.find(p => p.id === formData.projectId);
    createMutation.mutate({
      projectId: formData.projectId,
      projectName: selectedProject?.name || formData.projectId,
      date: formData.date,
      weather: formData.weather,
      temperature: formData.temperature,
      workPerformed: formData.workPerformed,
      crewSize: parseInt(formData.crewSize) || 0,
      hoursWorked: parseFloat(formData.hoursWorked) || 0,
      equipmentUsed: formData.equipmentUsed,
      materialsReceived: formData.materialsReceived,
      notes: formData.notes,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Logs</h1>
          <p className="text-gray-500 mt-1">Track daily construction activities</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Log Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateLog}>
              <DialogHeader>
                <DialogTitle>Create Daily Log</DialogTitle>
                <DialogDescription>Record today's construction activities</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectId">Project</Label>
                    <Select
                      value={formData.projectId}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, projectId: v }))}
                    >
                      <SelectTrigger id="projectId">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      value={formData.date}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weather">Weather</Label>
                    <Select
                      value={formData.weather}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, weather: v }))}
                    >
                      <SelectTrigger id="weather">
                        <SelectValue placeholder="Select weather" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEATHER_OPTIONS.map(w => (
                          <SelectItem key={w} value={w}>{w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      name="temperature"
                      value={formData.temperature}
                      onChange={handleChange}
                      placeholder="e.g. 75°F"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workPerformed">Work Performed</Label>
                  <textarea
                    id="workPerformed"
                    name="workPerformed"
                    value={formData.workPerformed}
                    onChange={handleChange}
                    placeholder="Describe work completed today"
                    rows={3}
                    required
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crewSize">Crew Size</Label>
                    <Input
                      id="crewSize"
                      name="crewSize"
                      type="number"
                      min="0"
                      value={formData.crewSize}
                      onChange={handleChange}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hoursWorked">Hours Worked</Label>
                    <Input
                      id="hoursWorked"
                      name="hoursWorked"
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.hoursWorked}
                      onChange={handleChange}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="equipmentUsed">Equipment Used</Label>
                  <Input
                    id="equipmentUsed"
                    name="equipmentUsed"
                    value={formData.equipmentUsed}
                    onChange={handleChange}
                    placeholder="e.g. Excavator, Crane"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="materialsReceived">Materials Received</Label>
                  <Input
                    id="materialsReceived"
                    name="materialsReceived"
                    value={formData.materialsReceived}
                    onChange={handleChange}
                    placeholder="e.g. 50 bags cement, steel rebar"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any other observations or notes"
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || !formData.projectId}>
                  {createMutation.isPending ? 'Creating...' : 'Create Log'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-gray-400 text-lg font-medium">No daily logs yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "New Log Entry" to record today's activities</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{log.projectName}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(log.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {(log.weather || log.temperature) && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Cloud className="h-4 w-4" />
                        {[log.weather, log.temperature].filter(Boolean).join(', ')}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500"
                      disabled={deletingId === log.id}
                      onClick={() => {
                        setDeletingId(log.id);
                        deleteMutation.mutate(log.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Work Performed</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.workPerformed}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Users className="h-4 w-4" />
                      <span>Crew</span>
                    </div>
                    <p className="font-medium">{log.crewSize} workers</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Hours Worked</p>
                    <p className="font-medium">{log.hoursWorked} hrs</p>
                  </div>
                </div>
                {log.equipmentUsed && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Equipment Used</h4>
                    <p className="text-sm text-gray-700">{log.equipmentUsed}</p>
                  </div>
                )}
                {log.materialsReceived && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Materials Received</h4>
                    <p className="text-sm text-gray-700">{log.materialsReceived}</p>
                  </div>
                )}
                {log.notes && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.notes}</p>
                  </div>
                )}
                {log.createdBy && (
                  <div className="pt-2 border-t text-xs text-gray-400">
                    Created by {log.createdBy}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default DailyLogsPage;
