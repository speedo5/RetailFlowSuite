import { useState, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { IMEI, PhoneSource, Product, CommissionConfig } from '@/types';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { imeiService } from '@/services/imeiService';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (imeis: IMEI[]) => void;
  products: Product[];
}

interface ParsedRow {
  imei: string;
  productName: string;
  productId: string;
  sellingPrice: number;
  source: PhoneSource;
  capacity: string;
  foCommission: number;
  teamLeaderCommission: number;
  regionalManagerCommission: number;
  isValid: boolean;
  error?: string;
}

export function BulkImportDialog({ open, onOpenChange, onImport, products }: BulkImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Skip header row
      const rows = jsonData.slice(1).filter(row => row.length > 0 && row[0]);

      const parsed: ParsedRow[] = rows.map((row, index) => {
        const imei = String(row[0] || '').trim();
        const productName = String(row[1] || '').trim();
        const sellingPrice = parseFloat(row[2]) || 0;
        const source = (String(row[3] || 'watu').toLowerCase() as PhoneSource);
        const capacity = String(row[4] || '64GB').trim();
        const foCommission = parseFloat(row[5]) || 0;
        const teamLeaderCommission = parseFloat(row[6]) || 0;
        const regionalManagerCommission = parseFloat(row[7]) || 0;

        // Validate
        let error: string | undefined;
        let isValid = true;

        if (imei.length !== 15 || !/^\d+$/.test(imei)) {
          error = 'IMEI must be exactly 15 digits';
          isValid = false;
        }

        const matchedProduct = products.find(p => 
          p.name.toLowerCase().includes(productName.toLowerCase()) ||
          productName.toLowerCase().includes(p.name.toLowerCase())
        );

        if (!matchedProduct && !error) {
          error = 'Product not found in catalog';
          isValid = false;
        }

        if (!['watu', 'mogo', 'onfon'].includes(source) && !error) {
          error = 'Invalid source (use watu, mogo, or onfon)';
          isValid = false;
        }

        return {
          imei,
          productName: matchedProduct?.name || productName,
          productId: matchedProduct?.id || '',
          sellingPrice: sellingPrice || matchedProduct?.price || 0,
          source: ['watu', 'mogo', 'onfon'].includes(source) ? source : 'watu',
          capacity,
          foCommission,
          teamLeaderCommission,
          regionalManagerCommission,
          isValid,
          error,
        };
      });

      setParsedData(parsed);
    } catch (error) {
      toast({
        title: 'Error parsing file',
        description: 'Please ensure the file is a valid Excel file',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(row => row.isValid);
    
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix the errors and try again',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Prepare data for API
      const bulkImportData = validRows.map((row) => ({
        imei: row.imei,
        productId: row.productId,
        price: row.sellingPrice,
        source: row.source,
        capacity: row.capacity,
        commissionConfig: 
          (row.foCommission + row.teamLeaderCommission + row.regionalManagerCommission) > 0 
            ? {
                foCommission: row.foCommission,
                teamLeaderCommission: row.teamLeaderCommission,
                regionalManagerCommission: row.regionalManagerCommission,
              }
            : undefined,
      }));

      // Save to database
      const response = await imeiService.bulkRegister(bulkImportData);

      if (response.success && response.data) {
        const results = response.data as any;
        const successfulImeis = results.success || [];

        if (successfulImeis.length === 0) {
          toast({
            title: 'Import failed',
            description: 'No phones were successfully imported. ' + 
              (results.failed?.map((f: any) => `${f.imei}: ${f.reason}`).join(', ') || ''),
            variant: 'destructive',
          });
          return;
        }

        // Fetch the newly created IMEIs from the database
        const registeredImeis: IMEI[] = [];
        
        for (const imei of successfulImeis) {
          const imeiResponse = await imeiService.search(imei);
          if (imeiResponse.success && imeiResponse.data) {
            const item = imeiResponse.data as any;
            const statusMap: Record<string, any> = {
              'in_stock': 'IN_STOCK',
              'allocated': 'ALLOCATED',
              'sold': 'SOLD',
              'locked': 'LOCKED',
              'lost': 'LOST',
            };
            const status = statusMap[item.status?.toLowerCase()] || 'IN_STOCK';
            const totalCommission = (item.commissionConfig?.foCommission || 0) + 
                                   (item.commissionConfig?.teamLeaderCommission || 0) + 
                                   (item.commissionConfig?.regionalManagerCommission || 0);
            const parsedRow = parsedData.find(r => r.imei === item.imei);

            registeredImeis.push({
              id: item.id || item._id,
              imei: item.imei,
              productId: item.productId?._id || item.productId || '',
              productName: item.productId?.name || products.find(p => p.id === item.productId)?.name || 'Unknown',
              capacity: parsedRow?.capacity || item.capacity || '',
              status,
              sellingPrice: item.price || 0,
              commission: totalCommission,
              commissionConfig: item.commissionConfig,
              source: item.source || 'watu',
              registeredAt: item.registeredAt ? new Date(item.registeredAt) : new Date(),
            });
          }
        }

        if (registeredImeis.length > 0) {
          onImport(registeredImeis);
          toast({
            title: 'Import successful',
            description: `${registeredImeis.length} phones added to inventory and saved to database`,
          });
        }

        // Show failed items if any
        if (results.failed && results.failed.length > 0) {
          toast({
            title: 'Some items failed',
            description: `${results.failed.length} phones failed: ${results.failed.map((f: any) => f.reason).join(', ')}`,
            variant: 'destructive',
          });
        }

        setParsedData([]);
        setFileName('');
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message || 'Failed to save phones to database',
        variant: 'destructive',
      });
      console.error('Error during bulk import:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['IMEI', 'Product Name', 'Selling Price', 'Source', 'Capacity', 'FO Commission', 'TL Commission', 'RM Commission'],
      ['351234567890123', 'Samsung A07 64GB', '17100', 'watu', '64GB', '1500', '700', '500'],
      ['351234567890124', 'Samsung A15 128GB', '25500', 'mogo', '128GB', '2000', '1000', '700'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'imei_import_template.xlsx');
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Import from Excel
          </DialogTitle>
          <DialogDescription>
            Import multiple phones from an Excel file with IMEI, product details, and commission configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Download Template</p>
                <p className="text-xs text-muted-foreground">Use this template for correct format</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload Excel File</Label>
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {fileName ? (
                <p className="text-sm font-medium text-foreground">{fileName}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">.xlsx or .xls files only</p>
            </div>
            <Input 
              ref={fileInputRef}
              type="file" 
              accept=".xlsx,.xls" 
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Parsed Results */}
          {parsedData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="bg-success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {invalidCount} errors
                  </Badge>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">IMEI</th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-left">Price</th>
                      <th className="p-2 text-left">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, index) => (
                      <tr key={index} className={row.isValid ? '' : 'bg-destructive/10'}>
                        <td className="p-2">
                          {row.isValid ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                        </td>
                        <td className="p-2 font-mono text-xs">{row.imei}</td>
                        <td className="p-2">{row.productName}</td>
                        <td className="p-2">Ksh {row.sellingPrice.toLocaleString()}</td>
                        <td className="p-2">
                          <Badge variant="outline">{row.source}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidCount > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Errors found:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {parsedData.filter(r => !r.isValid).slice(0, 5).map((row, i) => (
                      <li key={i}>Row {i + 1}: {row.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleImport} 
            disabled={validCount === 0 || isProcessing}
            className="btn-brand"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import {validCount} Phones
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
