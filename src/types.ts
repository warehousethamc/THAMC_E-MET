export interface User {
  username: string;
  name: string;
  department: string;
  role: "User" | "Staff" | "Manager" | "Admin";
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  UnitPrice: number;
  Location: string;
  createdAt?: string;
  updatedAt?: string;
  imageUrl?: string | null;
}

export interface Requisition {
  id: string;
  date: string;
  purpose: string;
  requestedBy: string;
  requestorName: string;
  requestorDepartment: string;
  status: string;
  managerApproverUsername?: string | null;
  managerApproverName?: string | null;
  managerApprovalStatus?: string | null;
  managerApprovalDate?: string | null;
  managerApprovalNote?: string | null;
  stockApproverUsername?: string | null;
  stockApproverName?: string | null;
  stockApprovalStatus?: string | null;
  stockApprovalDate?: string | null;
  stockApprovalNote?: string | null;
  RequisitionPDFLink?: string | null;
  GoodsIssuePDFLinks?: GoodsIssuePDFLink[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GoodsIssuePDFLink {
  id: string;
  path: string;
  type: string;
  date: string;
  issuedBy: string;
  url?: string;
}

export interface RequisitionItem {
  requisitionId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  dispensedQuantity: number;
  UnitPrice: number;
  TotalPrice: number;
  isBackordered: boolean;
  notesForItem: string;
  itemCode: string;
  location: string;
  currentInventoryQuantity: number;
  imageUrl?: string | null;
}

export interface DashboardSummary {
  totalItems: number;
  lowStockItems: number;
  pendingManagerApproval: number;
  pendingStockApproval: number;
  backorderedRequisitions: number;
  monthlySummary: {
    labels: string[];
    requisitionCounts: number[];
    totalValues: number[];
  };
}
