import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { supabase } from '../../lib/supabase';
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
import { Plus, Users, Cloud, Trash2, ImagePlus, X } from 'lucide-react';
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
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadDailyLogPhotos = async (projectName: string, files: File[]) => {
    if (!files.length) return { uploaded: 0, failed: 0 };
    const { data } = await supabase.auth.getSession();
    const authToken = data.session?.access_token;
    const safeName = (projectName || 'Unassigned').replace(/[\\\/\:\*\?"<>\|]/g, '-').trim() || 'Unassigned';
    const targetPath = `Images/${safeName}/Daily Logs`;
    let uploaded = 0; let failed = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('path', targetPath);
      try {
        const res = await fetch('/api/onedrive/upload', {
          method: 'POST',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          body: fd,
        });
        if (res.ok) uploaded++; else failed++;
      } catch { failed++; }
    }
    return { uploaded, failed };
  };

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const log = await apiClient.post('/daily-logs', data);
      // Upload pending images to OneDrive under Images/{projectName}/Daily Logs
      if (pendingImages.length) {
        setUploadingPhotos(true);
        try {
          const result = await uploadDailyLogPhotos(String(data.projectName), pendingImages);
          if (result.failed > 0) {
            toast({
              title: `Uploaded ${result.uploaded}/${pendingImages.length} photos`,
              description: `${result.failed} failed`,
              variant: 'destructive',
            });
          } else if (result.uploaded > 0) {
            toast({ title: `Uploaded ${result.uploaded} photo${result.uploaded === 1 ? '' : 's'}` });
          }
        } finally {
          setUploadingPhotos(false);
        }
      }
      return log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['onedrive-browse'] });
      queryClient.invalidateQueries({ queryKey: ['project-images'] });
      setIsCreateDialogOpen(false);
      setFormData(emptyForm());
      setPendingImages([]);
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Daily Logs</h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">Track daily construction activities</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) { setPendingImages([]); setFormData(emptyForm()); } }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <Label className="flex items-center gap-1.5">
                    <ImagePlus className="h-4 w-4" />
                    Photos
                  </Label>
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setPendingImages(prev => [...prev, ...files]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-xs text-slate-500">
                        {pendingImages.length
                          ? `${pendingImages.length} photo${pendingImages.length === 1 ? '' : 's'} ready to upload`
                          : 'Add photos — they get saved to OneDrive under this project\'s Images folder.'}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex-shrink-0 sm:w-auto"
                      >
                        <ImagePlus className="h-4 w-4 mr-1.5" /> Add photos
                      </Button>
                    </div>
                    {pendingImages.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {pendingImages.map((f, i) => {
                          const url = URL.createObjectURL(f);
                          return (
                            <div key={`${f.name}-${i}`} className="relative group rounded-md overflow-hidden border border-slate-200 bg-white aspect-square">
                              <img src={url} alt={f.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                              <button
                                type="button"
                                onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
                                aria-label="Remove"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] truncate">{f.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                <Button type="submit" disabled={createMutation.isPending || uploadingPhotos || !formData.projectId}>
                  {uploadingPhotos ? `Uploading ${pendingImages.length} photo${pendingImages.length === 1 ? '' : 's'}...` : createMutation.isPending ? 'Creating...' : 'Create Log'}
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
            <Card key={log.id} className="overflow-hidden rounded-2xl sm:rounded-lg">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{log.projectName}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(log.date)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    {(log.weather || log.temperature) && (
                      <div className="flex min-w-0 items-center gap-1 text-sm text-gray-500">
                        <Cloud className="h-4 w-4" />
                        <span className="truncate">{[log.weather, log.temperature].filter(Boolean).join(', ')}</span>
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
                <div className="grid grid-cols-2 gap-3 text-sm sm:gap-4">
                  <div className="rounded-xl bg-slate-50 p-3 sm:bg-transparent sm:p-0">
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Users className="h-4 w-4" />
                      <span>Crew</span>
                    </div>
                    <p className="font-medium">{log.crewSize} workers</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 sm:bg-transparent sm:p-0">
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
