'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Package, User, Plus, Search, Edit, History, BadgeDollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import type { Product, Profile, ProductPrice } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ExportDropdown } from '@/components/export-dropdown';

interface Assignment {
  id: string;
  product_id: string;
  production_user_id: string;
  active: boolean;
}

interface PriceHistory extends ProductPrice {
  profile: { full_name: string, email: string } | null;
}

export default function AdminProductsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [productionUsers, setProductionUsers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activePrices, setActivePrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // New/Edit Product State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState('');
  
  // Pricing State for Add/Edit Form
  const [newPrice, setNewPrice] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  
  // Price History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);

  // Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'product' | 'user'>('product');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const [productsRes, usersRes, assignmentsRes, pricesRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('profiles').select('*').in('role', ['production', 'production_manager']).order('full_name'),
        supabase.from('product_production_assignments').select('*').eq('active', true),
        supabase.from('product_prices').select('*').eq('active', true)
      ]);

      setProducts(productsRes.data ?? []);
      setProductionUsers(usersRes.data ?? []);
      setAssignments(assignmentsRes.data ?? []);
      
      if (pricesRes.data && productsRes.data) {
        const map: Record<string, number> = {};
        const now = new Date();
        
        productsRes.data.forEach(prod => {
          const prodPrices = pricesRes.data.filter(p => p.product_id === prod.id);
          const currentPrice = prodPrices.find(p => {
              const from = new Date(p.effective_from);
              const to = p.effective_to ? new Date(p.effective_to) : null;
              return from <= now && (!to || to > now);
          });
          
          if (currentPrice) {
              map[prod.id] = currentPrice.price;
          } else {
              const pastPrices = prodPrices
                  .filter(p => new Date(p.effective_from) <= now)
                  .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
                  
              if (pastPrices.length > 0) {
                  map[prod.id] = pastPrices[0].price;
              }
          }
        });
        setActivePrices(map);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const saveProduct = async () => {
    if (!newProductName.trim()) return toast.error('Product name is required');
    let productId = editingProduct?.id;
    
    if (editingProduct) {
      // Edit
      const { error } = await supabase.from('products').update({ name: newProductName.trim() }).eq('id', editingProduct.id);
      if (error) return toast.error(error.message);
      
      await supabase.from('audit_logs').insert({
        user_id: profile?.id,
        action: 'product_edited',
        entity_type: 'products',
        entity_id: editingProduct.id,
        details: { old_name: editingProduct.name, new_name: newProductName.trim() }
      });
      toast.success('Product updated');
    } else {
      // Add
      const { data, error } = await supabase.from('products').insert({ name: newProductName.trim(), active: true }).select().single();
      if (error) return toast.error(error.message);
      productId = data.id;
      
      if (data) {
        await supabase.from('audit_logs').insert({
          user_id: profile?.id,
          action: 'product_created',
          entity_type: 'products',
          entity_id: data.id,
          details: { name: newProductName.trim() }
        });
      }
      toast.success('Product created');
    }

    // Handle Optional Price Saving
    if (newPrice && productId) {
        const priceNum = parseFloat(newPrice);
        if (isNaN(priceNum) || priceNum <= 0) {
            toast.error('Price must be greater than zero. Product was saved, but price was not.');
        } else {
            const { error: priceError } = await supabase
              .from('product_prices')
              .insert({
                product_id: productId,
                price: priceNum,
                currency,
                effective_from: new Date(effectiveFrom).toISOString(),
                notes,
                created_by: profile?.id,
                active: true
              });
              
            if (priceError) {
                toast.error('Failed to save price configuration.');
            } else {
                await supabase.from('audit_logs').insert({
                  user_id: profile?.id,
                  action: 'product_price_created',
                  entity_type: 'product_prices',
                  details: {
                    product_id: productId,
                    product_name: newProductName.trim(),
                    new_price: priceNum,
                    currency,
                    effective_from: effectiveFrom,
                    notes
                  }
                });
                toast.success('Price configuration saved.');
            }
        }
    }

    setIsProductModalOpen(false);
    setEditingProduct(null);
    setNewProductName('');
    setNewPrice('');
    setCurrency('ETB');
    setEffectiveFrom(new Date().toISOString().slice(0, 16));
    setNotes('');
    loadData();
  };

  const openAddModal = () => {
      setEditingProduct(null);
      setNewProductName('');
      setNewPrice('');
      setCurrency('ETB');
      setEffectiveFrom(new Date().toISOString().slice(0, 16));
      setNotes('');
      setIsProductModalOpen(true);
  };
  
  const openEditModal = (p: Product) => {
      setEditingProduct(p);
      setNewProductName(p.name);
      setNewPrice('');
      setCurrency('ETB');
      setEffectiveFrom(new Date().toISOString().slice(0, 16));
      setNotes('');
      setIsProductModalOpen(true);
  };
  
  const openHistoryModal = async (p: Product) => {
      setHistoryProduct(p);
      setIsHistoryModalOpen(true);
      
      const { data, error } = await supabase
        .from('product_prices')
        .select('*, profile:profiles(full_name, email)')
        .eq('product_id', p.id)
        .order('effective_from', { ascending: false });
      
      if (data) {
        setPriceHistory(data as any);
      }
  };

  const toggleProductActive = async (product: Product, currentActive: boolean) => {
    const { error } = await supabase.from('products').update({ active: !currentActive }).eq('id', product.id);
    if (error) return toast.error(error.message);
    
    await supabase.from('audit_logs').insert({
      user_id: profile?.id,
      action: !currentActive ? 'product_activated' : 'product_deactivated',
      entity_type: 'products',
      entity_id: product.id,
      details: { name: product.name }
    });
    
    toast.success(`Product ${!currentActive ? 'activated' : 'deactivated'}`);
    loadData();
  };
  
  const togglePriceStatus = async (priceId: string, currentStatus: boolean, priceNum: number) => {
      if (!profile) return toast.error('Not authenticated');
      
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('product_prices')
        .update({ active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', priceId);
        
      if (error) {
          toast.error('Failed to update price status');
      } else {
          await supabase.from('audit_logs').insert({
            user_id: profile.id,
            action: newStatus ? 'product_price_activated' : 'product_price_deactivated',
            entity_type: 'product_prices',
            details: {
              price_id: priceId,
              product_id: historyProduct?.id,
              price: priceNum
            }
          });
          toast.success(newStatus ? 'Price activated' : 'Price deactivated');
          if (historyProduct) {
              openHistoryModal(historyProduct);
              loadData();
          }
      }
  };

  const toggleAssignment = async (productId: string, userId: string, isCurrentlyAssigned: boolean) => {
    if (isCurrentlyAssigned) {
      const { error } = await supabase
        .from('product_production_assignments')
        .update({ active: false })
        .match({ product_id: productId, production_user_id: userId });
        
      if (error) return toast.error(error.message);
      
      await supabase.from('audit_logs').insert({
        user_id: profile?.id,
        action: 'product_unassigned',
        entity_type: 'product_production_assignments',
        details: { product_id: productId, production_user_id: userId }
      });
    } else {
      const { error } = await supabase
        .from('product_production_assignments')
        .upsert({
          product_id: productId,
          production_user_id: userId,
          assigned_by: profile?.id,
          active: true
        }, { onConflict: 'product_id, production_user_id' });
        
      if (error) return toast.error(error.message);
      
      await supabase.from('audit_logs').insert({
        user_id: profile?.id,
        action: 'product_assigned',
        entity_type: 'product_production_assignments',
        details: { product_id: productId, production_user_id: userId }
      });
    }
    
    loadData();
  };

  if (!isAdmin) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Product Management"
        description="Centralized hub for Catalog, Pricing, and Production Assignments."
      />
      
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Products Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Catalog Products & Prices</CardTitle>
              <CardDescription>Manage products, prices, and assignments</CardDescription>
            </div>
            <div className="flex gap-2">
              <ExportDropdown
                filenameBase="products"
                title="Products Report"
                headers={['Name', 'Active', 'Current Price (ETB)', 'Created']}
                rows={products.map((p) => [p.name, p.active ? 'Yes' : 'No', activePrices[p.id] ?? 'N/A', new Date(p.created_at).toLocaleDateString()])}
              />
              <Button onClick={openAddModal}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Users</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(p => {
                    const assignedUsers = assignments.filter(a => a.product_id === p.id && a.active);
                    const currentPrice = activePrices[p.id];
                    return (
                      <TableRow key={p.id} className={!p.active ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono">
                          {currentPrice !== undefined ? (
                            <span className="text-green-600 font-semibold">{currentPrice.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-sm">No price set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{currentPrice !== undefined ? 'ETB' : '-'}</TableCell>
                        <TableCell>
                          <Switch 
                            checked={p.active ?? true} 
                            onCheckedChange={() => toggleProductActive(p, p.active ?? true)}
                          />
                        </TableCell>
                        <TableCell>
                          {assignedUsers.length} Users
                        </TableCell>
                        <TableCell className="text-right space-x-2 flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => {
                            setAssignMode('product');
                            setSelectedEntityId(p.id);
                            setIsAssignModalOpen(true);
                          }}>
                            Assign Users
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openHistoryModal(p)}>
                            <History className="h-4 w-4 mr-2" /> Price History
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditModal(p)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Production Users</CardTitle>
            <CardDescription>Manage assigned products per user</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned Products</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionUsers.map(u => {
                    const assignedProducts = assignments.filter(a => a.production_user_id === u.id && a.active);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || 'N/A'}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {assignedProducts.map(a => {
                              const pName = products.find(p => p.id === a.product_id)?.name;
                              return <Badge key={a.product_id} variant="secondary">{pName}</Badge>;
                            })}
                            {assignedProducts.length === 0 && <span className="text-muted-foreground text-sm">None</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => {
                            setAssignMode('user');
                            setSelectedEntityId(u.id);
                            setIsAssignModalOpen(true);
                          }}>
                            Assign Products
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Product Add/Edit Modal (With Pricing) */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product & Add Price' : 'Add New Product & Price'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input 
                value={newProductName} 
                onChange={(e) => setNewProductName(e.target.value)} 
                placeholder="e.g. Brothers First Cappuccino"
              />
            </div>
            
            <div className="pt-4 border-t space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">Price Configuration (Optional)</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <div className="relative">
                      <BadgeDollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0.01"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        placeholder={editingProduct ? "Change or schedule new price" : "Initial price"}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      placeholder="ETB"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Effective From (Date & Time)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="datetime-local" 
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Price becomes active automatically on this date.</p>
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Input 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for price change..."
                  />
                </div>
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductModalOpen(false)}>Cancel</Button>
            <Button onClick={saveProduct}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Price History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Price History: {historyProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1 p-0 mt-4 border rounded-md">
                {priceHistory.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No price history available.</div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Price</TableHead>
                        <TableHead>Effective From</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceHistory.map((h, i) => {
                          const now = new Date();
                          const eff = new Date(h.effective_from);
                          const isFuture = eff > now;
                          const isCurrent = h.active && !isFuture && (i === 0 || !priceHistory.slice(0, i).some(prev => prev.active && new Date(prev.effective_from) <= now));
                          
                          return (
                            <TableRow key={h.id} className={!h.active ? 'opacity-50' : ''}>
                              <TableCell className="font-mono">
                                {h.price.toFixed(2)} {h.currency}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{eff.toLocaleDateString()}</div>
                                <div className="text-xs text-muted-foreground">{eff.toLocaleTimeString()}</div>
                              </TableCell>
                              <TableCell>
                                {isCurrent ? (
                                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 font-medium">Current</span>
                                ) : isFuture && h.active ? (
                                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">Future</span>
                                ) : !h.active ? (
                                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 font-medium">Inactive</span>
                                ) : (
                                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 font-medium">Historical</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate" title={h.notes || ''}>
                                {h.notes || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Switch 
                                    checked={h.active}
                                    onCheckedChange={() => togglePriceStatus(h.id, h.active, h.price)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                      })}
                    </TableBody>
                  </Table>
                )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignment Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {assignMode === 'product' 
                ? `Assign Users to ${products.find(p => p.id === selectedEntityId)?.name}`
                : `Assign Products to ${productionUsers.find(u => u.id === selectedEntityId)?.full_name || 'User'}`
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {assignMode === 'product' ? (
              <div className="space-y-4">
                {productionUsers.map(user => {
                  const isAssigned = assignments.some(a => a.product_id === selectedEntityId && a.production_user_id === user.id && a.active);
                  return (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{user.full_name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Switch 
                        checked={isAssigned} 
                        onCheckedChange={() => toggleAssignment(selectedEntityId, user.id, isAssigned)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {products.filter(p => p.active).map(product => {
                  const isAssigned = assignments.some(a => a.production_user_id === selectedEntityId && a.product_id === product.id && a.active);
                  return (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{product.name}</p>
                      </div>
                      <Switch 
                        checked={isAssigned} 
                        onCheckedChange={() => toggleAssignment(product.id, selectedEntityId, isAssigned)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsAssignModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
