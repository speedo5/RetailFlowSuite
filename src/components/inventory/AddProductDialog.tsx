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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Product, ProductCategory } from '@/types';
import { Package } from 'lucide-react';
import { productService } from '@/services/productService';

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (product: Omit<Product, 'id' | 'createdAt'> & { specs?: string }) => void;
  onProductAdded?: (product: Product) => void;
}

export function AddProductDialog({ open, onOpenChange, onAdd, onProductAdded }: AddProductDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    category: 'Smartphones' as ProductCategory,
    price: '',
    stockQuantity: '',
    specs: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Product name is required', variant: 'destructive' });
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast({ title: 'Error', description: 'Valid price is required', variant: 'destructive' });
      return;
    }

    try {
      setIsLoading(true);
      
      // Try to use the API first
      if (onProductAdded) {
        const response = await productService.create({
          name: formData.name.trim(),
          category: formData.category,
          price: parseFloat(formData.price),
          description: formData.specs.trim() || undefined,
        });

        if (response.success && response.data) {
          const newProduct: Product = {
            id: response.data.id || response.data._id,
            _id: response.data._id,
            name: response.data.name,
            category: response.data.category,
            price: response.data.price,
            stockQuantity: 0,
            createdAt: response.data.createdAt ? new Date(response.data.createdAt) : new Date(),
          };
          onProductAdded(newProduct);
        }
      } else if (onAdd) {
        // Fall back to callback if onProductAdded not provided
        onAdd({
          name: formData.name.trim(),
          category: formData.category,
          price: parseFloat(formData.price),
          stockQuantity: parseInt(formData.stockQuantity) || 0,
          specs: formData.specs.trim() || undefined,
        });
      }

      toast({ title: 'Success', description: 'Product added successfully' });
      setFormData({ name: '', category: 'Smartphones', price: '', stockQuantity: '', specs: '' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add product', variant: 'destructive' });
      console.error('Error adding product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Add New Product
          </DialogTitle>
          <DialogDescription>
            Add a new product to the catalog with specifications
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Samsung Galaxy A15 128GB"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(v: ProductCategory) => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Smartphones">Smartphones</SelectItem>
                <SelectItem value="Feature Phones">Feature Phones</SelectItem>
                <SelectItem value="Tablets">Tablets</SelectItem>
                <SelectItem value="Accessories">Accessories</SelectItem>
                <SelectItem value="SIM Cards">SIM Cards</SelectItem>
                <SelectItem value="Airtime">Airtime</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price (Ksh) *</Label>
              <Input
                id="price"
                type="number"
                placeholder="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="stock">Initial Stock</Label>
              <Input
                id="stock"
                type="number"
                placeholder="0"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="specs">Specifications</Label>
            <Textarea
              id="specs"
              placeholder="e.g., 6.5&quot; Display, 5000mAh Battery, 50MP Camera..."
              value={formData.specs}
              onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional: Add detailed specifications
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto" disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="btn-brand w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
