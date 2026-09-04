export type ExecutiveDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months'
  | 'custom';

export interface ExecutiveFilters {
  datePreset: ExecutiveDatePreset;
  customStartDate?: string;
  customEndDate?: string;
  warehouseId?: string;
  productId?: string;
  customerId?: string;
  paymentType?: string;
  orderStatus?: string;
}

export interface SnapshotCardData {
  id: string;
  title: string;
  name: string;
  metric: string;
  rawMetricValue?: number;
  subtext?: string;
  trend?: {
    value: number; // percentage difference
    isPositive: boolean;
    label: string;
  };
  destinationUrl: string;
  badge?: string;
  iconName: string;
}

export type PaymentBehaviorBadge =
  | 'Excellent'
  | 'Good'
  | 'Average'
  | 'Slow Payer'
  | 'High Credit Risk'
  | 'New Account';

export interface CustomerIntelligenceItem {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  daysSinceLastPurchase: number;
  outstandingBalance: number;
  creditLimit: number;
  creditUtilizationPct: number;
  paymentBehavior: PaymentBehaviorBadge;
  growthPct: number;
  favoriteProductName?: string;
  favoriteProductVolume?: number;
  orderHistorySample?: {
    id: string;
    orderNumber: string;
    createdAt: string;
    totalAmount: number;
    status: string;
  }[];
}

export interface ProductIntelligenceItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  revenue: number;
  unitsProduced: number;
  unitsSold: number;
  currentStock: number;
  stockVelocity: number; // units sold per day in period
  daysOfInventoryLeft: number;
  returnRatePct: number;
  revenueGrowthPct: number; // vs previous comparable period
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface SalesTrendDataPoint {
  periodLabel: string;
  dateKey: string;
  revenue: number;
  ordersCount: number;
  averageOrderValue: number;
  newCustomersCount: number;
  repeatCustomersCount: number;
}

export interface WarehouseIntelligenceItem {
  id: string;
  name: string;
  code: string;
  location: string;
  totalStockUnits: number;
  capacityUnits: number;
  utilizationPct: number;
  activityCount: number; // dispatches + receipts
  receiptsCount: number;
  dispatchesCount: number;
  lowStockItemsCount: number;
  stockoutItemsCount: number;
  fastMovingProduct?: { name: string; units: number };
  slowMovingProduct?: { name: string; units: number };
  stockDistribution: {
    productId: string;
    productName: string;
    units: number;
    pctOfWarehouse: number;
  }[];
}

export interface ProductionIntelligenceData {
  producedToday: number;
  producedThisWeek: number;
  producedThisMonth: number;
  producedLast6Months: number;
  hourlyProduction: {
    hourLabel: string; // e.g., '08:00', '09:00'
    count: number;
    volume: number;
  }[];
  peakHour: string;
  peakHourVolume: number;
  timeBlocks: {
    blockName: 'Morning (06:00-12:00)' | 'Afternoon (12:00-18:00)' | 'Night (18:00-24:00)';
    units: number;
    percentage: number;
  }[];
  operatorRankings: {
    operatorId: string;
    operatorName: string;
    scannedUnits: number;
    scannedCartonsCount: number;
    lastActive: string;
  }[];
}

export interface ARAgingBuckets {
  current: number; // not overdue
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  totalReceivables: number;
}

export interface FinancialIntelligenceData {
  totalRevenue: number;
  totalCollections: number;
  outstandingBalance: number;
  creditExposure: number;
  totalCreditLimit: number;
  creditUtilizationPct: number;
  cashSalesAmount: number;
  creditSalesAmount: number;
  cashVsCreditRatio: {
    cashPct: number;
    creditPct: number;
  };
  collectionRatePct: number;
  arAging: ARAgingBuckets;
  recentPayments: {
    id: string;
    customerName: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    status: string;
  }[];
}

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'info';
export type RecommendationCategory = 'customer' | 'product' | 'sales' | 'finance' | 'warehouse' | 'production';

export interface SmartRecommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  message: string;
  metric: string;
  supportingValue: string;
  actionLabel: string;
  actionUrl: string;
}

export interface ComparisonMetricRow {
  label: string;
  entityAValue: number | string;
  entityBValue: number | string;
  rawDiff?: number;
  pctChange?: number;
  winner?: 'A' | 'B' | 'Tie';
  formattedA: string;
  formattedB: string;
}

export interface ExecutiveCompareResult {
  titleA: string;
  titleB: string;
  metrics: ComparisonMetricRow[];
}

export interface CompleteExecutiveData {
  filters: ExecutiveFilters;
  dateRange: { start: Date; end: Date; prevStart: Date; prevEnd: Date };
  snapshots: SnapshotCardData[];
  customers: CustomerIntelligenceItem[];
  products: ProductIntelligenceItem[];
  salesTrends: SalesTrendDataPoint[];
  warehouses: WarehouseIntelligenceItem[];
  production: ProductionIntelligenceData;
  finances: FinancialIntelligenceData;
  recommendations: SmartRecommendation[];
  filterOptions: {
    warehouses: { id: string; name: string }[];
    products: { id: string; name: string }[];
    customers: { id: string; name: string }[];
    paymentTypes: string[];
    orderStatuses: string[];
  };
}
