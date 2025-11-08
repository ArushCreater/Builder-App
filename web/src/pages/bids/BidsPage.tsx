import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Badge } from '../../components/ui/badge';
import { Plus, Search } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';

interface Bid {
  id: string;
  projectName: string;
  contractor: string;
  category: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  submittedDate: string;
  validUntil: string;
  notes: string;
}

const statusColors = {
  'pending': 'warning',
  'accepted': 'success',
  'rejected': 'destructive',
  'withdrawn': 'secondary',
} as const;

export function BidsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: bids, isLoading } = useQuery({
    queryKey: ['bids', searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      return apiClient.get<Bid[]>(`/bids?${params}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bids</h1>
          <p className="text-gray-500 mt-1">Manage contractor bids and proposals</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Request Bid
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search bids..."
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
                  <TableHead>Project</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Valid Until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids?.map((bid) => (
                  <TableRow key={bid.id}>
                    <TableCell className="font-medium">{bid.projectName}</TableCell>
                    <TableCell>{bid.contractor}</TableCell>
                    <TableCell>{bid.category}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(bid.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[bid.status]}>
                        {bid.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(bid.submittedDate)}</TableCell>
                    <TableCell>{formatDate(bid.validUntil)}</TableCell>
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
