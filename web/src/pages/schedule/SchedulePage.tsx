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

  // Fetch projects with their tasks to build schedule
  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-schedule'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects'),
  });

  const projects = projectsData?.projects || [];

  // For now, schedule is derived from project data
  // In the future, this will be a dedicated schedule/calendar endpoint
  const events: ScheduleEvent[] = [];
  const isLoading = false;

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
                    <p className="font-medium">Schedule & Calendar Feature</p>
                    <p className="text-sm mt-2">This feature will display project timelines, tasks, and milestones</p>
                    <p className="text-sm mt-1">Integrated calendar coming soon</p>
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
                ) : events.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-center">
                    <div className="text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="font-medium">No Scheduled Events</p>
                      <p className="text-sm mt-2">Schedule feature will show upcoming tasks,</p>
                      <p className="text-sm">meetings, inspections, and deliveries</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event) => (
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

export default SchedulePage;
