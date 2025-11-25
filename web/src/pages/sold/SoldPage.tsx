import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Search, Plus, DollarSign, Home, TrendingUp, Clock3 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';

type SaleStatus = 'pending' | 'closed' | 'handoff';

interface SoldRecord {
  id: string;
  projectName: string;
  buyer: string;
  salePrice: number;
  profit: number;
  closeDate: string;
  status: SaleStatus;
  handoffNotes?: string;
  address?: string;
}

const statusVariants: Record<SaleStatus, 'secondary' | 'default' | 'success'> = {
  pending: 'secondary',
  closed: 'default',
  handoff: 'success',
};

export function SoldPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SaleStatus>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    projectName: '',
    buyer: '',
    salePrice: '',
    profit: '',
    closeDate: '',
    status: 'pending' as SaleStatus,
    handoffNotes: '',
    address: '',
  });

  const [records, setRecords] = useState<SoldRecord[]>([
    {
      id: 's-1',
      projectName: 'Sunrise Apartments',
      buyer: 'Acme Holdings',
      salePrice: 2200000,
      profit: 450000,
      closeDate: '2024-09-15',
      status: 'handoff',
      address: '12 Main St, Sydney',
      handoffNotes: 'Handover to client facilities team.',
    },
    {
      id: 's-2',
      projectName: 'Downtown Office',
      buyer: 'Beta Property Group',
      salePrice: 4150000,
      profit: 780000,
      closeDate: '2024-11-01',
      status: 'pending',
      address: '200 George St, Sydney',
    },
  ]);

  const filtered = useMemo(() => {
    let list = [...records];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        r =>
          r.projectName.toLowerCase().includes(q) ||
          r.buyer.toLowerCase().includes(q) ||
          (r.address || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }
    return list;
  }, [records, search, statusFilter]);

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, r) => sum + (r.salePrice || 0), 0);
    const profit = filtered.reduce((sum, r) => sum + (r.profit || 0), 0);
    return { total, profit };
  }, [filtered]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rec: SoldRecord = {
      id: crypto.randomUUID(),
      projectName: form.projectName,
      buyer: form.buyer,
      salePrice: parseFloat(form.salePrice) || 0,
      profit: parseFloat(form.profit) || 0,
      closeDate: form.closeDate,
      status: form.status,
      address: form.address,
      handoffNotes: form.handoffNotes,
    };
    setRecords([rec, ...records]);
    setIsDialogOpen(false);
    setForm({
      projectName: '',
      buyer: '',
      salePrice: '',
      profit: '',
      closeDate: '',
      status: 'pending',
      handoffNotes: '',
      address: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Sold</h1>
          <p className="text-gray-500 mt-1">Track sales, handoffs, and profit from completed properties.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Sold Property</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Input
                      value={form.projectName}
                      onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Buyer</Label>
                    <Input
                      value={form.buyer}
                      onChange={(e) => setForm({ ...form, buyer: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sale Price</Label>
                    <Input
                      type="number"
                      value={form.salePrice}
                      onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Profit</Label>
                    <Input
                      type="number"
                      value={form.profit}
                      onChange={(e) => setForm({ ...form, profit: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Close/Handoff Date</Label>
                    <Input
                      type="date"
                      value={form.closeDate}
                      onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as SaleStatus })}
                    >
                      <option value="pending">Pending</option>
                      <option value="closed">Closed</option>
                      <option value="handoff">Handoff to client</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Street, City"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Handoff / Notes</Label>
                  <Input
                    value={form.handoffNotes}
                    onChange={(e) => setForm({ ...form, handoffNotes: e.target.value })}
                    placeholder="Describe handoff or terms"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-gray-500">{filtered.length} deals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.profit)}</div>
            <p className="text-xs text-gray-500">Across filtered deals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Status Mix</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 text-sm text-gray-700">
            <Badge variant="secondary">Pending {filtered.filter(f => f.status === 'pending').length}</Badge>
            <Badge>Closed {filtered.filter(f => f.status === 'closed').length}</Badge>
            <Badge variant="success">Handoff {filtered.filter(f => f.status === 'handoff').length}</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search sold properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
                <TabsTrigger value="handoff">Handoff</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((record) => (
              <Card key={record.id} className="border border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-gray-500" />
                      <CardTitle className="text-base">{record.projectName}</CardTitle>
                    </div>
                    <Badge variant={statusVariants[record.status]}>
                      {record.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{record.address || 'No address'}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      Sale
                    </span>
                    <span className="font-semibold">{formatCurrency(record.salePrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-gray-500" />
                      Profit
                    </span>
                    <span className="font-semibold text-green-600">{formatCurrency(record.profit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-4 w-4 text-gray-500" />
                      Close/Handoff
                    </span>
                    <span>{record.closeDate ? formatDate(record.closeDate) : '—'}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Buyer: {record.buyer}
                  </div>
                  {record.handoffNotes && (
                    <div className="text-xs text-gray-500">Notes: {record.handoffNotes}</div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-10">
                No sold properties yet. Add one to start tracking profits.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SoldPage;
