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
import { useToast } from '../../components/ui/use-toast';
import { Plus, Users, Cloud, Camera } from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface DailyLog {
  id: string;
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

export function DailyLogsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    projectName: '',
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

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['daily-logs'],
    queryFn: () => apiClient.get<{ logs: DailyLog[] }>('/daily-logs'),
  });
  const logs = logsData?.logs || [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<DailyLog>) => apiClient.post('/daily-logs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      setIsCreateDialogOpen(false);
      setFormData({
        projectName: '',
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
      toast({
        title: 'Success',
        description: 'Daily log created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create daily log',
        variant: 'destructive',
      });
    },
  });

  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      crewSize: parseInt(formData.crewSize),
      hoursWorked: parseFloat(formData.hoursWorked),
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateLog}>
              <DialogHeader>
                <DialogTitle>Create Daily Log</DialogTitle>
                <DialogDescription>Record today's construction activities</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project</Label>
                    <Input
                      id="projectName"
                      name="projectName"
                      value={formData.projectName}
                      onChange={handleChange}
                      required
                    />
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
                    <Input
                      id="weather"
                      name="weather"
                      value={formData.weather}
                      onChange={handleChange}
                      placeholder="Sunny, Cloudy, Rainy"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      name="temperature"
                      value={formData.temperature}
                      onChange={handleChange}
                      placeholder="75°F"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workPerformed">Work Performed</Label>
                  <Input
                    id="workPerformed"
                    name="workPerformed"
                    value={formData.workPerformed}
                    onChange={handleChange}
                    placeholder="Describe work completed today"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crewSize">Crew Size</Label>
                    <Input
                      id="crewSize"
                      name="crewSize"
                      type="number"
                      value={formData.crewSize}
                      onChange={handleChange}
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
                      value={formData.hoursWorked}
                      onChange={handleChange}
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
                    placeholder="List equipment used"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialsReceived">Materials Received</Label>
                  <Input
                    id="materialsReceived"
                    name="materialsReceived"
                    value={formData.materialsReceived}
                    onChange={handleChange}
                    placeholder="List materials delivered"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Input
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any other notes or observations"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
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
      ) : (
        <div className="space-y-4">
          {logs?.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{log.projectName}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(log.date)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Cloud className="h-4 w-4" />
                      {log.weather}, {log.temperature}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Work Performed</h4>
                  <p className="text-sm text-gray-700">{log.workPerformed}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Users className="h-4 w-4" />
                      <span>Crew Size</span>
                    </div>
                    <p className="font-medium">{log.crewSize} workers</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Hours Worked</p>
                    <p className="font-medium">{log.hoursWorked} hours</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Camera className="h-4 w-4" />
                      <span>Photos</span>
                    </div>
                    <p className="font-medium">{log.photos || 0} photos</p>
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
                    <p className="text-sm text-gray-700">{log.notes}</p>
                  </div>
                )}
                <div className="pt-2 border-t text-xs text-gray-500">
                  Created by {log.createdBy}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default DailyLogsPage;
