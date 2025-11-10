import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { ArrowLeft, Calendar, DollarSign, Users, FileText, Edit } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';

interface Project {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
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

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  dueDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface BudgetItem {
  id: string;
  projectId: string;
  category: string;
  description?: string;
  budgetedAmount: number;
  actualAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  id: string;
  projectId: string;
  name: string;
  type: string;
  category: string;
  fileKey?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiClient.get<{ project: Project }>(`/projects/${id}`),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: () => apiClient.get<{ tasks: Task[] }>(`/projects/${id}/tasks`),
  });

  const { data: budgetData } = useQuery({
    queryKey: ['project-budget', id],
    queryFn: () => apiClient.get<{ items: BudgetItem[]; summary: any }>(`/projects/${id}/budget`),
  });

  const { data: documentsData } = useQuery({
    queryKey: ['project-documents', id],
    queryFn: () => apiClient.get<{ documents: Document[] }>(`/projects/${id}/documents`),
  });

  const project = projectData?.project;
  const tasks = tasksData?.tasks || [];
  const budgetItems = budgetData?.items || [];
  const documents = documentsData?.documents || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Project not found</div>
      </div>
    );
  }

  const budgetProgress = project.estimatedBudget > 0
    ? (project.actualCost / project.estimatedBudget) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-500 mt-1">{project.description}</p>
          </div>
        </div>
        <Button>
          <Edit className="mr-2 h-4 w-4" />
          Edit Project
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="text-base">{project.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Budget Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{Math.round(budgetProgress)}%</div>
              <Progress value={budgetProgress} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="text-lg font-bold">{formatCurrency(project.estimatedBudget)}</div>
              <div className="text-sm text-gray-500">
                {formatCurrency(project.actualCost)} spent
              </div>
              <Progress value={budgetProgress} className="mt-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              {formatDate(project.startDate)}
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              {formatDate(project.endDate)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Location */}
      <Card>
        <CardHeader>
          <CardTitle>Project Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Project Type</p>
            <p className="font-medium capitalize">{project.type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Address</p>
            <p className="font-medium">{project.address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">City & State</p>
            <p className="font-medium">{project.city}, {project.state} {project.zipCode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">{formatDate(project.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="files">Files ({documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{project.description}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tasks</CardTitle>
                <Button size="sm">Add Task</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No tasks yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <Badge>{task.status}</Badge>
                        </TableCell>
                        <TableCell>{task.assignedTo || 'Unassigned'}</TableCell>
                        <TableCell>
                          <Badge variant={task.priority === 'HIGH' ? 'destructive' : 'secondary'}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.dueDate ? formatDate(task.dueDate) : 'No deadline'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Budgeted</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500">
                        No budget items yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    budgetItems.map((item) => {
                      const variance = item.budgetedAmount - item.actualAmount;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.category}</TableCell>
                          <TableCell>{formatCurrency(item.budgetedAmount)}</TableCell>
                          <TableCell>{formatCurrency(item.actualAmount)}</TableCell>
                          <TableCell className={variance < 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(Math.abs(variance))} {variance < 0 ? 'over' : 'under'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <Button size="sm">Upload File</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No documents yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{doc.category}</TableCell>
                        <TableCell>{doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'N/A'}</TableCell>
                        <TableCell>{doc.uploadedBy}</TableCell>
                        <TableCell>{formatDate(doc.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectDetailPage;
