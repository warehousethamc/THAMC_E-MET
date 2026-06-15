import React, { useState, useEffect } from "react";
import { runScript, formatDateForDisplay, formatDateTimeForDisplay, formatNumber } from "../utils/api";
import { User, Requisition } from "../types";
import {
  Search,
  FileSpreadsheet,
  FileText,
  Calendar,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  UserCheck
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

interface HistoryTabProps {
  currentUser: User;
  onOpenDetails: (requisitionId: string) => void;
  departments: string[];
}

export default function HistoryTab({ currentUser, onOpenDetails, departments }: HistoryTabProps) {
  // Query Filters State
  const [searchReqId, setSearchReqId] = useState("");
  const [searchRequesterName, setSearchRequesterName] = useState("");
  const [searchDepartment, setSearchDepartment] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");

  // Grid Data & loading State
  const [loading, setLoading] = useState(false);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    // Initial fetch logs on tab mount
    fetchHistory();
  }, []);

  const fetchHistory = async (customFilters?: any) => {
    setLoading(true);
    try {
      const filters = customFilters || {
        id: searchReqId.trim(),
        requestorName: searchRequesterName.trim(),
        department: searchDepartment,
        status: searchStatus,
        startDate: searchStartDate,
        endDate: searchEndDate,
      };

      const data = await runScript("getRequisitions", filters, currentUser.username, currentUser.role);
      setRequisitions(data || []);
      setCurrentPage(1);
    } catch (e: any) {
      Swal.fire("ข้อผิดพลาด", e.message || "ไม่สามารถโหลดข้อมูลประวัติการเบิกได้", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleResetSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    setSearchReqId("");
    setSearchRequesterName("");
    setSearchDepartment("");
    setSearchStatus("");
    setSearchStartDate("");
    setSearchEndDate("");
    fetchHistory({
      id: "",
      requestorName: "",
      department: "",
      status: "",
      startDate: "",
      endDate: "",
    });
  };

  const handleExportToExcel = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const filters = {
        id: searchReqId.trim(),
        requestorName: searchRequesterName.trim(),
        department: searchDepartment,
        status: searchStatus,
        startDate: searchStartDate,
        endDate: searchEndDate,
      };

      const data = await runScript("getRequisitionsForExport", filters, currentUser.username, currentUser.role);
      if (!data || data.length === 0) {
        Swal.fire("ไม่มีข้อมูล", "ไม่พบข้อมูลพัสดุใดตรงกับเงื่อนไขสำหรับการนำส่งข้อมูล", "info");
        return;
      }

      // Generate Workbook
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "THAMC_Requisitions");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `THAMC_MaterialRequisition_Export_${today}.xlsx`);

      Swal.fire({
        icon: "success",
        title: "ส่งออกสำเร็จ!",
        text: "ดาวน์โหลดเอกสารประวัติเบิกพัสดุรูปแบบ Excel สำเร็จแล้ว",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
      });
    } catch (e: any) {
      Swal.fire("ผิดพลาดในการส่งออก Excel", e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const statusBadgeHtml = (statusText: string) => {
    let style = "bg-slate-100 text-slate-700 border-slate-200";
    const lower = statusText.toLowerCase();

    if (lower.includes("pending manager")) {
      style = "bg-orange-50 text-orange-700 border-orange-200";
    } else if (lower.includes("pending stock")) {
      style = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (lower.includes("completed")) {
      style = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (lower.includes("partially")) {
      style = "bg-sky-50 text-sky-700 border-sky-200 animate-pulse";
    } else if (lower.includes("rejected")) {
      style = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (lower.includes("approved")) {
      style = "bg-emerald-50 text-emerald-600 border-emerald-200";
    }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${style}`}>
        {statusText}
      </span>
    );
  };

  // Pagination Logic math
  const totalPages = Math.ceil(requisitions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = requisitions.slice(startIndex, endIndex);

  return (
    <div className="max-w-7xl mx-auto p-2 animate-fade-in">
      {/* Search filters panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
          ค้นหาประวัติการเบิกพัสดุ
        </h2>
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                เลขที่เอกสาร
              </label>
              <input
                type="text"
                placeholder="เช่น REQ-250001"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchReqId}
                onChange={(e) => setSearchReqId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                ชื่อผู้ยื่นเบิก
              </label>
              <input
                type="text"
                placeholder="พิมพ์ชื่อ..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchRequesterName}
                onChange={(e) => setSearchRequesterName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                แผนกสังกัด
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchDepartment}
                onChange={(e) => setSearchDepartment(e.target.value)}
              >
                <option value="">-- ทุกแผนก --</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                สถานะรวมใบเบิก
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchStatus}
                onChange={(e) => setSearchStatus(e.target.value)}
              >
                <option value="">-- ทุกสถานะ --</option>
                <option value="Pending Manager Approval">Pending Manager Approval</option>
                <option value="Pending Stock Approval">Pending Stock Approval</option>
                <option value="Completed">Completed (จ่ายวัสดุเสร็จสิ้น)</option>
                <option value="Partially Completed">Partially Completed (มีค้างจ่าย)</option>
                <option value="Rejected by Manager">Rejected by Manager</option>
                <option value="Rejected by Stock">Rejected by Stock</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  ตั้งแต่วันที่
                </label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={searchStartDate}
                  onChange={(e) => setSearchStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  ถึงวันที่
                </label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={searchEndDate}
                  onChange={(e) => setSearchEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="lg:col-span-2 flex space-x-3 pt-4 lg:pt-0">
              <button
                type="button"
                onClick={handleResetSearch}
                className="flex-1 py-2 border border-slate-200 text-slate-600 font-bold bg-white hover:bg-slate-50 rounded-lg text-sm transition-all"
              >
                ล้างตัวค้นหา
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center py-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-lg text-sm shadow-sm transition-all"
              >
                <Search className="w-4 h-4 mr-1.5" />
                ค้นหารายการ
              </button>
              <button
                type="button"
                onClick={handleExportToExcel}
                className="flex-1 flex items-center justify-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Export Excel
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Grid listing */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 bg-white">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">กำลังค้นหาสถิติใบเบิก...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      เลขที่เอกสาร
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      วันที่เบิก
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      ผู้เบิกพัสดุ (แผนก)
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      สถานะใบเบิก
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      เอกสารรับ-จ่ายแนบ (PDF)
                    </th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 bg-white">
                        <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        ไม่พบประวัติใบเบิกพัสดุภายใต้ข้อตรวจสอบระบุ
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((req) => {
                      const reqPdfLink = req.RequisitionPDFLink;
                      const giPdfLinks = req.GoodsIssuePDFLinks || [];

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-800">{req.id}</td>
                          <td className="px-6 py-4 text-slate-600">{formatDateForDisplay(req.date)}</td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-800">{req.requestorName}</span>
                            <span className="text-xs text-slate-400 block">{req.requestorDepartment}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{statusBadgeHtml(req.status)}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {/* Requisition PDF link */}
                              {reqPdfLink && (
                                <a
                                  href={reqPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-100 rounded px-2 py-0.5 transition-all"
                                  title="ดูใบเบิกวัสดุ"
                                >
                                  <FileText className="w-3 h-3 text-red-500 mr-1" />
                                  ใบเบิก
                                </a>
                              )}

                              {/* Goods issue PDF link */}
                              {giPdfLinks.map((gi) => (
                                <a
                                  key={gi.id}
                                  href={gi.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-100 rounded px-2 py-0.5 transition-all"
                                  title={`ดูใบจ่าย ${gi.id} โดย ${gi.issuedBy}`}
                                >
                                  <UserCheck className="w-3 h-3 text-emerald-500 mr-1" />
                                  {gi.type}
                                </a>
                              ))}

                              {!reqPdfLink && giPdfLinks.length === 0 && (
                                <span className="text-xs text-slate-400 italic">ไม่มีเอกสารแนบ</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => onOpenDetails(req.id)}
                              className="inline-flex items-center text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm rounded-lg px-3 py-1.5"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              ดูรายละเอียด
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Panel */}
            <div className="bg-slate-50/50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>แสดง:</span>
                <select
                  className="bg-white border border-slate-300 text-slate-700 py-1 px-2.5 rounded-lg focus:outline-none"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10 รายการ</option>
                  <option value={25}>25 รายการ</option>
                  <option value={50}>50 รายการ</option>
                  <option value={100}>100 รายการ</option>
                </select>
              </div>

              <div className="text-sm font-medium text-slate-500">
                หน้า <span className="text-slate-800 font-bold">{currentPage}</span> จาก{" "}
                <span className="text-slate-800 font-bold">{totalPages || 1}</span>{" "}
                <span className="text-xs text-slate-400 font-normal">
                  (รายการคัดกรอง {requisitions.length} แถวสำเร็จ)
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="p-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="p-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
