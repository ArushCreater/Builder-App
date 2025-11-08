import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
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
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import { Plus, Search, Palette } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';

interface Selection {
  id: string;
  category: string;
  item: string;
  description: string;
  choice: string;
  cost: number;
  status: 'pending' | 'approved' | 'ordered' | 'installed';
  projectName: string;
  clientName: string;
  dueDate: string;
}

const statusColors = {
  'pending': 'warning',
  'approved': 'default',
  'ordered': 'default',
  'installed': 'success',
} as const;

export function SelectionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    item: '',
    description: '',
    choice: '',
    cost: '',
    projectName: '',
    clientName: '',
    dueDate: '',
  });

  const { data: selections, isLoading } = useQuery({
    queryKey: ['selections', searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      return apiClient.get<Selection[]>(`/selections?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Selection>) => apiClient.post('/selections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selections'] });
      setIsCreateDialogOpen(false);
      setFormData({
        category: '',
        item: '',
        description: '',
        choice: '',
        cost: '',
        projectName: '',
        clientName: '',
        dueDate: '',
      });
      toast({
        title: 'Success',
        description: 'Selection added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add selection',
        variant: 'destructive',
      });
    },
  });

  const handleCreateSelection = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      cost: parseFloat(formData.cost),
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
          <h1 className="text-3xl font-bold text-gray-900">Selections</h1>
          <p className="text-gray-500 mt-1">Track client selections and design choices</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Selection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateSelection}>
              <DialogHeader>
                <DialogTitle>Add New Selection</DialogTitle>
                <DialogDescription>Add a client selection item</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      placeholder="e.g., Flooring, Cabinets"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item">Item</Label>
                    <Input
                      id="item"
                      name="item"
                      value={formData.item}
                      onChange={handleChange}
                      required
                    />
                  </div>
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
                    <Label htmlFor="choice">Choice/Selection</Label>
                    <Input
                      id="choice"
                      name="choice"
                      value={formData.choice}
                      onChange={handleChange}
                      placeholder="Selected option"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost</Label>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
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
                    <Label htmlFor="clientName">Client</Label>
                    <Input
                      id="clientName"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Adding...' : 'Add Selection'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search selections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Choice</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selections?.map((selection) => (
                  <TableRow key={selection.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-gray-400" />
                        {selection.category}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{selection.item}</TableCell>
                    <TableCell>{selection.choice}</TableCell>
                    <TableCell>{selection.projectName}</TableCell>
                    <TableCell>{selection.clientName}</TableCell>
                    <TableCell>{formatCurrency(selection.cost)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[selection.status]}>
                        {selection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(selection.dueDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SelectionsPage;
