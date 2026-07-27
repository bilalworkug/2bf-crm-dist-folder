import type { RoleKey } from './types';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: RoleKey[] | 'all';
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: 'all' },
  { label: 'Production Scan', href: '/production', icon: 'ScanLine', roles: ['admin', 'production', 'manager', 'reports'] },
  { label: 'Warehouse Receive', href: '/warehouse', icon: 'PackageCheck', roles: ['admin', 'warehouse', 'manager', 'reports'] },
  { label: 'Dispatch', href: '/dispatch', icon: 'Truck', roles: ['admin', 'dispatch', 'manager', 'reports'] },
  { label: 'Inventory', href: '/inventory', icon: 'Boxes', roles: 'all' },
  { label: 'Barcode Search', href: '/barcode-search', icon: 'Search', roles: 'all' },
  { label: 'Box History', href: '/box-history', icon: 'History', roles: 'all' },
  { label: 'Customers', href: '/customers', icon: 'Users', roles: ['admin', 'sales', 'accounts', 'manager', 'reports'] },
  { label: 'Orders', href: '/orders', icon: 'ShoppingCart', roles: ['admin', 'sales', 'dispatch', 'accounts', 'manager', 'reports'] },
  { label: 'Returns', href: '/returns', icon: 'Undo2', roles: ['admin', 'warehouse', 'dispatch', 'manager', 'reports'] },
  { label: 'Approvals', href: '/approvals', icon: 'ClipboardCheck', roles: ['admin', 'manager', 'reports'] },
  { label: 'Reports', href: '/reports', icon: 'BarChart3', roles: 'all' },
  { label: 'Audit Logs', href: '/audit-logs', icon: 'ScrollText', roles: ['admin', 'manager', 'reports'] },
  { label: 'Users & Roles', href: '/users', icon: 'UserCog', roles: ['admin'] },
  { label: 'Settings', href: '/settings', icon: 'Settings', roles: ['admin'] },
  { label: 'Quote / Order', href: '/quote', icon: 'FileText', roles: 'all' },
  { label: 'Company Profile', href: '/company', icon: 'Building2', roles: 'all' },
];

export function navItemsForRole(role: RoleKey): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'all' || item.roles.includes(role));
}

export function canAccess(path: string, role: RoleKey): boolean {
  const item = NAV_ITEMS.find((n) => path.startsWith(n.href));
  if (!item) return true;
  return item.roles === 'all' || item.roles.includes(role);
}
