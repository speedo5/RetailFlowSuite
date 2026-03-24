import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { IMEI, User } from '@/types';
import { Send, Package, Search, CheckCircle } from 'lucide-react';

interface BulkAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: IMEI[];
  recipients: User[];
  currentUser: User;
  onAllocate: (imeis: IMEI[], recipientId: string) => void;
}

export function BulkAllocationDialog({
  open,
  onOpenChange,
  stock,
  recipients,
  currentUser,
  onAllocate,
}: BulkAllocationDialogProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImeis, setSelectedImeis] = useState<Set<string>>(new Set());
  const [selectedRecipient, setSelectedRecipient] = useState('');

  const filteredStock = useMemo(() => {
    return stock.filter(imei =>
      imei.imei.includes(searchQuery) ||
      imei.productName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stock, searchQuery]);

  const toggleImei = (imeiId: string) => {
    setSelectedImeis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imeiId)) {
        newSet.delete(imeiId);
      } else {
        newSet.add(imeiId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    const getId = (i: IMEI) => (i as any).id || (i as any)._id;
    if (selectedImeis.size === filteredStock.length) {
      setSelectedImeis(new Set());
    } else {
      setSelectedImeis(new Set(filteredStock.map(i => getId(i))));
    }
  };

  const handleAllocate = async () => {
    if (selectedImeis.size === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select at least one phone to allocate',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedRecipient) {
      toast({
        title: 'No recipient selected',
        description: 'Please select a recipient',
        variant: 'destructive',
      });
      return;
    }

    const selectedStock = stock.filter(i => selectedImeis.has((i as any).id || (i as any)._id));
    try {
      await onAllocate(selectedStock, selectedRecipient);
      // Parent handles success toast and closing the dialog
    } catch (err: any) {
      toast({
        title: 'Allocation failed',
        description: err?.message || 'Failed to allocate stock',
        variant: 'destructive',
      });
      return;
    }

    // Clear selection; parent will close the dialog when allocation succeeds
    setSelectedImeis(new Set());
    setSelectedRecipient('');
  };

  const getRecipientLabel = () => {
    switch (currentUser.role) {
      case 'admin': return 'Regional Manager';
      case 'regional_manager': return 'Team Leader';
      case 'team_leader': return 'Field Officer';
      default: return 'Recipient';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Bulk Stock Allocation
          </DialogTitle>
          <DialogDescription>
            Select multiple phones to allocate to a {getRecipientLabel().toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Selection */}
          <div className="space-y-2">
            <Label>Allocate To ({getRecipientLabel()})</Label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${getRecipientLabel().toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {recipients
                  .filter(recipient => recipient.id) // Only include recipients with valid IDs
                  .map((recipient) => (
                    <SelectItem key={recipient.id} value={recipient.id}>
                      <div className="flex items-center gap-2">
                        <span>{recipient.name}</span>
                        {recipient.region && (
                          <span className="text-muted-foreground text-xs">({recipient.region})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by IMEI or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedImeis.size === filteredStock.length && filteredStock.length > 0}
                onCheckedChange={toggleAll}
              />
              <Label htmlFor="select-all" className="cursor-pointer">
                Select All ({filteredStock.length} items)
              </Label>
            </div>
            <Badge variant="secondary">
              {selectedImeis.size} selected
            </Badge>
          </div>

          {/* Stock List */}
          <div className="max-h-60 overflow-y-auto border rounded-lg">
            {filteredStock.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-10"></th>
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-left">IMEI</th>
                    <th className="p-2 text-left">Price</th>
                    <th className="p-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((imei) => {
                    const getId = (i: IMEI) => (i as any).id || (i as any)._id;
                    const ident = getId(imei) as string;
                    return (
                      <tr
                        key={ident}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedImeis.has(ident) ? 'bg-primary/5' : ''}`}
                        onClick={() => toggleImei(ident)}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={selectedImeis.has(ident)}
                            onCheckedChange={() => toggleImei(ident)}
                          />
                        </td>
                        <td className="p-2 font-medium">{imei.productName}</td>
                        <td className="p-2 font-mono text-xs">{imei.imei}</td>
                        <td className="p-2">Ksh {imei.sellingPrice.toLocaleString()}</td>
                        <td className="p-2">
                          <Badge variant="outline">{imei.source}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No stock available for allocation</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleAllocate} 
            disabled={selectedImeis.size === 0 || !selectedRecipient}
            className="btn-brand"
          >
            <Send className="h-4 w-4 mr-2" />
            Allocate {selectedImeis.size} Phones
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
