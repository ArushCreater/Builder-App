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
  description?: string;
  type: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  startDate?: string;
  endDate?: string;
  estimatedBudget: number;
  actualCost: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

const statusColors = {
  PLANNING: 'secondary',
  IN_PROGRESS: 'default',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
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
    type: 'residential',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    estimatedBudget: '',
    startDate: '',
    endDate: '',
  });

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', searchTerm, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      return apiClient.get<{ projects: Project[] }>(`/projects?${params}`);
    },
  });

  const projects = projectsData?.projects || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post<{ project: Project }>('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] });
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        type: 'residential',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        estimatedBudget: '',
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
      name: formData.name,
      description: formData.description,
      type: formData.type,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zipCode: formData.zipCode,
      estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : 0,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
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
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Project Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="renovation">Renovation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedBudget">Estimated Budget</Label>
                    <Input
                      id="estimatedBudget"
                      name="estimatedBudget"
                      type="number"
                      value={formData.estimatedBudget}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
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
                <SelectItem value="PLANNING">Planning</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
                        <span className="text-gray-600">Budget Used</span>
                        <span className="font-medium">
                          {project.estimatedBudget > 0
                            ? Math.round((project.actualCost / project.estimatedBudget) * 100)
                            : 0}%
                        </span>
                      </div>
                      <Progress
                        value={project.estimatedBudget > 0
                          ? (project.actualCost / project.estimatedBudget) * 100
                          : 0}
                      />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-600">
                          <DollarSign className="h-4 w-4 mr-1" />
                          Budget
                        </div>
                        <span className="font-medium">
                          {formatCurrency(project.actualCost)} / {formatCurrency(project.estimatedBudget)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-600">
                          <Calendar className="h-4 w-4 mr-1" />
                          Location
                        </div>
                        <span className="font-medium text-right">{project.city}, {project.state}</span>
                      </div>
                      {project.endDate && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-gray-600">
                            <Calendar className="h-4 w-4 mr-1" />
                            Deadline
                          </div>
                          <span className="font-medium">{formatDate(project.endDate)}</span>
                        </div>
                      )}
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
