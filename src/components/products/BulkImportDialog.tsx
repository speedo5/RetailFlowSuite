import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Product, ProductCategory } from '@/types';
import { Upload, FileText, Download } from 'lucide-react';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: Omit<Product, 'id' | 'createdAt'>[]) => void;
}

export function BulkImportDialog({ open, onOpenChange, onImport }: BulkImportDialogProps) {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const sampleCSV = `name,category,price,stockQuantity
Samsung A15 128GB,phone,25000,10
iPhone 15 Pro,phone,180000,5
USB Cable Type-C,accessory,500,50
Power Bank 10000mAh,accessory,2000,20`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (csv: string): Omit<Product, 'id' | 'createdAt'>[] => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have header and at least one data row');

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const requiredHeaders = ['name', 'category', 'price'];
    
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        throw new Error(`Missing required column: ${required}`);
      }
    }

    const products: Omit<Product, 'id' | 'createdAt'>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      if (!row.name) continue;

      const category = row.category?.toLowerCase() as ProductCategory;
      if (category !== 'phone' && category !== 'accessory') {
        throw new Error(`Invalid category on row ${i + 1}: ${row.category}`);
      }

      products.push({
        name: row.name,
        category,
        price: parseFloat(row.price) || 0,
        stockQuantity: parseInt(row.stockquantity || row.stock || '0') || 0,
      });
    }

    return products;
  };

  const handleImport = () => {
    if (!csvData.trim()) {
      toast({ title: 'Error', description: 'Please provide CSV data', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const products = parseCSV(csvData);
      if (products.length === 0) {
        throw new Error('No valid products found in CSV');
      }
      onImport(products);
      toast({ title: 'Success', description: `${products.length} products imported successfully` });
      setCsvData('');
      onOpenChange(false);
    } catch (error) {
      toast({ 
        title: 'Import Failed', 
        description: error instanceof Error ? error.message : 'Invalid CSV format',
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file or paste data to import multiple products at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="mb-2 block">Upload CSV File</Label>
            <Input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or paste CSV data</span>
            </div>
          </div>

          <div>
            <Textarea
              placeholder="name,category,price,stockQuantity&#10;Samsung A15 128GB,phone,25000,10"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
          </div>

          <Button variant="outline" size="sm" onClick={downloadSample} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download Sample CSV
          </Button>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">CSV Format:</p>
            <p className="text-muted-foreground text-xs font-mono">
              name, category (phone/accessory), price, stockQuantity
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={isProcessing || !csvData.trim()}
            className="btn-brand w-full sm:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            {isProcessing ? 'Importing...' : 'Import Products'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
