import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Calendar, List, Plus } from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface ScheduleEvent {
  id: string;
  title: string;
  projectName: string;
  start: string;
  end: string;
  type: 'task' | 'meeting' | 'inspection' | 'delivery';
  description: string;
  assignee: string;
}

export function SchedulePage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const { data: events, isLoading } = useQuery({
    queryKey: ['schedule', selectedProject],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedProject !== 'all') params.append('project', selectedProject);
      return apiClient.get<ScheduleEvent[]>(`/schedule?${params}`);
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => apiClient.get<Array<{ id: string; name: string }>>('/projects?fields=id,name'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500 mt-1">View and manage project schedules</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full sm:w-[250px]">
            <SelectValue placeholder="Select project" />
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

        <Tabs value={view} onValueChange={(v) => setView(v as 'calendar' | 'list')} className="flex-1">
          <TabsList>
            <TabsTrigger value="calendar">
              <Calendar className="mr-2 h-4 w-4" />
              Calendar View
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="mr-2 h-4 w-4" />
              List View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>Calendar view will be integrated with react-big-calendar</p>
                    <p className="text-sm mt-1">Showing {events?.length || 0} events</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Loading...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events?.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{event.title}</h3>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              {event.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{event.projectName}</p>
                          <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>
                              {formatDate(event.start)} - {formatDate(event.end)}
                            </span>
                            <span>Assigned to: {event.assignee}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
