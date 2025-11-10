import { useState } from 'react';
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
import { Plus, Search, Calendar, DollarSign, Users } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  progress: number;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  clientName: string;
  teamMembers: number;
  createdAt: string;
}

const statusColors = {
  planning: 'secondary',
  active: 'default',
  'on-hold': 'warning',
  completed: 'success',
  cancelled: 'destructive',
} as const;

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
    budget: '',
    startDate: '',
    endDate: '',
  });

  // TODO: Replace with real API calls when backend is ready
  // Using localStorage for demo mode
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', searchTerm, statusFilter],
    queryFn: () => {
      const stored = localStorage.getItem('demo_projects');
      let allProjects: Project[] = stored ? JSON.parse(stored) : [
        {
          id: '1',
          name: 'Residential Complex A',
          description: 'Modern residential building with 50 units',
          status: 'active',
          progress: 65,
          budget: 500000,
          spent: 325000,
          startDate: '2024-01-15',
          endDate: '2024-12-31',
          clientName: 'ABC Developers',
          teamMembers: 15,
          createdAt: '2024-01-01',
        },
        {
          id: '2',
          name: 'Commercial Building Renovation',
          description: 'Office space renovation and modernization',
          status: 'active',
          progress: 40,
          budget: 750000,
          spent: 300000,
          startDate: '2024-03-01',
          endDate: '2025-02-28',
          clientName: 'XYZ Corp',
          teamMembers: 20,
          createdAt: '2024-02-15',
        },
      ];

      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        allProjects = allProjects.filter(p =>
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.clientName.toLowerCase().includes(search)
        );
      }

      // Filter by status
      if (statusFilter !== 'all') {
        allProjects = allProjects.filter(p => p.status === statusFilter);
      }

      return Promise.resolve(allProjects);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Project>) => {
      const stored = localStorage.getItem('demo_projects');
      const existing: Project[] = stored ? JSON.parse(stored) : [];
      const newProject: Project = {
        id: Date.now().toString(),
        name: data.name || '',
        description: data.description || '',
        status: 'planning',
        progress: 0,
        budget: data.budget || 0,
        spent: 0,
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        clientName: data.clientName || '',
        teamMembers: 1,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('demo_projects', JSON.stringify([...existing, newProject]));
      return Promise.resolve(newProject);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        clientName: '',
        budget: '',
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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      budget: formData.budget ? parseFloat(formData.budget) : 0,
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
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget</Label>
                    <Input
                      id="budget"
                      name="budget"
                      type="number"
                      value={formData.budget}
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
                      required
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
                      required
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
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects?.map((project) => (
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
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-600">
                          <DollarSign className="h-4 w-4 mr-1" />
                          Budget
                        </div>
                        <span className="font-medium">
                          {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-600">
                          <Calendar className="h-4 w-4 mr-1" />
                          Deadline
                        </div>
                        <span className="font-medium">{formatDate(project.endDate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-600">
                          <Users className="h-4 w-4 mr-1" />
                          Team
                        </div>
                        <span className="font-medium">{project.teamMembers} members</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectsPage;
