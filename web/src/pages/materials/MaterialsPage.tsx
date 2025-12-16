import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import ConfirmDialog from '../../components/ConfirmDialog';
import { Plus, Search, Package, AlertTriangle, Trash2, Edit, Truck } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface Material {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  supplier: string;
  projectId?: string;
  projectName: string;
  status: 'ordered' | 'in-stock' | 'low-stock' | 'out-of-stock';
}

const statusColors = {
  'ordered': 'default',
  'in-stock': 'success',
  'low-stock': 'warning',
  'out-of-stock': 'destructive',
} as const;

export function MaterialsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quantity: '',
    unit: '',
    costPerUnit: '',
    supplier: '',
    projectId: '',
    projectName: '',
    status: 'ordered' as Material['status'],
  });

  const { data: materialsData, isLoading } = useQuery({
    queryKey: ['materials', searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ materials: Material[] }>(`/materials?${params}`);
    },
  });
  const materials = useMemo(
    () =>
      (materialsData?.materials || []).map((m: any) => ({
        ...m,
        projectId: m.projectId || m.project_id || '',
        projectName: m.projectName || m.project_name || '',
        costPerUnit: Number(m.costPerUnit ?? m.cost_per_unit ?? 0),
        totalCost:
          Number(m.totalCost ?? m.total_cost ?? 0) ||
          (Number(m.quantity ?? 0) * Number(m.costPerUnit ?? m.cost_per_unit ?? 0)),
        quantity: Number(m.quantity ?? 0),
      })),
    [materialsData?.materials]
  );

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'materials'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Material>) => apiClient.post('/materials', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        quantity: '',
        unit: '',
        costPerUnit: '',
        supplier: '',
        projectId: '',
        projectName: '',
        status: 'ordered',
      });
      toast({
        title: 'Success',
        description: 'Material added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add material',
        variant: 'destructive',
      });
    },
  });

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      quantity: parseFloat(formData.quantity),
      costPerUnit: parseFloat(formData.costPerUnit),
      totalCost: parseFloat(formData.quantity) * parseFloat(formData.costPerUnit),
      projectId: formData.projectId || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<Material> }) =>
      apiClient.put(`/materials/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsCreateDialogOpen(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        quantity: '',
        unit: '',
        costPerUnit: '',
        supplier: '',
        projectId: '',
        projectName: '',
        status: 'ordered',
      });
      toast({ title: 'Updated', description: 'Material updated successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Update failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: 'Deleted', description: 'Material removed' });
    },
    onError: () => toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' }),
  });

  const handleEdit = (material: Material) => {
    setEditingId(material.id);
    setFormData({
      name: material.name,
      description: material.description,
      quantity: material.quantity.toString(),
      unit: material.unit,
      costPerUnit: material.costPerUnit.toString(),
      supplier: material.supplier,
      projectId: material.projectId || '',
      projectName: material.projectName,
      status: material.status,
    });
    setIsCreateDialogOpen(true);
  };

  const lowStock = materials.filter(m => m.status === 'low-stock' || m.quantity <= 2);
  const totalValue = materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const orderedCount = materials.filter(m => m.status === 'ordered').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Materials</h1>
          <p className="text-gray-500 mt-1">Manage construction materials and inventory</p>
        </div>
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setFormData({
                name: '',
                description: '',
                quantity: '',
                unit: '',
                costPerUnit: '',
                supplier: '',
                projectId: '',
                projectName: '',
                status: 'ordered',
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? 'Edit Material' : 'Add Material'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateMaterial}>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Material' : 'Add New Material'}</DialogTitle>
                <DialogDescription>Add materials to your inventory</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Material Name</Label>
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      placeholder="e.g., sq ft, lbs"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPerUnit">Cost Per Unit</Label>
                    <Input
                      id="costPerUnit"
                      name="costPerUnit"
                      type="number"
                      step="0.01"
                      value={formData.costPerUnit}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Input
                      id="supplier"
                      name="supplier"
                      value={formData.supplier}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project</Label>
                    <Select
                      value={formData.projectId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, projectId: '', projectName: '' });
                          return;
                        }
                        const proj = projectsData?.projects.find(p => p.id === value);
                        setFormData({ ...formData, projectId: value, projectName: proj?.name || '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projectsData?.projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Material['status']) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="in-stock">In Stock</SelectItem>
                      <SelectItem value="low-stock">Low Stock</SelectItem>
                      <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editingId ? updateMutation.isPending : createMutation.isPending}>
                  {editingId
                    ? updateMutation.isPending
                      ? 'Saving...'
                      : 'Save Changes'
                    : createMutation.isPending
                      ? 'Adding...'
                      : 'Add Material'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-gray-500">{materials.length} items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Orders in transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderedCount}</div>
            <p className="text-xs text-gray-500">Awaiting delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStock.length}</div>
            <p className="text-xs text-gray-500">Needs reorder</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsData?.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  <TableHead>Material</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Cost Per Unit</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials?.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{material.name}</div>
                          <div className="text-sm text-gray-500">{material.description}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {material.status === 'low-stock' && (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        {material.quantity} {material.unit}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(material.costPerUnit)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(material.totalCost)}</TableCell>
                    <TableCell>{material.supplier}</TableCell>
                    <TableCell>{material.projectName || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[material.status as Material['status']]}>
                        {material.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            updateMutation.mutate({
                              id: material.id,
                              data: { status: material.status === 'ordered' ? 'in-stock' : 'ordered' },
                            })
                          }
                          title="Toggle ordered"
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(material)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title="Delete material?"
                          description="This permanently removes the material. This cannot be undone."
                          confirmText="Delete"
                          confirmVariant="destructive"
                          confirmDisabled={deleteMutation.isPending}
                          onConfirm={() => deleteMutation.mutate(material.id)}
                          trigger={
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
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

export default MaterialsPage;
