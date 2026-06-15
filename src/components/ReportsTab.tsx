import React, { useState, useEffect } from "react";
import { runScript, formatDateForDisplay, formatDateTimeForDisplay, formatNumber } from "../utils/api";
import { User } from "../types";
import {
  FileSpreadsheet,
  Play,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

interface ReportsTabProps {
  currentUser: User;
  departments: string[];
}

export default function ReportsTab({ currentUser, departments }: ReportsTabProps) {
  const [reportType, setReportType] = useState("");
  const [reportDepartment, setReportDepartment] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportSingleDate, setReportSingleDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [reportTitle, setReportTitle] = useState("ผลลัพธ์รายงานข้อมูลพัสดุ");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  // Raw data stored for Excel Export
  const [rawExportData, setRawExportData] = useState<any[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    setReportStartDate(firstDay);
    setReportEndDate(today);
    setReportSingleDate(today);
  }, []);

  const handleGenerateReport = async () => {
    if (!reportType) {
      Swal.fire("กรุณาเลือกรายงาน", "โปรดเลือกประเภทรายงานพัสดุที่สอดต้องการรับชม", "warning");
      return;
    }

    setLoading(true);
    setHeaders([]);
    setRows([]);
    setRawExportData([]);

    // Determine query args
    let rpcMethod = "";
    const filters: any = {};

    if (reportType !== "inventoryStock") {
      filters.department = reportDepartment;
    }

    if (reportType === "inventoryStock") {
      filters.category = categoryFilter.trim();
      filters.location = locationFilter.trim();
      rpcMethod = "getInventoryStockReport";
    } else {
      filters.startDate = reportStartDate;
      filters.endDate = reportEndDate;
      filters.startTime = startTime;
      filters.endTime = endTime;

      if (reportType === "dailyRequisition") {
        filters.reportDate = reportSingleDate; // Left for backward compatibility if ever queried with it
        rpcMethod = "getDailyRequisitionReport";
      }
      else if (reportType === "approvedIssued") rpcMethod = "getApprovedIssuedReport";
      else if (reportType === "cancelledRejected") rpcMethod = "getCancelledRejectedReport";
      else if (reportType === "potentialOverStock") rpcMethod = "getPotentialOverStockReport";
      else if (reportType === "backorderedItems") rpcMethod = "getBackorderedItemsReport";
      else if (reportType === "fulfilledBackorders") rpcMethod = "getFulfilledBackordersReport";
    }

    try {
      const data = await runScript(rpcMethod, filters);
      setRawExportData(data || []);

      const matchedOptionText = document.getElementById("reportTypeSelect")?.querySelector(`option[value="${reportType}"]`)?.textContent || "ผลลัพธ์";
      setReportTitle(`ข้อมูลรายงาน: ${matchedOptionText}`);

      if (!data || data.length === 0) {
        setLoading(false);
        return;
      }

      // Map headers and rows
      if (reportType === "approvedIssued") {
        setHeaders(["ID ใบเบิก", "วันที่เบิก", "แผนกปฎิบัติงาน", "ผู้ยื่นขอเบิก", "รหัสพัสดุ", "ชื่อวัสดุพัสดุทางการแพทย์", "จน.จ่ายจริง", "หน่วยนับ", "ราคา/หน่วย", "มูลค่าสินค้าจ่าย", "ผู้อนุมัติจ่าย"]);
        setRows(
          data.map((row: any) => [
            row.requisitionId,
            formatDateForDisplay(row.requisitionDate),
            row.department,
            row.requestorName,
            row.itemCode,
            row.itemName,
            row.dispensedQuantity,
            row.unit,
            formatNumber(row.unitPrice),
            formatNumber(row.totalValue),
            row.approvedBy,
          ])
        );
      } else if (reportType === "cancelledRejected") {
        setHeaders(["ID ใบเบิก", "วันที่ส่งเรื่อง", "แผนกงาน", "ผู้เบิกพัสดุ", "รหัสพัสดุกรรม", "ชื่อพัสดุคงคลัง", "จน.ยื่น", "หน่วยนับ", "ผู้สั่งการไม่อนุมัติ", "ขั้นตอนปฏิเสธ"]);
        setRows(
          data.map((row: any) => [
            row.requisitionId,
            formatDateForDisplay(row.requisitionDate),
            row.department,
            row.requestorName,
            row.itemCode,
            row.itemName,
            row.requestedQuantity,
            row.unit,
            row.rejectedBy,
            row.status,
          ])
        );
      } else if (reportType === "potentialOverStock") {
        setHeaders(["ID ใบเบิก", "วันที่ส่งเบิก", "แผนกต้นสังกัด", "ผู้ร้องขอ", "รหัสพัสดรัง", "ชื่อพัสดุ", "จน.ต้องการ", "สต๊อกคงเหลือจริง", "หน่วยนับ", "สถานะปัจจุบัน"]);
        setRows(
          data.map((row: any) => [
            row.requisitionId,
            formatDateForDisplay(row.requisitionDate),
            row.department,
            row.requestorName,
            row.itemCode,
            row.itemName,
            row.requestedQuantity,
            row.currentStock,
            row.unit,
            row.status,
          ])
        );
      } else if (reportType === "backorderedItems") {
        setHeaders(["ID ใบเบิก", "วันที่ส่งเบิก", "แผนกปฎิบัติงาน", "ผู้เบิกพัสดุ", "รหัสพัสดุกรรม", "ชื่อพัสดุค้างจ่าย", "จน.คงค้างจ่าย", "หน่วยนับ", "บันทึกหมายเหตุย่อย"]);
        setRows(
          data.map((row: any) => [
            row.requisitionId,
            formatDateForDisplay(row.requisitionDate),
            row.department,
            row.requestorName,
            row.itemCode,
            row.itemName,
            row.backorderedQuantity,
            row.unit,
            row.itemNote,
          ])
        );
      } else if (reportType === "fulfilledBackorders") {
        setHeaders(["ID ใบเบิก", "วันที่ติดตามจ่ายค้าง", "แผนกงาน", "ผู้เบิกพัสดุ", "รหัสพัสดุการ", "ชื่อพัสดุ", "จน.จ่ายค้างออก", "หน่วยนับ", "เจ้าหน้าที่สต๊อกผู้จ่าย", "หมายเหตุ"]);
        setRows(
          data.map((row: any) => [
            row.requisitionId,
            formatDateForDisplay(row.fulfillmentDate),
            row.department,
            row.requestorName,
            row.itemCode,
            row.itemName,
            row.fulfilledQuantity,
            row.unit,
            row.fulfilledBy,
            row.itemNote,
          ])
        );
      } else if (reportType === "dailyRequisition") {
        setHeaders(["ID ใบเบิก", "เวลาออก", "แผนกสังกัด", "ผู้ยื่นเบิก", "รหัสพัสดุ", "ชื่อพัสดุจัดเบิก", "จำนวนความต้องการ", "จำนวนจ่ายจริง", "สถานะติดค้าง?", "ขั้นตอนรวม"]);
        setRows(
          data.map((row: any) => [
            row.requisitionId,
            row.creationTime,
            row.department,
            row.requestorName,
            row.itemCode,
            row.itemName,
            row.requestedQuantity,
            row.dispensedQuantity !== null ? row.dispensedQuantity : "-",
            row.itemIsBackordered === "Yes" ? "ติดค้างจ่าย" : "-",
            row.status,
          ])
        );
      } else if (reportType === "inventoryStock") {
        setHeaders(["ID", "รหัสพัสดุ", "ชื่อพัสดุคลัง", "หมวดหมู่หลัก", "ที่ตั้งจัดเก็บ", "คงคลังปัจจุบัน", "หน่วยนับ", " Min ยอดแจ้งเตือน", "ราคาต่อหน่วย", "มูลค่าคงเหลือรวม", "บันทึกเวลาอัปสต๊อกล่าสุด"]);
        setRows(
          data.map((row: any) => [
            row["ID"],
            row["รหัส"],
            row["ชื่อวัสดุ"],
            row["หมวดหมู่"],
            row["ที่ตั้ง"],
            row["คงเหลือ"],
            row["หน่วย"],
            row["Min Stock"],
            formatNumber(row["ราคา/หน่วย"]),
            formatNumber(row["มูลค่ารวม"]),
            formatDateTimeForDisplay(row["อัปเดตล่าสุด"]),
          ])
        );
      }

      setCurrentPage(1);
    } catch (e: any) {
      Swal.fire("ข้อผิดพลาด", e.message || "เกิดความผิดพลาดในการประมวลผลดึงสรุปตาราง", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    if (rawExportData.length === 0) return;
    try {
      const ws = XLSX.utils.json_to_sheet(rawExportData);
      const wb = XLSX.utils.book_new();
      const sanitizedTitle = reportTitle.replace(/[^a-zA-Z0-9\u0E00-\u0E7F]/g, "_");
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `THAMC_Report_${sanitizedTitle}.xlsx`);

      Swal.fire({
        icon: "success",
        title: "Export สำเร็จ!",
        text: "เอกสารรายงานรูปตารางดาวน์โหลดสำเร็จ",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (e: any) {
      Swal.fire("ส่งออกตารางล้มเหลว", e.message, "error");
    }
  };

  // Pagination Math
  const totalPages = Math.ceil(rows.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  return (
    <div className="max-w-[100rem] mx-auto p-2 animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-[80vh]">
        <h2 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-3 flex items-center">
          <FileSpreadsheet className="w-6 h-6 text-indigo-600 mr-2" />
          รายงานระบบเบิกจ่ายและพัสดุศูนย์การแพทย์
        </h2>

        {/* Filter Selection Panel */}
        <div className="mb-6 p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl shadow-inner">
          <h3 className="text-sm font-extrabold text-indigo-900 uppercase tracking-wide mb-4">
            ตัวเลือกกรองสรุปรายงาน (Reports Filter)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                รายงานสถิติชุด <span className="text-rose-500">*</span>
              </label>
              <select
                id="reportTypeSelect"
                className="w-full bg-white border border-slate-350 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value);
                  setHeaders([]);
                  setRows([]);
                  setRawExportData([]);
                }}
              >
                <option value="">-- แตะเลือกประเภทรายงาน --</option>
                <option value="approvedIssued">1. รายงานใบจ่ายพัสดุสำเร็จ (Approved & Issued)</option>
                <option value="cancelledRejected">2. รายงานใบเบิกที่ถูกปฏิเสธ/ไม่อนุมัติ (Cancelled & Rejected)</option>
                <option value="potentialOverStock">3. รายงานใบอนุมัติเบิกเกินยอดสต๊อกคลัง (Overstock Requisitions)</option>
                <option value="backorderedItems">4. รายงานรายการค้างจ่ายตกค้างหลัก (Current Backorders)</option>
                <option value="fulfilledBackorders">5. รายงานจัดจ่ายค้างจ่ายแล้ว (Fulfilled Backorders Log)</option>
                <option value="dailyRequisition">6. รายงานสรุปใบเบิกรายการจ่ายรายวัน (Daily Log)</option>
                <option value="inventoryStock">7. รายงานพัสดุในคลังทั้งหมด (Stock balance)</option>
              </select>
            </div>

            {/* Sub-Filters conditional rendering */}
            {reportType !== "inventoryStock" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  กรองเฉพาะแผนก
                </label>
                <select
                  className="w-full bg-white border border-slate-350 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                  value={reportDepartment}
                  onChange={(e) => setReportDepartment(e.target.value)}
                >
                  <option value="">-- คลังแผนกทั้งหมด --</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date-time options for all date-based report types */}
            {reportType !== "inventoryStock" && reportType !== "" ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    จากวันที่
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-white border border-slate-355 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                    value={reportStartDate}
                    onChange={(e) => {
                      setReportStartDate(e.target.value);
                      setReportSingleDate(e.target.value); // Sync single date for backward compatibility
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ถึงวันที่
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-white border border-slate-355 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>

                {/* Processing Time Filter Sub-panel spanning full row */}
                <div className="md:col-span-2 lg:col-span-4 mt-2">
                  <div className="border-t border-indigo-100/60 pt-4">
                    <label className="block text-xs font-black text-indigo-900 uppercase tracking-wider mb-2">
                      ⏰ ตัวเลือกกรองช่วงเวลาในวัน (Time Range Filters)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                      {/* Presets Row */}
                      <div className="sm:col-span-2">
                        <span className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                          เลือกกำหนดเวลากดด่วน (Time Presets)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setStartTime("00:00");
                              setEndTime("23:59");
                            }}
                            className={`px-3 py-1 text-xs rounded-full border transition-all font-bold ${
                              startTime === "00:00" && endTime === "23:59"
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            ☀️ ทั้งวัน (00:00 - 23:59)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStartTime("00:00");
                              setEndTime("12:00");
                            }}
                            className={`px-3 py-1 text-xs rounded-full border transition-all font-bold ${
                              startTime === "00:00" && endTime === "12:00"
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            🕛 ถึง เที่ยงวัน (00:00 - 12:00)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStartTime("12:00");
                              setEndTime("23:59");
                            }}
                            className={`px-3 py-1 text-xs rounded-full border transition-all font-bold ${
                              startTime === "12:00" && endTime === "23:59"
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            🌙 หลังเที่ยง - เที่ยงคืน (12:00 - 23:59)
                          </button>
                        </div>
                      </div>

                      {/* Custom Times */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          กรอง ตั้งแต่เวลา
                        </label>
                        <input
                          type="time"
                          required
                          className="w-full bg-white border border-slate-355 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          กรอง ถึงเวลา
                        </label>
                        <input
                          type="time"
                          required
                          className="w-full bg-white border border-slate-355 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : reportType === "inventoryStock" ? (
              <div className="grid grid-cols-2 gap-3 col-span-1 md:col-span-2 lg:col-span-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    กรองตามหมวดหมู่
                  </label>
                  <input
                    type="text"
                    placeholder="พิมพ์หมวดหมู่..."
                    className="w-full bg-white border border-slate-355 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    พื้นที่ที่ตั้งในคลัง
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ชั้น 2, ตู้ A..."
                    className="w-full bg-white border border-slate-355 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {/* Generate controls */}
            <div className="lg:col-span-4 flex justify-end space-x-3 mt-2 border-t border-indigo-100/40 pt-4 shrink-0">
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={loading}
                className="flex items-center justify-center font-bold px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm shadow-md transition-all shrink-0"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    กำลังค้นสืบพัสดุ...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1.5" />
                    สร้างตารางรายงานสรุป
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportToExcel}
                disabled={loading || rows.length === 0}
                className="flex items-center justify-center font-bold px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm shadow-md transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Results layout and grid rendering */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-3 pl-3 border-l-4 border-indigo-600">
            {reportTitle}
          </h3>

          <div className="flex-1 overflow-x-auto border border-slate-200 rounded-t-xl bg-white max-h-[450px]">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-24">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">ระบบคลังสรุปยอดพัสดุกำลังคำนวณฐานข้อมูล...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center h-44 text-slate-400 bg-slate-50/50">
                <div className="text-center">
                  <FolderOpen className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm font-medium">กรุณาเลือกเงื่อนไขสรุปรายงานด้านบนแล้วกด "สร้างตารางรายงานสรุป"</p>
                </div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-indigo-50 border-b border-indigo-100 text-indigo-900 sticky top-0 shadow-sm z-10 font-bold">
                  <tr>
                    {headers.map((h, index) => (
                      <th key={index} className="px-3 py-3 uppercase tracking-wider text-left border-r border-slate-200/50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedRows.map((rowArr, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-50 border-b border-slate-100">
                      {rowArr.map((cell: any, cellIndex: number) => {
                         // Styles based on index/type to highlights values
                         let alignStyle = "text-left";
                         const lastIndex = rowArr.length - 1;
                         // Currency alignment logic
                         if (reportType === "approvedIssued" && (cellIndex === 6 || cellIndex === 8 || cellIndex === 9)) {
                           alignStyle = "text-center font-mono font-semibold";
                         } else if (reportType === "inventoryStock" && (cellIndex === 5 || cellIndex === 8 || cellIndex === 9)) {
                           alignStyle = "text-center font-mono font-semibold";
                           if (cellIndex === 5 && parseInt(cell) <= 0) {
                             alignStyle = "text-center font-bold text-rose-600 bg-rose-50";
                           }
                         }
                         return (
                           <td key={cellIndex} className={`px-3 py-2.5 truncate max-w-[170px] text-slate-700 ${alignStyle}`} title={cell}>
                             {cell}
                           </td>
                         );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table paginations */}
          {!loading && rows.length > 0 && (
            <div className="bg-slate-50/50 border border-t-0 border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>ตารางหน้าละ:</span>
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

              <div className="text-sm font-medium text-slate-500 animate-fade-in">
                หน้า <span className="text-slate-800 font-bold">{currentPage}</span> จาก{" "}
                <span className="text-slate-800 font-bold">{totalPages || 1}</span>{" "}
                <span className="text-xs text-slate-400 font-normal">
                  (รายการรายงานประมวลผลทั้งหมด {rows.length} รายการสำเร็จ)
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
          )}
        </div>
      </div>
    </div>
  );
}
