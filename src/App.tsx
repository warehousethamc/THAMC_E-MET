import React, { useState, useEffect } from "react";
import { runScript, formatDateForDisplay, formatDateTimeForDisplay, formatNumber, resolveApiUrl } from "./utils/api";
import { User, Requisition, RequisitionItem } from "./types";

// Import Custom Tab Components
import AnnouncementsTab from "./components/AnnouncementsTab";
import DashboardTab from "./components/DashboardTab";
import RequisitionTab from "./components/RequisitionTab";
import HistoryTab from "./components/HistoryTab";
import StockTab from "./components/StockTab";
import GoodsReceiptTab from "./components/GoodsReceiptTab";
import ReportsTab from "./components/ReportsTab";
import AdminUsersTab from "./components/AdminUsersTab";
import ProfileTab from "./components/ProfileTab";

import {
  Megaphone,
  PieChart,
  ShoppingCart,
  ClipboardCheck,
  Layers,
  History,
  Boxes,
  Truck,
  BarChart3,
  Users,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Lock,
  FileText,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Eye,
  RefreshCw,
  Award,
  ChevronDown,
  ChevronRight,
  Search,
  ClipboardList
} from "lucide-react";
import Swal from "sweetalert2";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>("announcements");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);

  // Authentication Fields
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regDepartment, setRegDepartment] = useState("");
  const [authError, setAuthError] = useState("");

  // Common caches
  const [departments, setDepartments] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Pending Approvals state
  const [pendingApprovals, setPendingApprovals] = useState<Requisition[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState<boolean>(false);
  const [approvalFilterStatus, setApprovalStatusFilter] = useState<string>("all");

  // Requisition Dialog Detail state
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [currentReqDetail, setCurrentReqDetail] = useState<{
    requisition: Requisition;
    items: RequisitionItem[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Approving Form values
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [dispensedQuantities, setDispensedQuantities] = useState<Record<string, number>>({});
  const [itemBackorders, setItemBackorders] = useState<Record<string, boolean>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [savingApproval, setSavingApproval] = useState<boolean>(false);

  useEffect(() => {
    // Check local storage session
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.username) {
          setCurrentUser(parsed);
        }
      } catch (e) {
        localStorage.removeItem("currentUser");
      }
    }
    loadCommonCaches();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadPendingApprovals();
    }
  }, [currentUser, refreshTrigger]);

  const loadCommonCaches = async () => {
    try {
      const depts = await runScript("getDepartments");
      setDepartments(depts || []);
    } catch (e) {
      console.error("Failed to load departments:", e);
    }
  };

  const loadPendingApprovals = async () => {
    if (!currentUser || !["Admin", "Manager", "Staff"].includes(currentUser.role)) return;
    setLoadingApprovals(true);
    try {
      const data = await runScript("getPendingApprovals", currentUser.username, currentUser.role);
      setPendingApprovals(data || []);
    } catch (e) {
      console.error("Failed to load pending approvals:", e);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!loginUsername || !loginPassword) {
      setAuthError("กรุณาระบุชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    try {
      const user = await runScript("loginUser", loginUsername, loginPassword);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem("currentUser", JSON.stringify(user));
        setLoginPassword("");
        setLoginUsername("");
        // Show success alert
        Swal.fire({
          icon: "success",
          title: "เข้าสู่ระบบสำเร็จ!",
          text: `ยินดีต้อนรับคุณ ${user.name} เข้าสู่ระบบ`,
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000,
        });
      } else {
        setAuthError("ชื่อผู้ใช้ หรือ รหัสผ่านระบบ ไม่ถูกต้อง");
      }
    } catch (err: any) {
      setAuthError("เกิดข้อผิดพลาดทางเทคนิค: " + err.message);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!regUsername || !regPassword || !regName || !regDepartment) {
      setAuthError("กรุณาระบุรายละเอียดให้ครบถ้วน");
      return;
    }

    try {
      const payload = {
        username: regUsername.trim(),
        password: regPassword.trim(),
        name: regName.trim(),
        department: regDepartment,
        role: "User",
      };

      const res = await runScript("registerUser", payload);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "ลงทะเบียนสมาชิกสำเร็จ!",
          text: "กรุณาใช้บัญชีที่ลงทะเบียนใหม่พื่อเข้าสู่ระบบ",
          confirmButtonColor: "#059669",
        });
        setRegUsername("");
        setRegPassword("");
        setRegName("");
        setRegDepartment("");
        setAuthMode("login");
      } else {
        setAuthError(res.message || "ไม่สามารถลงทะเบียนได้");
      }
    } catch (err: any) {
      setAuthError("ระบบมีปัญหาขัดข้อง: " + err.message);
    }
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    Swal.fire({
      title: "ต้องการออกจากระบบ?",
      text: "เซสชันการเบิกจ่ายและดูสต๊อกของคลังของท่านจะสิ้นสุดลง",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#e11d48",
    }).then((result) => {
      if (result.isConfirmed) {
        setCurrentUser(null);
        localStorage.removeItem("currentUser");
        setUserDropdownOpen(false);
      }
    });
  };

  const handleOpenReqDetails = async (requisitionId: string, forApprovalState = false) => {
    setSelectedReqId(requisitionId);
    setLoadingDetail(true);
    setDetailModalOpen(true);
    setApprovalNotes("");

    try {
      const data = await runScript("getRequisitionDetails", requisitionId);
      if (data && data.requisition) {
        setCurrentReqDetail(data);

        // Prepopulate dispensing values
        const newQuants: Record<string, number> = {};
        const newBOS: Record<string, boolean> = {};
        const newNotes: Record<string, string> = {};

        const isManagerApp = data.requisition.status === "Pending Manager Approval" && ["Admin", "Manager"].includes(currentUser?.role || "");
        const isStockApp = data.requisition.status === "Pending Stock Approval" && ["Admin", "Manager", "Staff"].includes(currentUser?.role || "");
        const isFulfillBack = data.requisition.status === "Partially Completed" && ["Admin", "Staff"].includes(currentUser?.role || "");

        data.items.forEach((item: RequisitionItem) => {
          const reqQty = item.quantity || 0;
          const currentStock = item.currentInventoryQuantity || 0;
          const totalDispensedAlready = item.dispensedQuantity || 0;

          if (isManagerApp) {
            newQuants[item.itemId] = Math.min(reqQty, currentStock);
            newBOS[item.itemId] = item.isBackordered;
          } else if (isStockApp) {
            newQuants[item.itemId] = Math.min(totalDispensedAlready, currentStock);
            newBOS[item.itemId] = item.isBackordered;
          } else if (isFulfillBack) {
            if (item.isBackordered) {
              const remaining = reqQty - totalDispensedAlready;
              newQuants[item.itemId] = Math.min(remaining, currentStock);
            } else {
              newQuants[item.itemId] = 0;
            }
            newBOS[item.itemId] = item.isBackordered;
          } else {
            newQuants[item.itemId] = totalDispensedAlready;
            newBOS[item.itemId] = item.isBackordered;
          }

          newNotes[item.itemId] = item.notesForItem || "";
        });

        setDispensedQuantities(newQuants);
        setItemBackorders(newBOS);
        setItemNotes(newNotes);
      } else {
        Swal.fire("ไม่พบข้อมูล", "ข้อขัดข้อง ไม่ระบุใบเบิกชิ้นนี้ในห้องคลัง", "error");
        setDetailModalOpen(false);
      }
    } catch (e: any) {
      Swal.fire("เกิดข้อผิดพลาดในการโหลด", e.message, "error");
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveApprovalDecision = async (decision: "Approved" | "Rejected") => {
    if (!currentReqDetail || !currentUser) return;

    if (decision === "Rejected" && !approvalNotes.trim()) {
      const { value: reason } = await Swal.fire({
        title: "ระบุข้อความสาเหตุตัดสิทธิ์",
        input: "textarea",
        inputPlaceholder: "พิมพ์ข้อร้องขอที่ไม่อนุมัติใบเบิกที่นี่...",
        showCancelButton: true,
        confirmButtonText: "ส่งบันทึก",
        cancelButtonText: "ยกเลิก",
        inputValidator: (value) => !value && "กรุณาระบุความคิดเห็นการปฏิเสธใบเบิกก่อนกระทำรายการ",
      });
      if (!reason) return;
      setApprovalNotes(reason);
    }

    const isManagerApp = currentReqDetail.requisition.status === "Pending Manager Approval";
    const isStockApp = currentReqDetail.requisition.status === "Pending Stock Approval";
    const isFulfillBack = currentReqDetail.requisition.status === "Partially Completed";

    const approvalLevel = isManagerApp ? "manager" : isStockApp ? "stock" : isFulfillBack ? "fulfill_backorder" : "";
    if (!approvalLevel) return;

    // Validate quantities and pack
    const clientItems: any[] = [];
    let stockError = false;

    currentReqDetail.items.forEach((item) => {
      const dispQty = dispensedQuantities[item.itemId] || 0;
      const isBO = itemBackorders[item.itemId] || false;
      const note = itemNotes[item.itemId] || "";

      if (decision === "Approved" && (approvalLevel === "stock" || approvalLevel === "fulfill_backorder") && !isBO && dispQty > 0) {
        if (dispQty > item.currentInventoryQuantity) {
          Swal.fire("คลังไม่เพียงพอ", `รายการวัสดุ "${item.itemName}" ไม่สามารถทำการจ่ายจริงปริมาณ ${dispQty} ชิ้น เกินพัสดุที่มีเหลือจริงในคลัง (${item.currentInventoryQuantity}) ได้`, "error");
          stockError = true;
          return;
        }
      }

      clientItems.push({
        itemId: item.itemId,
        dispensedQuantity: dispQty,
        isBackordered: isBO,
        itemNote: note.trim(),
      });
    });

    if (stockError) return;

    setSavingApproval(true);
    try {
      const res = await runScript("approveRequisition", currentReqDetail.requisition.id, currentUser.username, approvalLevel, decision, approvalNotes, clientItems);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "อัปเดตสิทธิ์ใบจ่ายสำเร็จ!",
          text: `ใบเบิกพัสดุได้รับการอัปเดตเป็น: ${res.newStatus}`,
          confirmButtonColor: "#059669",
        });
        setDetailModalOpen(false);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        Swal.fire("เกิดข้อผิดพลาด", res.message || "ไม่สามารถอัปเดตสถานะใบเบิกพัสดุได้", "error");
      }
    } catch (err: any) {
      Swal.fire("ข้อผิดพลาดทางเครือข่าย", err.message, "error");
    } finally {
      setSavingApproval(false);
    }
  };

  const handleForceComplete = async (reqId: string) => {
    const confirm = await Swal.fire({
      title: "ยืนยันบังคับปิดงาน (Force Complete)?",
      html: `คุณกำลังจะปิดคำร้องใบเบิกค้างจ่าย <strong class="text-indigo-600 font-bold">#${reqId}</strong> นี้ไปเลยอย่างเป็นทางการ โดยมีพัสดุส่วนที่เหลือจะถูกยกเลิกการรอส่งมอบ`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "บังคับปิดงานใบเบิก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#d97706",
    });

    if (!confirm.isConfirmed) return;

    setSavingApproval(true);
    try {
      const res = await runScript("manuallyCompleteRequisition", reqId, currentUser);
      if (res.success) {
        Swal.fire("สำเร็จ!", "ใบเบิกค้างจ่ายถูกจัดเก็บเป็นยอดสถานะเสร็จสิ้นถาวรแล้ว (Completed)", "success");
        setDetailModalOpen(false);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        Swal.fire("ล้มเหลว", res.message, "error");
      }
    } catch (e: any) {
      Swal.fire("ข้อผิดพลาด", e.message, "error");
    } finally {
      setSavingApproval(false);
    }
  };

  // Auth Screen layout if no user logged in
  if (!currentUser) {
    return (
      <div className="flex min-h-screen bg-slate-50 font-sans">
        {/* Left Side: Form */}
        <div className="w-full md:w-[35%] lg:w-[28%] flex flex-col justify-between p-8 bg-white shadow-2xl relative z-10 min-h-screen overflow-y-auto">
          {/* Header */}
          <div className="text-center w-full max-w-sm mt-4 shrink-0">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mb-3 border border-indigo-100/50 shadow-sm animate-pulse">
              <ShoppingCart className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">THAMC e-Material</h1>
            <p className="text-slate-400 text-xs mt-1">ระบบเบิกจ่ายวัสดุสำนักงาน V1.2</p>
          </div>

          {/* Form */}
          <div className="w-full max-w-sm my-auto py-8">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 mb-6">
              {authMode === "login" ? "ลงชื่อเข้าใช้งาน" : "ลงทะเบียนบัญชีบุคลากรแพทย์"}
            </h2>

            {authMode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ชื่อผู้ใช้บัญชีหลัก (Username)
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50/50 border border-slate-350 focus:border-indigo-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm focus:outline-none"
                    placeholder="ป้อนชื่อผู้ใช้..."
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    รหัสผ่าน (Password)
                  </label>
                  <input
                    type="password"
                    required
                    className="w-full bg-slate-50/50 border border-slate-350 focus:border-indigo-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm focus:outline-none"
                    placeholder="ป้อนรหัสรักษาความปลอดภัย..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-650 hover:bg-slate-705 text-white bg-indigo-600 hover:bg-indigo-750 font-bold rounded-lg text-sm shadow-md transition-all hover:translate-y-[-1px]"
                >
                  เข้าสู่ระบบ
                </button>
                <p className="text-center text-xs text-slate-500 mt-4 leading-relaxed font-normal">
                  ยังไม่เป็นพนักงานในระบบเบิก?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                    className="font-bold text-indigo-600 hover:underline inline-block"
                  >
                    ลงทะเบียนผู้ใช้ใหม่
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                    ตั้งยูสเซอร์ที่ประสงค์ (Username)
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50/50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    placeholder="เช่น user_name"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                    รหัสผ่านรักษาความปลอดภัย (Password)
                  </label>
                  <input
                    type="password"
                    required
                    className="w-full bg-slate-50/50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    placeholder="ป้อนรหัสความปลอดภัย..."
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                    ชื่อ-นามสกุล บุคลากร
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50/50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    placeholder="ป้อนชื่อสกุลผู้เบิก..."
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                    แผนกปฏิบัติงาน
                  </label>
                  <select
                    required
                    className="w-full bg-slate-50/50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                  >
                    <option value="" disabled>-- เลือกแผนกที่พึงสังกัด --</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow-md transition-all mt-4"
                >
                  ลงทะเบียน
                </button>
                <p className="text-center text-xs text-slate-500 mt-4 leading-relaxed font-normal">
                  มีบัญชีอยู่แล้วในระบบ?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                    className="font-bold text-indigo-600 hover:underline inline-block"
                  >
                    กลับเข้าสู่ระบบ
                  </button>
                </p>
              </form>
            )}

            {authError && (
              <p className="text-rose-600 text-xs font-bold text-center mt-3 bg-rose-50 p-2 border border-rose-100 rounded-md animate-shake">
                {authError}
              </p>
            )}
          </div>

          {/* API Server Configuration for static hosting / GitHub Pages */}
          <div className="text-center shrink-0 mb-4">
            <button
              onClick={() => {
                const currentApi = localStorage.getItem("backend_api_url") || "https://ais-pre-oz7nezk4tpzgmervnkkonx-966862217040.asia-southeast1.run.app";
                Swal.fire({
                  title: "⚙️ ตั้งค่า API เซิร์ฟเวอร์",
                  html: `
                    <div style="text-align: left; font-family: sans-serif; font-size: 13px; color: #334155; line-height: 1.5;">
                      <p style="margin-bottom: 12px; font-weight: 500; color: #64748b;">เนื่องจากระบบถูกรันอยู่บน GitHub Pages (Client) จะต้องเลือก URL ของเซิร์ฟเวอร์ (API) เพื่อส่งคำสั่งไปประมวลผลหลังบ้าน</p>
                      
                      <div style="margin-bottom: 12px;">
                        <button id="swal-btn-dev" type="button" style="width: 100%; text-align: left; font-family: monospace; font-size: 11px; padding: 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; background: #fff; cursor: pointer; transition: all 0.2s;">
                          <strong style="color: #10b981; font-size: 12px;">🟢 1. เซิร์ฟเวอร์ Development (แนะนำขณะทดสอบ)</strong><br/>
                          https://ais-dev-oz7nezk4tpzgmervnkkonx-966862217040.asia-southeast1.run.app
                        </button>
                      </div>

                      <div style="margin-bottom: 16px;">
                        <button id="swal-btn-pre" type="button" style="width: 100%; text-align: left; font-family: monospace; font-size: 11px; padding: 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; background: #fff; cursor: pointer; transition: all 0.2s;">
                          <strong style="color: #3b82f6; font-size: 12px;">🔵 2. เซิร์ฟเวอร์ Production / Shared (เมื่อแชร์ลิงก์จริง)</strong><br/>
                          https://ais-pre-oz7nezk4tpzgmervnkkonx-966862217040.asia-southeast1.run.app
                        </button>
                      </div>

                      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                      
                      <div style="margin-bottom: 8px;">
                        <label style="font-weight: bold; color: #1e293b; display: block; margin-bottom: 4px;">หรือกำหนดลิงก์เซิร์ฟเวอร์แบบกำหนดเอง (Custom URL):</label>
                        <input id="swal-input-url" type="text" value="${currentApi}" placeholder="https://" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 12px;" />
                      </div>
                    </div>
                  `,
                  showCancelButton: true,
                  confirmButtonText: "บันทึกตั้งค่า",
                  cancelButtonText: "ยกเลิก",
                  didOpen: () => {
                    const devBtn = document.getElementById("swal-btn-dev");
                    const preBtn = document.getElementById("swal-btn-pre");
                    const inputEl = document.getElementById("swal-input-url") as HTMLInputElement;

                    // Mark selected border
                    const updateBorders = (selected: "dev" | "pre" | "custom") => {
                      if (devBtn) devBtn.style.borderColor = selected === "dev" ? "#10b981" : "#cbd5e1";
                      if (preBtn) preBtn.style.borderColor = selected === "pre" ? "#3b82f6" : "#cbd5e1";
                    };

                    const devUrl = "https://ais-dev-oz7nezk4tpzgmervnkkonx-966862217040.asia-southeast1.run.app";
                    const preUrl = "https://ais-pre-oz7nezk4tpzgmervnkkonx-966862217040.asia-southeast1.run.app";

                    if (inputEl.value === devUrl) updateBorders("dev");
                    else if (inputEl.value === preUrl) updateBorders("pre");
                    else updateBorders("custom");

                    if (devBtn && inputEl) {
                      devBtn.onclick = () => {
                        inputEl.value = devUrl;
                        updateBorders("dev");
                      };
                    }
                    if (preBtn && inputEl) {
                      preBtn.onclick = () => {
                        inputEl.value = preUrl;
                        updateBorders("pre");
                      };
                    }
                    if (inputEl) {
                      inputEl.oninput = () => {
                        if (inputEl.value === devUrl) updateBorders("dev");
                        else if (inputEl.value === preUrl) updateBorders("pre");
                        else updateBorders("custom");
                      };
                    }
                  },
                  preConfirm: () => {
                    const urlInput = (document.getElementById("swal-input-url") as HTMLInputElement).value.trim();
                    if (!urlInput) {
                      Swal.showValidationMessage("กรุณากรอกหรือเลือก URL เซิร์ฟเวอร์");
                      return false;
                    }
                    if (!urlInput.startsWith("http://") && !urlInput.startsWith("https://")) {
                      Swal.showValidationMessage("URL ต้องขึ้นต้นด้วย http:// หรือ https://");
                      return false;
                    }
                    return urlInput;
                  }
                }).then((result) => {
                  if (result.isConfirmed) {
                    const newUrl = result.value;
                    const cleanUrl = newUrl.endsWith("/") ? newUrl.slice(0, -1) : newUrl;
                    localStorage.setItem("backend_api_url", cleanUrl);
                    Swal.fire({
                      icon: "success",
                      title: "บันทึกตั้งค่าแล้ว",
                      text: `เปลี่ยนจุดเชื่อมต่อ API ไปที่ ${cleanUrl} แล้วระบบจะทำการโหลดข้อมูลใหม่`,
                      timer: 1500,
                      showConfirmButton: false
                    }).then(() => {
                      window.location.reload();
                    });
                  }
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-full font-semibold transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" className="animate-spin-slow"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>ตั้งค่าจุดเชื่อมต่อเซิร์ฟเวอร์ API</span>
            </button>
          </div>

          {/* Footer inside Left Form */}
          <div className="text-center text-[10px] text-slate-400 font-medium shrink-0 pt-4 leading-relaxed">
            © 2025 THAMC e-Material System <br />
            Hospital Administration Material Services
          </div>
        </div>

        {/* Right Side: Wallpaper */}
        <div className="hidden md:block md:w-[65%] lg:w-[72%] relative bg-[#1E1B4B] overflow-hidden shadow-[inset_20px_0_40px_rgba(0,0,0,0.5)]">
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
            alt="Medical Stock Background"
            className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-overlay scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#15133C] via-[#312E81]/80 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#15133C]/40 to-transparent"></div>

          <div className="absolute bottom-0 left-0 p-8 lg:p-16 xl:p-24 text-white w-full">
            <div className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wider mb-6 border border-white/30 shadow-lg select-none">
              INVENTORY MANAGEMENT PORTAL
            </div>
            <h2 className="text-4xl xl:text-6xl font-black mb-4 leading-snug drop-shadow-md">
              ศูนย์ระบบเบิกจ่ายและพัสดุแพทย์
            </h2>
            <p className="text-indigo-200 text-base xl:text-xl max-w-2xl font-light leading-relaxed drop-shadow">
              เพิ่มประสิทธิภาพใบเบิกพัสดุ สนับสนุนกระบวนการยา ปราศรหัสความคลาดเคลื่อน รวดเร็ว แม่นยำ และบูรณาการเพื่อความปลอดภัยในการดูแลรักษาสากล
            </p>
          </div>
        </div>
      </div>
    );
  }

  const matchesRoleApproval = ["Admin", "Manager", "Staff"].includes(currentUser.role);
  const matchesRoleStock = ["Admin", "Manager", "Staff"].includes(currentUser.role);
  const matchesRoleReceipt = ["Admin", "Manager", "Staff"].includes(currentUser.role);
  const matchesRoleReports = ["Admin", "Manager", "Staff"].includes(currentUser.role);
  const matchesRoleUsers = ["Admin"].includes(currentUser.role);

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans">
      {/* ─── SIDEBAR CONTAINER ─── */}
      <aside
        className={`bg-indigo-950 text-indigo-200 hidden md:flex flex-col shrink-0 transition-all duration-300 relative border-r border-indigo-900 shadow-2xl z-30 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Title branding header */}
        <div className="h-16 flex items-center justify-center border-b border-indigo-900 px-4 shrink-0 select-none">
          <ShoppingCart className="text-indigo-400 w-7 h-7 mr-3 shrink-0" />
          {!sidebarCollapsed && (
            <h1 className="text-lg font-black tracking-wider truncate text-white uppercase">THAMC e-Mat</h1>
          )}
        </div>

        {/* Sidebar scrolling items */}
        <div className="flex-1 overflow-y-auto py-5 custom-scrollbar">
          <nav className="space-y-1 px-3">
            <button
              onClick={() => setActiveTab("announcements")}
              className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                activeTab === "announcements"
                  ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                  : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
              }`}
              title="ประกาศข่าวสาร"
            >
              <Megaphone className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="ml-3 truncate">ประกาศข่าวสาร</span>}
            </button>

            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                activeTab === "dashboard"
                  ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                  : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
              }`}
              title="แดชบอร์ดสรุปยอด"
            >
              <PieChart className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="ml-3 truncate">แดชบอร์ดสรุปยอด</span>}
            </button>

            <div className={`pt-4 pb-1 select-none ${sidebarCollapsed ? "text-center" : "px-3"}`}>
              <span className="text-[10px] font-black tracking-wider text-indigo-400/80 uppercase">
                {sidebarCollapsed ? "---" : "ระบบปฏิบัติการ"}
              </span>
            </div>

            <button
              onClick={() => setActiveTab("requisition")}
              className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                activeTab === "requisition"
                  ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                  : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
              }`}
              title="สร้างใบเบิกวัสดุ"
            >
              <ShoppingCart className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="ml-3 truncate">สร้างใบเบิกวัสดุ</span>}
            </button>

            {matchesRoleApproval && (
              <button
                onClick={() => setActiveTab("approval")}
                className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                  activeTab === "approval"
                    ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                    : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
                }`}
                title="อนุมัติ / จ่ายพัสดุ"
              >
                <ClipboardCheck className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="ml-3 truncate flex items-center justify-between w-full">
                    <span>อนุมัติ / จ่ายพัสดุ</span>
                    {pendingApprovals.length > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full select-none animate-pulse">
                        {pendingApprovals.length}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )}

            {matchesRoleApproval && (
              <button
                onClick={() => setActiveTab("batchApproval")}
                className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                  activeTab === "batchApproval"
                    ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                    : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
                }`}
                title="อนุมัติพัสดุเป็นชุด"
              >
                <Layers className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 truncate">อนุมัติพัสดุเป็นชุด</span>}
              </button>
            )}

            <button
              onClick={() => setActiveTab("history")}
              className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                activeTab === "history"
                  ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                  : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
              }`}
              title="ประวัติการขอเบิก"
            >
              <History className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="ml-3 truncate">ประวัติการขอเบิก</span>}
            </button>

            {matchesRoleStock && (
              <button
                onClick={() => setActiveTab("stock")}
                className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                  activeTab === "stock"
                    ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                    : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
                }`}
                title="จัดการพัสดุในคลัง"
              >
                <Boxes className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 truncate">จัดการพัสดุในคลัง</span>}
              </button>
            )}

            {matchesRoleReceipt && (
              <button
                onClick={() => setActiveTab("goodsReceipt")}
                className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                  activeTab === "goodsReceipt"
                    ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                    : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
                }`}
                title="รับเข้าสต๊อกสินค้า"
              >
                <Truck className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 truncate">รับเข้าสต๊อกสินค้า</span>}
              </button>
            )}

            <div className={`pt-4 pb-1 select-none ${sidebarCollapsed ? "text-center" : "px-3"}`}>
              <span className="text-[10px] font-black tracking-wider text-indigo-400/80 uppercase">
                {sidebarCollapsed ? "---" : "สถิติและข้อมูล"}
              </span>
            </div>

            {matchesRoleReports && (
              <button
                onClick={() => setActiveTab("reports")}
                className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                  activeTab === "reports"
                    ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                    : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
                }`}
                title="ออกตารางรายงาน"
              >
                <BarChart3 className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 truncate">ออกตารางรายงาน</span>}
              </button>
            )}

            {matchesRoleUsers && (
              <button
                onClick={() => setActiveTab("adminUsers")}
                className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                  activeTab === "adminUsers"
                    ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                    : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
                }`}
                title="จัดการสิทธิ์เจ้าหน้าที่"
              >
                <Users className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 truncate">จัดการสิทธิ์เจ้าหน้าที่</span>}
              </button>
            )}

            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full py-2.5 px-3 rounded-lg flex items-center transition-colors text-sm font-semibold select-none ${
                activeTab === "profile"
                  ? "bg-indigo-800 text-white border-l-4 border-l-emerald-500 font-bold"
                  : "hover:bg-indigo-900 text-indigo-200 hover:text-white"
              }`}
              title="ข้อมูลส่วนตัวของฉัน"
            >
              <UserIcon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="ml-3 truncate">ข้อมูลส่วนตัวของฉัน</span>}
            </button>
          </nav>
        </div>

        {/* Sidebar Logouts buttons */}
        <div className="p-4 border-t border-indigo-900 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-3 rounded-lg text-indigo-300 hover:text-white hover:bg-rose-500/10 transition-colors flex items-center text-sm font-bold select-none"
            title="ออกจากระบบ"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="ml-3 truncate">ออกจากระบบ</span>}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE BOTTOM TAB NAVIGATION BAR ─── */}
      <nav className="bg-indigo-950 text-indigo-200 fixed bottom-0 left-0 right-0 grid grid-cols-5 md:hidden z-40 border-t border-indigo-900 shadow-2xl pb-safe">
        <button
          onClick={() => setActiveTab("announcements")}
          className={`flex flex-col items-center justify-center py-2.5 select-none ${
            activeTab === "announcements" ? "text-white bg-indigo-900 font-bold" : ""
          }`}
        >
          <Megaphone className="w-5 h-5" />
          <span className="text-[10px] mt-1">ประกาศ</span>
        </button>

        <button
          onClick={() => setActiveTab("requisition")}
          className={`flex flex-col items-center justify-center py-2.5 select-none ${
            activeTab === "requisition" ? "text-white bg-indigo-900 font-bold" : ""
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] mt-1">สร้างใบเบิก</span>
        </button>

        {matchesRoleApproval ? (
          <button
            onClick={() => setActiveTab("approval")}
            className={`flex flex-col items-center justify-center py-2.5 relative select-none ${
              activeTab === "approval" ? "text-white bg-indigo-900 font-bold" : ""
            }`}
          >
            <ClipboardCheck className="w-5 h-5" />
            <span className="text-[10px] mt-1">อนุมัติ</span>
            {pendingApprovals.length > 0 && (
              <span className="absolute right-3 top-1.5 bg-orange-500 text-white text-[9px] px-1 rounded-full font-bold select-none scale-90">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center justify-center py-2.5 select-none ${
              activeTab === "dashboard" ? "text-white bg-indigo-900 font-bold" : ""
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] mt-1">แดชบอร์ด</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("history")}
          className={`flex flex-col items-center justify-center py-2.5 select-none ${
            activeTab === "history" ? "text-white bg-indigo-900 font-bold" : ""
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] mt-1">ประวัติ</span>
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center justify-center py-2.5 select-none ${
            activeTab === "profile" ? "text-white bg-indigo-900 font-bold" : ""
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px] mt-1">ฉัน</span>
        </button>
      </nav>

      {/* ─── MAIN WORKING CONTAINER ─── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 z-20 shrink-0 shadow-sm relative">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex text-slate-500 hover:text-indigo-600 focus:outline-none p-2 rounded-lg hover:bg-slate-100 transition-colors select-none"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight ml-2">
              {activeTab === "announcements" && "หลักข่าวสารประชาสัมพันธ์"}
              {activeTab === "dashboard" && "ข้อมูลสรุปยอดพัสดุและคลัง"}
              {activeTab === "requisition" && "ยื่นใบเบิกวัสดุ"}
              {activeTab === "approval" && "กล่องพิจารณาจ่ายวัสดุ"}
              {activeTab === "batchApproval" && "อนุมัติสรุปเป็นชุดประมวลผล"}
              {activeTab === "history" && "ประวัติใบเบิก"}
              {activeTab === "stock" && "จัดการคลังแคตตาล็อก"}
              {activeTab === "goodsReceipt" && "นำเข้าอุปกรณ์และรับสต๊อกสินค้า"}
              {activeTab === "reports" && "สรุปวิเคราะห์ข้อมูล"}
              {activeTab === "adminUsers" && "จัดการสิทธิ์ผู้ใช้"}
              {activeTab === "profile" && "ข้อมูลผู้ใช้"}
            </h1>
          </div>

          {/* Right Header User Avatar Card */}
          <div className="relative shrink-0 select-none">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center text-slate-700 hover:text-indigo-600 focus:outline-none px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-all font-semibold"
            >
              <div className="text-right mr-3 hidden sm:block leading-tight">
                <p className="text-sm font-extrabold text-slate-800">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{currentUser.role}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-205 flex items-center justify-center font-bold text-indigo-600 shadow-inner">
                {currentUser.name ? currentUser.name.slice(0, 1).toUpperCase() : "U"}
              </div>
            </button>

            {/* Float Dropdowns */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl py-2 z-50 border border-slate-200 origin-top-right">
                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setUserDropdownOpen(false);
                  }}
                  className="w-full text-left flex items-center px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm font-semibold select-none"
                >
                  <UserIcon className="w-4 h-4 mr-2 text-slate-400" />
                  ข้อมูลพนักงานของฉัน
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center px-4 py-2 hover:bg-rose-50 text-rose-600 border-t border-slate-100 text-sm font-bold select-none"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Main body content pages */}
        <main className="flex-grow overflow-y-auto p-4 sm:p-6 bg-slate-50/50 pb-20 md:pb-6 custom-scrollbar relative z-10">
          {activeTab === "announcements" && <AnnouncementsTab />}

          {activeTab === "dashboard" && (
            <DashboardTab onRefreshTrigger={() => setRefreshTrigger((prev) => prev + 1)} />
          )}

          {activeTab === "requisition" && <RequisitionTab currentUser={currentUser} />}

          {activeTab === "approval" && (
            <div className="max-w-7xl mx-auto animate-fade-in p-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">กล่องใบเบิกพัสดุรอพิจารณา</h2>
                  <p className="text-slate-500 text-xs mt-1">คัดแต่งรายละเอียด ยอดสต๊อก และยอดเบิกค้างจ่ายเพื่ออนุมัติ</p>
                </div>

                <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1.5 items-center shrink-0">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide px-2 border-r border-slate-200">
                    กรองตามสถานะ:
                  </span>
                  <select
                    className="bg-transparent text-slate-700 font-bold focus:outline-none text-xs px-2 cursor-pointer focus:ring-0"
                    value={approvalFilterStatus}
                    onChange={(e) => setApprovalStatusFilter(e.target.value)}
                  >
                    <option value="all">-- ทุกแผ่นรายการที่มุ่งหมาย --</option>
                    <option value="Pending Manager Approval">ยอดอนุมัติผู้จัดการ</option>
                    <option value="Pending Stock Approval">ยอดอนุมัติคลังสินค้า</option>
                    <option value="Partially Completed">รายการติดค้างเบิกคลัง</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-sm">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50/50">
                    <tr className="font-bold text-slate-500 text-xs">
                      <th className="px-6 py-4 text-left">เลขที่เอกสาร</th>
                      <th className="px-6 py-4 text-left">วันที่ยื่นคำขอ</th>
                      <th className="px-6 py-4 text-left">ผู้ยื่นเบิกพัสดุ (สังกัดแผนก)</th>
                      <th className="px-6 py-4 text-left">ขั้นตอนในระบบ</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {loadingApprovals ? (
                      <tr>
                        <td colSpan={5} className="text-center py-16">
                          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                          <p className="text-slate-500 font-semibold">กำลังตรวจสอบสตรีมเอกสาร...</p>
                        </td>
                      </tr>
                    ) : pendingApprovals.filter(a => approvalFilterStatus === "all" || a.status === approvalFilterStatus).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-16 text-slate-400">
                          <CheckCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                          ยอดเบิกพัสดุกล่องจดหมายงานตรงคัดกรอง เคลียร์สำเร็จทั้งหมดไม่มีคงค้าง
                        </td>
                      </tr>
                    ) : (
                      pendingApprovals
                        .filter((req) => approvalFilterStatus === "all" || req.status === approvalFilterStatus)
                        .map((req) => {
                          let styleLabel = "text-indigo-700 bg-indigo-50 border-indigo-200";
                          let btnText = "พิจารณาอนุมัติ";
                          if (req.status === "Partially Completed") {
                            styleLabel = "text-amber-700 bg-amber-50 border-amber-200";
                            btnText = "จ่ายพัสดุค้างคา";
                          }

                          return (
                            <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4 font-semibold text-slate-800">{req.id}</td>
                              <td className="px-6 py-4 text-slate-500">{formatDateForDisplay(req.date)}</td>
                              <td className="px-6 py-4">
                                <span className="font-semibold text-slate-800 block">{req.requestorName}</span>
                                <span className="text-xs text-slate-400 block">{req.requestorDepartment}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-block px-3 py-1 text-xs border rounded-full font-bold uppercase tracking-wide text-center shrink-0 ${styleLabel}`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleOpenReqDetails(req.id, true)}
                                  className="px-4 py-1.5 border border-slate-350 hover:bg-indigo-50 text-indigo-600 rounded-lg shadow-sm font-bold text-xs inline-flex items-center transition-all bg-white"
                                >
                                  <FileText className="w-3.5 h-3.5 mr-1" />
                                  {btnText}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "batchApproval" && <BatchApprovalTab />}

          {activeTab === "history" && (
            <HistoryTab
              currentUser={currentUser}
              onOpenDetails={(id) => handleOpenReqDetails(id, false)}
              departments={departments}
            />
          )}

          {activeTab === "stock" && (
            <StockTab
              currentUser={currentUser}
              onRefreshTrigger={() => setRefreshTrigger((prev) => prev + 1)}
            />
          )}

          {activeTab === "goodsReceipt" && (
            <GoodsReceiptTab
              currentUser={currentUser}
              onRefreshStock={() => setRefreshTrigger((prev) => prev + 1)}
            />
          )}

          {activeTab === "reports" && <ReportsTab currentUser={currentUser} departments={departments} />}

          {activeTab === "adminUsers" && (
            <AdminUsersTab currentUser={currentUser} departments={departments} />
          )}

          {activeTab === "profile" && (
            <ProfileTab
              currentUser={currentUser}
              departments={departments}
              onProfileUpdated={(updated) => {
                setCurrentUser(updated);
                localStorage.setItem("currentUser", JSON.stringify(updated));
              }}
            />
          )}
        </main>
      </div>

      {/* ─── [MODAL DETAIL DIALOG CONTAINER] ─── */}
      {detailModalOpen && selectedReqId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-auto max-h-[96vh] flex flex-col overflow-hidden border border-slate-205 animate-scale-up">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0 select-none">
              <h3 className="text-xl font-black text-slate-805">
                กล่องข้อมูลพิจารณาใบเบิกพัสดุ:{" "}
                <span className="font-mono text-indigo-600 bg-indigo-50 px-3 py-1 border border-indigo-100/50 rounded-lg shadow-sm text-lg inline-block ml-1">
                  #{selectedReqId}
                </span>
              </h3>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 font-bold hover:bg-slate-100 rounded-full h-8 w-8 flex items-center justify-center text-2xl transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-20 text-center flex-1">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-bold">กำลังเชื่อมต่อดาวน์โหลดข้อมูลพัสดุ...</p>
              </div>
            ) : currentReqDetail ? (
              <>
                {/* Modal main scrolls body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar text-sm">
                  {/* Status Process Tracker representation */}
                  <div className="grid grid-cols-4 gap-4 px-2 py-4 bg-slate-50 rounded-2xl border border-slate-205/60 shadow-inner mb-6 text-center select-none">
                    {/* Position 1 */}
                    <div className="relative flex flex-col items-center">
                      <div className="h-10 w-10 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold relative z-10 border-2 border-white shadow">
                        1
                      </div>
                      <span className="mt-2 text-xs font-bold text-slate-800 block">ยื่นขอเบิกพัสดุ</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 whitespace-pre">
                        {currentReqDetail.requisition.requestorName}
                      </span>
                    </div>

                    {/* Position 2 */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center font-bold relative z-10 border-2 border-white shadow ${
                          currentReqDetail.requisition.managerApprovalDate
                            ? "bg-emerald-500 text-white"
                            : currentReqDetail.requisition.status === "Pending Manager Approval"
                            ? "bg-orange-500 text-white border-orange-300 animate-pulse"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        2
                      </div>
                      <span className="mt-2 text-xs font-bold text-slate-800 block">อนุมัติโดย ผจก.</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
                        {currentReqDetail.requisition.managerApprovalStatus || "รอพิจารณา"}
                      </span>
                    </div>

                    {/* Position 3 */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center font-bold relative z-10 border-2 border-white shadow ${
                          currentReqDetail.requisition.stockApprovalDate
                            ? "bg-emerald-500 text-white"
                            : currentReqDetail.requisition.status === "Pending Stock Approval"
                            ? "bg-amber-500 text-white border-amber-300 animate-pulse"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        3
                      </div>
                      <span className="mt-2 text-xs font-bold text-slate-800 block">จ่ายพัสดุโดยคลัง</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
                        {currentReqDetail.requisition.stockApprovalStatus || "รอพิจารณา"}
                      </span>
                    </div>

                    {/* Position 4 */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center font-bold relative z-10 border-2 border-white shadow ${
                          currentReqDetail.requisition.status === "Completed"
                            ? "bg-emerald-500 text-white"
                            : currentReqDetail.requisition.status === "Partially Completed"
                            ? "bg-sky-505 bg-sky-500 text-white text-center border-sky-300 animate-pulse"
                            : currentReqDetail.requisition.status.includes("Rejected")
                            ? "bg-rose-500 text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        4
                      </div>
                      <span className="mt-2 text-xs font-bold text-slate-850 block">สถานะสิ้นสุด</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {currentReqDetail.requisition.status === "Completed"
                          ? "จ่ายสำเร็จสิ้น"
                          : currentReqDetail.requisition.status === "Partially Completed"
                          ? "มีรายการค้างจ่าย"
                          : currentReqDetail.requisition.status.includes("Rejected")
                          ? "ถูกปฏิเสธใบเบิก"
                          : "กำลังประมวลผล"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-white p-4 rounded-xl border border-slate-205 shadow-sm">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">วันที่เบิกใช้พัสดุ:</p>
                      <p className="font-extrabold text-slate-820">{formatDateForDisplay(currentReqDetail.requisition.date)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">ผู้ยื่นคำสั่งเบิก:</p>
                      <p className="font-extrabold text-slate-820">
                        {currentReqDetail.requisition.requestorName}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          ({currentReqDetail.requisition.requestorDepartment})
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">วัตถุประสงค์:</p>
                      <p className="text-slate-650 whitespace-pre-wrap leading-relaxed max-h-16 overflow-y-auto">
                        {currentReqDetail.requisition.purpose}
                      </p>
                    </div>
                  </div>

                  {/* Materials items table list */}
                  <h4 className="text-md font-extrabold text-slate-800 mb-3 border-b pb-1.5 flex items-center">
                    <FileText className="w-5 h-5 text-indigo-650 mr-2" />
                    ตารางรายละเอียดความต้องการสินค้าพัสดุ
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">รหัส</th>
                          <th className="px-3 py-2 text-left">ชื่อพัสดุเวชภัณฑ์แพทย์</th>
                          <th className="px-3 py-2 text-center">ยอดของเบิก</th>
                          <th className="px-3 py-2 text-center">สต๊อกคลัง</th>
                          <th className="px-3 py-2 text-right">ราคาต่อหน่วย</th>
                          <th className="px-3 py-2 text-center bg-indigo-50 text-indigo-900 w-32">จำนวนส่งมอบ</th>
                          <th className="px-3 py-2 text-center w-40">สถานะรายการเบิก / หมายเหตุ</th>
                          <th className="px-3 py-2 text-right">ยอดรวมย่อ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {currentReqDetail.items.map((item) => {
                          const isCurrentlyBackordered = item.isBackordered;
                          const requestedQty = parseInt(item.quantity as any) || 0;
                          const maxStockValueInคลัง = item.currentInventoryQuantity || 0;
                          const dispensedAlreadyValue = parseInt(item.dispensedQuantity as any) || 0;

                          const isManagerApp = currentReqDetail.requisition.status === "Pending Manager Approval" && ["Admin", "Manager"].includes(currentUser?.role || "");
                          const isStockApp = currentReqDetail.requisition.status === "Pending Stock Approval" && ["Admin", "Manager", "Staff"].includes(currentUser?.role || "");
                          const isFulfillBack = currentReqDetail.requisition.status === "Partially Completed" && ["Admin", "Staff"].includes(currentUser?.role || "");

                          const isInputReadOnly = !(isManagerApp || isStockApp || isFulfillBack);

                          const itemPriceValue = parseFloat(item.UnitPrice as any) || 0;
                          const currentDispensedValInHand = dispensedQuantities[item.itemId] || 0;
                          const lineItemPriceCalculatedTotal = currentDispensedValInHand * itemPriceValue;

                          return (
                            <tr
                              key={item.itemId}
                              className={`align-top hover:bg-slate-50/50 ${
                                isCurrentlyBackordered && isFulfillBack ? "bg-amber-50/10" : ""
                              }`}
                            >
                              <td className="px-3 py-3 font-mono text-slate-450">{item.itemCode || "N/A"}</td>
                              <td className="px-3 py-3">
                                <p className="font-extrabold text-slate-800 text-xs sm:text-sm">{item.itemName}</p>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  หน่วย: {item.unit || "ชิ้น"} | พื้นที่คลัง: {item.location || "N/A"}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center font-bold text-slate-700">{requestedQty}</td>
                              <td
                                className={`px-3 py-3 text-center font-bold ${
                                  maxStockValueInคลัง <= 0 ? "text-rose-500 bg-rose-50 rounded" : "text-emerald-600"
                                }`}
                              >
                                {maxStockValueInคลัง}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-500 font-mono">
                                {formatNumber(itemPriceValue)}
                              </td>
                              <td className="px-3 py-3 text-center bg-indigo-50/20">
                                <input
                                  type="number"
                                  disabled={isInputReadOnly}
                                  className={`w-20 px-2 py-1 border text-center font-black rounded focus:outline-none ${
                                    isInputReadOnly
                                      ? "bg-slate-105 bg-slate-100 max border-slate-200 text-slate-550 shadow-inner"
                                      : "bg-white border-indigo-200 focus:ring-1 focus:ring-indigo-400 text-indigo-600"
                                  }`}
                                  value={currentDispensedValInHand}
                                  min={0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    let maxAllowed = maxStockValueInคลัง;
                                    if (isStockApp) {
                                      maxAllowed = Math.min(dispensedAlreadyValue, maxStockValueInคลัง);
                                    } else if (isFulfillBack) {
                                      const remainingToFulfill = requestedQty - dispensedAlreadyValue;
                                      maxAllowed = Math.min(remainingToFulfill, maxStockValueInคลัง);
                                    }

                                    let finalVal = val;
                                    if (val < 0) finalVal = 0;
                                    if (val > maxAllowed) {
                                      Toast.fire({
                                        icon: "warning",
                                        title: `จำนวนจ่ายต้องไม่เกินข้อจำกัดระบบสูงสุด (${maxAllowed})`,
                                      });
                                      finalVal = maxAllowed;
                                    }

                                    setDispensedQuantities({
                                      ...dispensedQuantities,
                                      [item.itemId]: finalVal,
                                    });
                                  }}
                                />
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex flex-col items-center">
                                  {!(isManagerApp || isStockApp) ? (
                                    item.isBackordered ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                        ค้างจ่าย (Backorder)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        ส่งมอบปกติ
                                      </span>
                                    )
                                  ) : (
                                    <label className="flex items-center cursor-pointer text-xs font-semibold text-rose-600 select-none pb-1 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors w-full justify-center">
                                      <input
                                        type="checkbox"
                                        className="mr-1.5 h-3.5 w-3.5 border-slate-300 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                        checked={itemBackorders[item.itemId] || false}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setItemBackorders({
                                            ...itemBackorders,
                                            [item.itemId]: checked,
                                          });

                                          if (checked) {
                                            // Backorder means dispensing zero in this step
                                            setDispensedQuantities({
                                              ...dispensedQuantities,
                                              [item.itemId]: 0,
                                            });
                                          } else {
                                            // Reset back to requested quantity or stock limit
                                            const originalMaxStock = item.currentInventoryQuantity || 0;
                                            setDispensedQuantities({
                                              ...dispensedQuantities,
                                              [item.itemId]: Math.min(requestedQty, originalMaxStock),
                                            });
                                          }
                                        }}
                                      />
                                      ค้างจ่าย
                                    </label>
                                  )}

                                  {/* Item specific notes */}
                                  {!(isManagerApp || isStockApp || isFulfillBack) ? (
                                    item.notesForItem && (
                                      <p className="text-[10px] text-slate-500 bg-slate-50 p-1 border rounded italic mt-1 leading-snug w-full max-w-[140px] truncate" title={item.notesForItem}>
                                        {item.notesForItem}
                                      </p>
                                    )
                                  ) : (
                                    <input
                                      type="text"
                                      placeholder="สาเหตุจ่ายไม่ครบ..."
                                      className="w-full text-[10px] px-1.5 py-1 border border-slate-200 rounded mt-1 bg-slate-50 focus:bg-white focus:outline-none"
                                      value={itemNotes[item.itemId] || ""}
                                      onChange={(e) =>
                                        setItemNotes({
                                          ...itemNotes,
                                          [item.itemId]: e.target.value,
                                        })
                                      }
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-slate-700">
                                {formatNumber(lineItemPriceCalculatedTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                          <td colSpan={7} className="px-3 py-3 text-right">
                            รวมมูลค่าสินค้าจ่าย (ครั้งนี้):
                          </td>
                          <td className="px-3 py-3 text-right text-emerald-600 text-sm font-black font-mono">
                            ฿
                            {formatNumber(
                              Object.keys(dispensedQuantities).reduce((acc, key) => {
                                const itemObj = currentReqDetail.items.find((i) => i.itemId === key);
                                const q = dispensedQuantities[key] || 0;
                                const p = parseFloat(itemObj?.UnitPrice as any) || 0;
                                return acc + q * p;
                              }, 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Related PDF printed links */}
                <div className="bg-indigo-50/40 p-4 border-t border-indigo-100 select-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-indigo-900 border-r border-indigo-200 pr-2 shrink-0">
                      เอกสารรับ-จ่ายประวัติแนบ (PDF):
                    </span>
                    {currentReqDetail.requisition.RequisitionPDFLink ? (
                      <a
                        href={resolveApiUrl(currentReqDetail.requisition.RequisitionPDFLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-bold bg-white text-indigo-650 hover:bg-slate-50 border border-slate-250 px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        <FileText className="w-4 h-4 text-rose-500 mr-1.5" />
                        ใบเบิกพัสดุหลัก
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">ไม่พบเอกสารใบเบิก</span>
                    )}

                    {(currentReqDetail.requisition.GoodsIssuePDFLinks || []).map((gi) => (
                      <a
                        key={gi.id}
                        href={resolveApiUrl(gi.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-bold bg-white text-emerald-700 hover:bg-slate-50 border border-slate-250 px-3 py-1.5 rounded-lg shadow-sm animate-scale-up"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-500 mr-1.5" />
                        {gi.type} ({gi.id})
                      </a>
                    ))}
                  </div>

                  {/* Actions buttons conditional on users role matches */}
                  {(() => {
                    const status = currentReqDetail.requisition.status;
                    const isManagerApp = status === "Pending Manager Approval" && ["Admin", "Manager"].includes(currentUser?.role || "");
                    const isStockApp = status === "Pending Stock Approval" && ["Admin", "Manager", "Staff"].includes(currentUser?.role || "");
                    const isFulfillBack = status === "Partially Completed" && ["Admin", "Staff"].includes(currentUser?.role || "");

                    if (isManagerApp || isStockApp || isFulfillBack) {
                      return (
                        <div className="bg-slate-100 border border-slate-200/60 p-4 rounded-xl shadow-sm flex flex-col gap-3 w-full">
                          <div className="flex items-center space-x-2 border-b pb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                              ส่วนพิจารณาของผู้อนุมัติ:
                            </span>
                            <span className="text-[10px] font-black text-indigo-650 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded leading-none shrink-0 font-sans uppercase">
                              {currentUser?.role}
                            </span>
                          </div>

                          <textarea
                            rows={1}
                            placeholder="พิมพ์ระบุหมายเหตุการจัดตรวจ หรือรายละเอียดจ่ายของ... (จำเป็นหากกดไม่อนุมัติ)"
                            className="w-full bg-white border border-slate-350 focus:ring-2 focus:ring-indigo-500 rounded-lg p-2.5 text-xs text-slate-700"
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                          />

                          <div className="flex flex-col sm:flex-row justify-end gap-2.5 mt-1">
                            {/* Rejected options only for non-partially completed logs */}
                            {!isFulfillBack && (
                              <button
                                type="button"
                                disabled={savingApproval}
                                onClick={() => handleSaveApprovalDecision("Rejected")}
                                className="flex-1 sm:flex-none btn bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-6 rounded-lg text-xs"
                              >
                                ปฏิเสธไม่อนุมัติใบเบิก
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={savingApproval}
                              onClick={() => handleSaveApprovalDecision("Approved")}
                              className="flex-1 sm:flex-none btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-8 rounded-lg text-xs shadow-md transition-all duration-300"
                            >
                              {savingApproval ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto mr-1" />
                              ) : (
                                "ยืนยันการจ่าย / อนุมัติเบิกพัสดุ"
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Force Complete action for Managers / Admins
                    if (status === "Partially Completed" && ["Admin", "Manager"].includes(currentUser?.role || "")) {
                      return (
                        <div className="w-full sm:w-auto text-right">
                          <button
                            type="button"
                            onClick={() => handleForceComplete(currentReqDetail.requisition.id)}
                            className="w-full sm:w-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow rounded-lg transition-all"
                          >
                            บังคับปิดงานใบเบิก (Force Complete)
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </>
            ) : (
              <div className="p-20 text-center text-rose-500 font-bold bg-white rounded-b-2xl">
                ไม่พบข้อมูลพัสดุของใบเบิกนี้!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOCAL BATCH APPROVAL COMPONENT ───
// Self-Contained Batch Approval Component inline inside App component for React compactness
function BatchApprovalTab() {
  const [level, setLevel] = useState<"manager" | "stock">("manager");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [expandedReqIds, setExpandedReqIds] = useState<Record<string, boolean>>({});
  const [draftItems, setDraftItems] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    setStartDate(firstDay);
    setEndDate(today);
  }, []);

  useEffect(() => {
    setRequisitions([]);
    setCheckedIds({});
    setExpandedReqIds({});
    setDraftItems({});
  }, [level]);

  const handleFetchBatch = async () => {
    setLoading(true);
    setRequisitions([]);
    setCheckedIds({});
    setExpandedReqIds({});
    try {
      const filters = { level, startDate, endDate };
      // Access currentUser from GAE or local window
      const stored = localStorage.getItem("currentUser");
      const userObj = stored ? JSON.parse(stored) : null;

      const data = await runScript("getRequisitionsForBatchApproval", filters, userObj);
      if (data.error) {
         Swal.fire("ข้อผิดพลาด", data.message, "error");
         return;
      }
      setRequisitions(data || []);

      // Populate initial drafts
      const initialDraft: Record<string, any[]> = {};
      (data || []).forEach((req: any) => {
        initialDraft[req.id] = (req.items || []).map((itm: any) => ({
          itemId: itm.itemId,
          itemName: itm.itemName,
          unit: itm.unit,
          dispensedQuantity: level === "stock" ? Math.min(itm.quantity || 0, itm.currentInventoryQuantity || 0) : (itm.quantity || 0),
          isBackordered: level === "stock" ? (itm.currentInventoryQuantity || 0) < (itm.quantity || 0) : false,
          itemNote: itm.notesForItem || ""
        }));
      });
      setDraftItems(initialDraft);
    } catch (e: any) {
      Swal.fire("ดึงข้อมูลขัดข้อง", e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDraft = (reqId: string, itemId: string, field: string, value: any) => {
    setDraftItems((prev) => {
      const list = prev[reqId] || [];
      const updated = list.map((itm) => {
        if (itm.itemId === itemId) {
          const newItm = { ...itm, [field]: value };
          if (field === "dispensedQuantity") {
            const reqQty = requisitions.find((r) => r.id === reqId)?.items?.find((i: any) => i.itemId === itemId)?.quantity || 0;
            newItm.isBackordered = Number(value) < reqQty;
          }
          return newItm;
        }
        return itm;
      });
      return { ...prev, [reqId]: updated };
    });
  };

  const toggleRow = (id: string) => {
    setExpandedReqIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const newChecked: Record<string, boolean> = {};
    requisitions.forEach((r) => {
      newChecked[r.id] = checked;
    });
    setCheckedIds(newChecked);
  };

  const handleProcessBatch = async (decision: "Approved" | "Rejected") => {
    const selectedIds = Object.keys(checkedIds).filter((key) => checkedIds[key]);
    if (selectedIds.length === 0) {
      Swal.fire("เลือกใบเบิกก่อน", "กรุณาเลือกใบเบิกพัสดุอย่างน้อย 1 รายการในการทำรายการชุด", "warning");
      return;
    }

    const stored = localStorage.getItem("currentUser");
    const userObj = stored ? JSON.parse(stored) : null;
    if (!userObj) return;

    let notes = `Batch ${decision} by ${userObj.name}`;
    const actionText = decision === "Approved" ? "อนุมัติ" : "ปฏิเสธไม่อนุมัติ";

    if (decision === "Rejected") {
      const { value: reason } = await Swal.fire({
        title: `ระบุเหตุผลในการไม่อนุมัติทั้ง ${selectedIds.length} ใบเบิก`,
        input: "textarea",
        inputLabel: "สาเหตุการปฏิเสธยอดรวมชุด (จะใช้สาเหตุนี้แชร์ไปทุกใบเบิกพวงกัน):",
        showCancelButton: true,
        inputValidator: (v) => !v && "กรุณาระบุความคิดเห็นการปฏิเสธเพื่อการปรับปรุงข้อมูล",
      });
      if (!reason) return;
      notes = reason;
    } else {
       const confirm = await Swal.fire({
          title: `อนุมัติจ่ายพัสดุ ${selectedIds.length} รายการ?`,
          text: `คุณพึงเห็นพ้องอนุมัติเบิกพัสดุทั้งหมดตามสิทธิ์ชุดประมวลผลหรือไม่? ยอดจ่ายจริงตามที่กรอกจะถูกบันทึกเข้าระบบ`,
          icon: "info",
          showCancelButton: true,
          confirmButtonColor: "#059669",
          confirmButtonText: "ยินยอมอนุมัติทั้งกล่อง",
          cancelButtonText: "ยกเลิก",
       });
       if (!confirm.isConfirmed) return;
    }

    setLoading(true);
    try {
      const res = await runScript("processBatchApproval", selectedIds, userObj.username, level, decision, notes, draftItems);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "อนุมัติแบบชุดสำเร็จ!",
          text: `ทำรายงาน ${actionText} ประมวลผลจำนวน ${res.processedCount} ใบเบิกสำเร็จสมบูรณ์`,
          confirmButtonColor: "#059659",
        });
        handleFetchBatch();
      } else {
        Swal.fire("การทำงานชุดขัดข้อง", res.message || "Unknown error", "error");
      }
    } catch (e: any) {
      Swal.fire("ระบบมีข้อบกพร่อง", e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const isAllChecked = requisitions.length > 0 && requisitions.every((r) => checkedIds[r.id]);

  return (
    <div className="max-w-7xl mx-auto p-2 animate-fade-in text-sm font-normal">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-extrabold text-slate-805 flex items-center">
            <Layers className="w-5 h-5 text-indigo-650 mr-2" />
            อนุมัติใบเบิกพัสดุเป็นชุด (Batch Approval Workspace)
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                ขอบเขตสิทธิ์การตรวจสอบ
              </label>
              <select
                className="w-full bg-white border border-slate-350 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 focus:outline-none"
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
              >
                <option value="manager">สิทธิ์อนุมัติผู้จัดการชั้นบริหาร (Manager Level)</option>
                <option value="stock">สิทธิ์จัดคลังจ่ายวัสดุจริง (Stock dispatcher Level)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                จากวันที่ส่งเบิก
              </label>
              <input
                type="date"
                className="w-full bg-white border border-slate-350 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 focus:outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                ถึงวันที่ส่งเบิก
              </label>
              <input
                type="date"
                className="w-full bg-white border border-slate-350 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 focus:outline-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleFetchBatch}
              disabled={loading}
              className="flex items-center text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-lg shadow-md transition-all shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  กำลังค้นหา...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-1.5" />
                  ประมวลผลค้นหาเป้าหมาย
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grid result actions checks */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/50">
              <tr className="font-bold text-slate-500 text-xs">
                <th className="px-5 py-3 text-center w-14">
                  <input
                    type="checkbox"
                    checked={isAllChecked}
                    onChange={handleToggleSelectAll}
                    className="h-4.5 w-4.5 border-slate-300 rounded text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 w-12"></th>
                <th className="px-5 py-3 text-left">เลขที่ใบเบิก</th>
                <th className="px-5 py-3 text-left">วันที่ยื่นขอเบิก</th>
                <th className="px-5 py-3 text-left">สายผู้เบิก (แผนกงานสังกัด)</th>
                <th className="px-5 py-3 text-left">วัตถุประสงค์โดยย่อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold">ระบบกำลังสตรีมลิสต์ใบเบิกพัสดุชุด...</p>
                  </td>
                </tr>
              ) : requisitions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium bg-white">
                    <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    ไม่พบรายการใบเบิกรอขอบเขตและช่วงเวลานี้
                  </td>
                </tr>
              ) : (
                requisitions.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={checkedIds[req.id] || false}
                          onChange={(e) => {
                            setCheckedIds({
                              ...checkedIds,
                              [req.id]: e.target.checked,
                            });
                          }}
                          className="h-4.5 w-4.5 border-slate-300 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer select-none"
                        />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <button
                          onClick={() => toggleRow(req.id)}
                          className="text-indigo-605 hover:text-indigo-805 transition-colors p-1.5 rounded hover:bg-slate-100"
                        >
                          {expandedReqIds[req.id] ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">
                        <div className="flex items-center space-x-2">
                          <span>{req.id}</span>
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                            {req.items?.length || 0} รายการ
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDateForDisplay(req.date)}</td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-800 block">{req.requestorName}</span>
                        <span className="text-xs text-slate-400 block">{req.requestorDepartment}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-450 truncate max-w-xs" title={req.purpose}>
                        {req.purpose}
                      </td>
                    </tr>

                    {expandedReqIds[req.id] && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={6} className="px-6 py-4 border-l-4 border-indigo-500 bg-indigo-50/5">
                          <div className="bg-white p-5 rounded-xl border border-slate-200 mt-1 mb-2 shadow-sm">
                            <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center">
                              <ClipboardList className="w-4.5 h-4.5 text-indigo-600 mr-2" />
                              ตรวจสอบยอดจัดจ่ายรายรายการวัสดุ (ใบเบิก #{req.id})
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-slate-200 text-xs">
                                <thead>
                                  <tr className="text-slate-500 font-bold bg-slate-50/80">
                                    <th className="px-3 py-2.5 text-left rounded-l-lg">รหัสพัสดุ</th>
                                    <th className="px-3 py-2.5 text-left">ชื่อพัสดุ</th>
                                    <th className="px-3 py-2.5 text-center">คงเหลือในคลัง</th>
                                    <th className="px-3 py-2.5 text-center">จำนวนขอเบิก</th>
                                    <th className="px-3 py-2.5 text-center w-28">จำนวนจ่ายจริง</th>
                                    <th className="px-3 py-2.5 text-center w-28">ค้างจ่าย (Backorder)</th>
                                    <th className="px-3 py-2.5 text-left rounded-r-lg">หมายเหตุรายการ</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {(req.items || []).map((item: any) => {
                                    const draftList = draftItems[req.id] || [];
                                    const draft = draftList.find((d: any) => d.itemId === item.itemId) || {
                                      dispensedQuantity: level === "stock" ? Math.min(item.quantity || 0, item.currentInventoryQuantity || 0) : (item.quantity || 0),
                                      isBackordered: level === "stock" ? (item.currentInventoryQuantity || 0) < (item.quantity || 0) : false,
                                      itemNote: ""
                                    };

                                    return (
                                      <tr key={item.itemId} className="hover:bg-slate-50/55">
                                        <td className="px-3 py-3 font-mono text-slate-500">{item.itemCode || "N/A"}</td>
                                        <td className="px-3 py-3 font-medium text-slate-800">{item.itemName}</td>
                                        <td className="px-3 py-3 text-center font-bold text-indigo-600">
                                          {item.currentInventoryQuantity} {item.unit}
                                        </td>
                                        <td className="px-3 py-3 text-center font-semibold text-slate-700">
                                          {item.quantity} {item.unit}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                          <input
                                            type="number"
                                            min="0"
                                            max={item.quantity}
                                            className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={draft.dispensedQuantity}
                                            onChange={(e) => {
                                              const val = Math.max(0, Math.min(item.quantity, parseInt(e.target.value) || 0));
                                              handleUpdateDraft(req.id, item.itemId, "dispensedQuantity", val);
                                            }}
                                          />
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                          <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={draft.isBackordered}
                                              disabled={draft.dispensedQuantity >= item.quantity}
                                              className="h-4 w-4 border-slate-300 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                                              onChange={(e) => {
                                                handleUpdateDraft(req.id, item.itemId, "isBackordered", e.target.checked);
                                              }}
                                            />
                                            <span className="text-xxs text-slate-400 select-none">ค้างจ่าย</span>
                                          </label>
                                        </td>
                                        <td className="px-3 py-3">
                                          <input
                                            type="text"
                                            placeholder="ระบุข้อความ..."
                                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                                            value={draft.itemNote}
                                            onChange={(e) => {
                                              handleUpdateDraft(req.id, item.itemId, "itemNote", e.target.value);
                                            }}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {requisitions.length > 0 && (
          <div className="p-4 bg-slate-55 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 shrink-0">
            <button
              onClick={() => handleProcessBatch("Rejected")}
              className="py-2 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md rounded-lg transition-all"
            >
              ไม่อนุมัติรายการที่เลือกทั้งหมด
            </button>
            <button
              onClick={() => handleProcessBatch("Approved")}
              className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md rounded-lg transition-all"
            >
              อนุมัติ / จ่ายพัสดุชุดที่เลือกทั้งหมด
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
