import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Product, ProductCategory } from '@/types';
import { exportProducts } from '@/lib/pdfGenerator';
import { BulkImportDialog } from '@/components/products/BulkImportDialog';
import { 
  Package, Plus, Search, Smartphone, Headphones, Edit2, Trash2, 
  Upload, Download, MoreVertical, CheckSquare, X 
} from 'lucide-react';

export default function Products() {
  const { products, setProducts } = useApp();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: '', category: 'Smartphones' as ProductCategory, price: '', stockQuantity: '' });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState(false);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSaveProduct = () => {
    if (!formData.name || !formData.price) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    if (editingProduct) {
      setProducts(products.map(p => 
        p.id === editingProduct.id 
          ? { ...p, name: formData.name, category: formData.category, price: parseFloat(formData.price), stockQuantity: parseInt(formData.stockQuantity) || 0 }
          : p
      ));
      toast({ title: 'Success', description: 'Product updated successfully' });
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        stockQuantity: parseInt(formData.stockQuantity) || 0,
        createdAt: new Date(),
      };
      setProducts([...products, newProduct]);
      toast({ title: 'Success', description: 'Product added successfully' });
    }

    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({ name: '', category: 'Smartphones', price: '', stockQuantity: '' });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      stockQuantity: product.stockQuantity.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts(products.filter(p => p.id !== productId));
    toast({ title: 'Deleted', description: 'Product removed successfully' });
  };

  const handleBulkImport = (importedProducts: Omit<Product, 'id' | 'createdAt'>[]) => {
    const newProducts = importedProducts.map((p, idx) => ({
      ...p,
      id: `prod-${Date.now()}-${idx}`,
      createdAt: new Date(),
    }));
    setProducts([...products, ...newProducts]);
  };

  const handleBulkDelete = () => {
    setProducts(products.filter(p => !selectedProducts.includes(p.id)));
    toast({ title: 'Deleted', description: `${selectedProducts.length} products removed` });
    setSelectedProducts([]);
    setBulkAction(false);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Products</h1>
              <p className="text-sm text-muted-foreground">Manage phones and accessories catalog</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkAction(!bulkAction)}>
                <CheckSquare className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Bulk Actions</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsBulkImportOpen(true)}>
                <Upload className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportProducts(products)}>
                <Download className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingProduct(null);
                  setFormData({ name: '', category: 'Smartphones', price: '', stockQuantity: '' });
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="btn-brand">
                    <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Add Product</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                    <DialogDescription>
                      {editingProduct ? 'Update product information' : 'Add a new product to your catalog'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Product Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Samsung A15 128GB"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(v: ProductCategory) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Smartphones">Phones</SelectItem>
                          <SelectItem value="Accessories">Accessories</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="price">Price (Ksh)</Label>
                        <Input
                          id="price"
                          type="number"
                          placeholder="0"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="stock">Stock Quantity</Label>
                        <Input
                          id="stock"
                          type="number"
                          placeholder="0"
                          value={formData.stockQuantity}
                          onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleSaveProduct} className="btn-brand w-full sm:w-auto">
                      {editingProduct ? 'Update' : 'Add Product'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {bulkAction && selectedProducts.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
              <span className="text-sm font-medium">{selectedProducts.length} selected</span>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedProducts([]); setBulkAction(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Stats - Mobile optimized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{products.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Products</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Smartphone className="h-6 w-6 sm:h-8 sm:w-8 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{products.filter(p => ['Smartphones','Feature Phones','Tablets'].includes(p.category)).length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Phone Models</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Headphones className="h-6 w-6 sm:h-8 sm:w-8 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{products.filter(p => p.category === 'Accessories').length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Accessories</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{products.reduce((sum, p) => sum + p.stockQuantity, 0)}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Stock</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="phone">Phones</SelectItem>
              <SelectItem value="accessory">Accessories</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Cards View */}
        <div className="block lg:hidden space-y-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {bulkAction && (
                    <Checkbox 
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={() => toggleSelectProduct(product.id)}
                    />
                  )}
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    ['Smartphones','Feature Phones','Tablets'].includes(product.category) ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                  }`}>
                    {['Smartphones','Feature Phones','Tablets'].includes(product.category) ? <Smartphone className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-primary">Ksh {product.price.toLocaleString()}</span>
                      <span className={`text-sm ${product.stockQuantity > 0 ? 'text-success' : 'text-destructive'}`}>
                        {product.stockQuantity} in stock
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                        <Edit2 className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteProduct(product.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table */}
        <Card className="border shadow-sm overflow-hidden hidden lg:block">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {bulkAction && (
                    <th className="w-10">
                      <Checkbox 
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>#</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => (
                  <tr key={product.id}>
                    {bulkAction && (
                      <td>
                        <Checkbox 
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleSelectProduct(product.id)}
                        />
                      </td>
                    )}
                    <td className="text-muted-foreground">{index + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          ['Smartphones','Feature Phones','Tablets'].includes(product.category) ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                        }`}>
                          {['Smartphones','Feature Phones','Tablets'].includes(product.category) ? <Smartphone className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                        </div>
                        <span className="font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="capitalize">{product.category}</td>
                    <td>Ksh {product.price.toLocaleString()}</td>
                    <td>
                      <span className={`font-medium ${product.stockQuantity > 0 ? 'text-success' : 'text-destructive'}`}>
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <BulkImportDialog 
          open={isBulkImportOpen} 
          onOpenChange={setIsBulkImportOpen}
          onImport={handleBulkImport}
        />
      </div>
    </MainLayout>
  );
}
