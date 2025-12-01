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
import { Badge } from '../../components/ui/badge';
import { Plus, Search, Hammer, Edit, Trash2 } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import {
  Dialog,
  DialogContent,
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

interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'available' | 'in-use' | 'maintenance' | 'retired';
  location: string;
  assignedTo?: string;
  purchaseDate: string;
  purchasePrice: number;
  lastMaintenance?: string;
  nextMaintenance?: string;
  projectId?: string;
  projectName?: string;
}

const statusColors = {
  'available': 'success',
  'in-use': 'default',
  'maintenance': 'warning',
  'retired': 'secondary',
} as const;

export function EquipmentPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    status: 'available' as Equipment['status'],
    location: '',
    assignedTo: '',
    projectId: '',
    projectName: '',
    purchaseDate: '',
    purchasePrice: '',
    lastMaintenance: '',
    nextMaintenance: '',
  });

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', searchTerm, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      return apiClient.get<{ equipment: Equipment[] }>(`/equipment?${params}`);
    },
  });
  const equipmentRows = useMemo(
    () =>
      (equipment?.equipment || []).map((e: any) => ({
        ...e,
        projectId: e.projectId || e.project_id || '',
        projectName: e.projectName || e.project_name || '',
        purchaseDate: e.purchaseDate || e.purchase_date || '',
        purchasePrice: Number(e.purchasePrice ?? e.purchase_price ?? 0),
        lastMaintenance: e.lastMaintenance || e.last_service || '',
        nextMaintenance: e.nextMaintenance || e.next_maintenance || '',
        status: e.status || 'available',
      })),
    [equipment?.equipment]
  );
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'equipment'],
    queryFn: () => apiClient.get<{ projects: Array<{ id: string; name: string }> }>('/projects'),
  });

  const filtered = useMemo(() => equipmentRows, [equipmentRows]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Equipment>) => apiClient.post('/equipment', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({
        name: '',
        type: '',
        status: 'available',
        location: '',
        assignedTo: '',
        projectId: '',
        projectName: '',
        purchaseDate: '',
        purchasePrice: '',
        lastMaintenance: '',
        nextMaintenance: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<Equipment> }) =>
      apiClient.put(`/equipment/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/equipment/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const project = formData.projectId ? projectsData?.projects.find(p => p.id === formData.projectId) : undefined;
    const payload = {
      ...formData,
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      projectId: formData.projectId || undefined,
      projectName: formData.projectName || project?.name || '',
      purchaseDate: formData.purchaseDate || undefined,
      lastMaintenance: formData.lastMaintenance || undefined,
      nextMaintenance: formData.nextMaintenance || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (item: Equipment) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      type: item.type,
      status: item.status,
      location: item.location,
      assignedTo: item.assignedTo || '',
      projectId: item.projectId || '',
      projectName: item.projectName || '',
      purchaseDate: item.purchaseDate,
      purchasePrice: item.purchasePrice.toString(),
      lastMaintenance: item.lastMaintenance || '',
      nextMaintenance: item.nextMaintenance || '',
    });
    setIsDialogOpen(true);
  };

  const totalValue = filtered.reduce((sum, e) => sum + (e.purchasePrice || 0), 0);
  const inUse = filtered.filter(e => e.status === 'in-use').length;
  const maintenance = filtered.filter(e => e.status === 'maintenance').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipment</h1>
          <p className="text-gray-500 mt-1">Track construction equipment and tools</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? 'Edit Equipment' : 'Add Equipment'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Input
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      placeholder="Heavy, Lift, Tool..."
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: Equipment['status']) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="in-use">In Use</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project (optional)</Label>
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
                        <SelectValue placeholder="Assign to project" />
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <Input
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="Person/team"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Purchase Date</Label>
                    <Input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <Input
                      type="number"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Last Maintenance</Label>
                    <Input
                      type="date"
                      value={formData.lastMaintenance}
                      onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Next Maintenance</Label>
                    <Input
                      type="date"
                      value={formData.nextMaintenance}
                      onChange={(e) => setFormData({ ...formData, nextMaintenance: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Add Equipment'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Fleet Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-gray-500">{filtered.length} assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">In Use</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inUse}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{maintenance}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search equipment..."
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in-use">In Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
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
                  <TableHead>Equipment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Next Maintenance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Hammer className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-500">
                            {formatCurrency(item.purchasePrice)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[item.status as Equipment['status']]}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.location}</TableCell>
                    <TableCell>{item.assignedTo || '-'}</TableCell>
                    <TableCell>{item.projectName || '-'}</TableCell>
                    <TableCell>{item.purchaseDate ? formatDate(item.purchaseDate) : '-'}</TableCell>
                    <TableCell>
                      {item.nextMaintenance ? formatDate(item.nextMaintenance) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Select
                          value={item.status}
                          onValueChange={(value) =>
                            updateMutation.mutate({ id: item.id, data: { status: value as Equipment['status'] } })
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="in-use">In Use</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
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

export default EquipmentPage;

