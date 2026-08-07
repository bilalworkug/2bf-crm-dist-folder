import type { RoleKey } from './types';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: RoleKey[] | 'all';
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: 'all' },
  { label: 'Production Scan', href: '/production', icon: 'ScanLine', roles: ['admin', 'production', 'production_manager'] },
  { label: 'Prod. Corrections', href: '/production/corrections', icon: 'Undo2', roles: ['admin', 'production_manager'] },
  { label: 'Warehouse Receive', href: '/warehouse', icon: 'PackageCheck', roles: ['admin', 'warehouse', 'warehouse_manager'] },
  { label: 'WH Corrections', href: '/warehouse/corrections', icon: 'Undo2', roles: ['admin', 'warehouse_manager'] },
  { label: 'WH Transfers', href: '/warehouse/transfers', icon: 'ArrowRightLeft', roles: ['admin', 'warehouse', 'warehouse_manager'] },
  { label: 'Fulfillment', href: '/warehouse/fulfillment', icon: 'ClipboardCheck', roles: ['admin', 'warehouse', 'warehouse_manager'] },
  { label: 'Dispatch', href: '/dispatch', icon: 'Truck', roles: ['admin', 'dispatch', 'dispatch_manager'] },
  { label: 'Delivery', href: '/delivery', icon: 'PackageCheck', roles: ['admin', 'dispatch', 'dispatch_manager'] },
  { label: 'Inventory', href: '/inventory', icon: 'Boxes', roles: ['admin', 'production_manager', 'warehouse', 'warehouse_manager', 'sales', 'sales_manager', 'dispatch', 'dispatch_manager', 'accounts', 'accounts_manager', 'returns_manager', 'reports', 'manager'] },
  { label: 'Global Search', href: '/search', icon: 'Search', roles: 'all' },
  { label: 'Barcode Search', href: '/barcode-search', icon: 'ScanSearch', roles: 'all' },
  { label: 'Box History', href: '/box-history', icon: 'History', roles: 'all' },
  { label: 'Customers', href: '/customers', icon: 'Users', roles: ['admin', 'sales', 'sales_manager', 'accounts', 'accounts_manager'] },
  { label: 'Orders', href: '/orders', icon: 'ShoppingCart', roles: ['admin', 'sales', 'sales_manager', 'accounts', 'accounts_manager'] },
  { label: 'Pricing', href: '/pricing', icon: 'FileText', roles: ['admin'] },
  { label: 'Discount Approvals', href: '/sales/discounts', icon: 'BadgeDollarSign', roles: ['admin', 'sales_manager'] },
  { label: 'Returns', href: '/returns', icon: 'Undo2', roles: ['admin', 'returns_manager'] },
  { label: 'Approvals', href: '/approvals', icon: 'ClipboardCheck', roles: ['admin', 'manager', 'sales_manager'] },
  { label: 'Reports', href: '/reports', icon: 'BarChart3', roles: ['admin', 'production_manager', 'warehouse_manager', 'sales_manager', 'dispatch_manager', 'accounts', 'accounts_manager', 'returns_manager', 'reports', 'manager'] },
  { label: 'Audit Logs', href: '/audit', icon: 'ScrollText', roles: ['admin', 'manager'] },
  { label: 'Users & Roles', href: '/users', icon: 'UserCog', roles: ['admin'] },
  { label: 'Settings', href: '/settings', icon: 'Settings', roles: 'all' },
  { label: 'Quote / Order', href: '/quote', icon: 'FileText', roles: ['admin', 'sales', 'sales_manager'] },
];


export function navItemsForRole(role: RoleKey): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'all' || item.roles.includes(role));
}

export function canAccess(path: string, role: RoleKey): boolean {
  const item = NAV_ITEMS.find((n) => path.startsWith(n.href));
  if (!item) return true;
  return item.roles === 'all' || item.roles.includes(role);
}
