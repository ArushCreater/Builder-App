import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { FileText, Calendar, DollarSign, MessageSquare, Download } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';

interface ClientProject {
  id: string;
  name: string;
  status: string;
  progress: number;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  description: string;
}

interface ClientDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  url: string;
}

interface ClientInvoice {
  id: string;
  number: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  dueDate: string;
  issuedDate: string;
}

export function ClientPortalPage() {
  const { data: project, isLoading } = useQuery({
    queryKey: ['client-project'],
    queryFn: () => apiClient.get<ClientProject>('/client/project'),
  });

  const { data: documents } = useQuery({
    queryKey: ['client-documents'],
    queryFn: () => apiClient.get<ClientDocument[]>('/client/documents'),
  });

  const { data: invoices } = useQuery({
    queryKey: ['client-invoices'],
    queryFn: () => apiClient.get<ClientInvoice[]>('/client/invoices'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const budgetProgress = project ? (project.spent / project.budget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-500 mt-1">View your project status and information</p>
      </div>

      {/* Project Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{project?.name}</CardTitle>
              <p className="text-gray-500 mt-1">{project?.description}</p>
            </div>
            <Badge className="text-base">{project?.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Timeline</span>
              </div>
              <p className="font-medium">{project && formatDate(project.startDate)}</p>
              <p className="text-sm text-gray-500">to {project && formatDate(project.endDate)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Budget</span>
              </div>
              <p className="font-medium">{formatCurrency(project?.budget || 0)}</p>
              <p className="text-sm text-gray-500">
                {formatCurrency(project?.spent || 0)} spent
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <span className="text-sm">Progress</span>
              </div>
              <p className="font-medium text-2xl">{project?.progress}%</p>
              <Progress value={project?.progress || 0} className="mt-2" />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Budget Status</h4>
            <Progress value={budgetProgress} />
            <p className="text-sm text-gray-500 mt-1">
              {formatCurrency(project?.budget || 0 - (project?.spent || 0))} remaining
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents?.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{doc.type}</TableCell>
                      <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices?.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === 'paid'
                              ? 'success'
                              : invoice.status === 'pending'
                              ? 'warning'
                              : 'destructive'
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.issuedDate)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          Pay Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">No updates yet</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Your Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <h4 className="font-medium">Send a Message</h4>
                  <p className="text-sm text-gray-500 mb-3">
                    Have questions? Send a message to your project team
                  </p>
                  <Button>Send Message</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
