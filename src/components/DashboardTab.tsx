import React, { useEffect, useState } from "react";
import { runScript, formatNumber } from "../utils/api";
import { DashboardSummary } from "../types";
import { Package, Award, ArrowDownToLine, RefreshCw, Layers, Hourglass, TrendingUp } from "lucide-react";

interface DashboardTabProps {
  onRefreshTrigger?: () => void;
}

export default function DashboardTab({ onRefreshTrigger }: DashboardTabProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await runScript("getDashboardSummary");
      setSummary(data);
    } catch (e) {
      console.error("Failed to load dashboard summary:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    fetchSummary();
    if (onRefreshTrigger) onRefreshTrigger();
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">กำลังประมวลผลและจัดเตรียมแดชบอร์ด...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-20 text-rose-500 font-bold bg-white rounded-xl border border-slate-200">
        ไม่สามารถโหลดสถิติแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง
      </div>
    );
  }

  // Calculate some details for custom SVG chart
  const labels = summary.monthlySummary?.labels || [];
  const requisitionCounts = summary.monthlySummary?.requisitionCounts || [];
  const totalValues = summary.monthlySummary?.totalValues || [];

  const maxVal = Math.max(...totalValues, 1000);
  const maxCount = Math.max(...requisitionCounts, 5);

  return (
    <div className="max-w-7xl mx-auto animate-fade-in p-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">สรุปภาพรวม (Dashboard)</h2>
          <p className="text-slate-500 text-xs mt-1">สถิติปริมาณความต้องการเบิกใช้พัสดุและพัสดุคงคลังรายสัปดาห์</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-2 border border-indigo-100 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          รีเฟรชข้อมูล
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6 mb-8">
        {/* Card 1 */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl shadow-sm p-5 text-white transform transition hover:-translate-y-1 relative overflow-hidden">
          <Package className="absolute -right-4 -bottom-4 text-7xl opacity-15 stroke-1" />
          <h3 className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">วัสดุทั้งหมดในคลัง</h3>
          <p className="text-3xl font-black">
            {formatNumber(summary.totalItems, 0)} <span className="text-xs font-normal">รายการ</span>
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-sm p-5 text-white transform transition hover:-translate-y-1 relative overflow-hidden">
          <Layers className="absolute -right-4 -bottom-4 text-7xl opacity-15 stroke-1" />
          <h3 className="text-orange-100 text-xs font-bold uppercase tracking-wider mb-2">รอ ผจก. อนุมัติ</h3>
          <p className="text-3xl font-black">
            {formatNumber(summary.pendingManagerApproval, 0)} <span className="text-xs font-normal">ใบเบิก</span>
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-sm p-5 text-white transform transition hover:-translate-y-1 relative overflow-hidden">
          <ArrowDownToLine className="absolute -right-4 -bottom-4 text-7xl opacity-15 stroke-1" />
          <h3 className="text-amber-100 text-xs font-bold uppercase tracking-wider mb-2">รอคลังจ่ายของ</h3>
          <p className="text-3xl font-black">
            {formatNumber(summary.pendingStockApproval, 0)} <span className="text-xs font-normal">ใบเบิก</span>
          </p>
        </div>

        {/* Card 4 */}
        <div
          className={`bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl shadow-sm p-5 text-white transform transition hover:-translate-y-1 relative overflow-hidden ${
            summary.lowStockItems > 0 ? "ring-4 ring-rose-200" : ""
          }`}
        >
          <TrendingUp className="absolute -right-4 -bottom-4 text-7xl opacity-15 stroke-1" />
          <h3 className="text-rose-100 text-xs font-bold uppercase tracking-wider mb-2">สต๊อกใกล้หมด</h3>
          <p className="text-3xl font-black">
            {formatNumber(summary.lowStockItems, 0)} <span className="text-xs font-normal">รายการ</span>
          </p>
        </div>

        {/* Card 5 */}
        <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl shadow-sm p-5 text-white transform transition hover:-translate-y-1 relative overflow-hidden">
          <Hourglass className="absolute -right-4 -bottom-4 text-7xl opacity-15 stroke-1" />
          <h3 className="text-sky-100 text-xs font-bold uppercase tracking-wider mb-2">มีรายการค้างจ่าย</h3>
          <p className="text-3xl font-black">
            {formatNumber(summary.backorderedRequisitions, 0)} <span className="text-xs font-normal">ใบเบิก</span>
          </p>
        </div>
      </div>

      {/* Visual Dynamic Combination SVG Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
          <h3 className="text-lg font-bold text-slate-800">สถิติการเบิกจ่ายและมูลค่าพัสดุรวมรายเดือน</h3>
          <div className="flex items-center space-x-4 text-xs font-medium">
            <span className="flex items-center text-emerald-600">
              <span className="w-3 h-3 bg-emerald-500 rounded-full mr-1.5 inline-block"></span>
              มูลค่าเบิกจ่าย (บาท)
            </span>
            <span className="flex items-center text-indigo-600">
              <span className="w-3 h-3 bg-indigo-600 rounded-full mr-1.5 inline-block"></span>
              จำนวนใบเบิก (รายการ)
            </span>
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div className="h-80 w-full relative">
          <svg className="w-full h-full" viewBox="0 0 1000 320" preserveAspectRatio="none">
            {/* Grid Lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="60"
                y1={40 + i * 55}
                x2="940"
                y2={40 + i * 55}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            ))}

            {/* X-axis */}
            <line x1="60" y1="260" x2="940" y2="260" stroke="#cbd5e1" strokeWidth="1" />

            {/* Bars & Line values rendering */}
            {labels.map((label, index) => {
              const x = 60 + index * 80 + 20;
              const countVal = requisitionCounts[index] || 0;
              const priceVal = totalValues[index] || 0;

              // Heights
              const barHeight = countVal > 0 ? (countVal / maxCount) * 200 : 0;
              const barY = 260 - barHeight;

              const lineY = priceVal > 0 ? 260 - (priceVal / maxVal) * 200 : 260;

              return (
                <g key={index}>
                  {/* Requisition count bars */}
                  <rect
                    x={x + 10}
                    y={barY}
                    width="20"
                    height={barHeight}
                    fill={hoveredIndex === index ? "#4338ca" : "#4f46e5"}
                    rx="3"
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />

                  {/* Price Line points */}
                  <circle
                    cx={x + 20}
                    cy={lineY}
                    r={hoveredIndex === index ? "6" : "4"}
                    fill="#059669"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />

                  {/* X Axis Labels */}
                  <text
                    x={x + 20}
                    y="280"
                    fill="#64748b"
                    fontSize="11"
                    textAnchor="middle"
                    className="font-medium"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Line connecting the line points */}
            {labels.length > 1 && (
              <path
                d={labels
                  .map((_, index) => {
                    const x = 60 + index * 80 + 40;
                    const priceVal = totalValues[index] || 0;
                    const lineY = priceVal > 0 ? 260 - (priceVal / maxVal) * 200 : 260;
                    return `${index === 0 ? "M" : "L"} ${x} ${lineY}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#059669"
                strokeWidth="3"
                className="pointer-events-none"
              />
            )}
          </svg>

          {/* Left Y Axis Title (Counts) */}
          <div className="absolute left-0 top-3 text-[10px] text-slate-400 font-bold bg-white px-2">
            จำนวน (รายการ)
          </div>

          {/* Right Y Axis Title (Value) */}
          <div className="absolute right-0 top-3 text-[10px] text-slate-400 font-bold bg-white px-2 text-right">
            มูลค่า (บาท)
          </div>

          {/* Dynamic Interactive Tooltip */}
          {hoveredIndex !== null && (
            <div
              className="absolute bg-slate-900/95 text-white p-3 rounded-lg shadow-lg border border-slate-700/50 text-xs w-48 pointer-events-none z-10 transition-all duration-150"
              style={{
                left: `${60 + hoveredIndex * 80 + 35}px`,
                bottom: "100px",
                transform: "translateX(-40%)",
              }}
            >
              <p className="font-bold border-b border-slate-700 pb-1 mb-1.5 text-center text-amber-400">
                {labels[hoveredIndex]}
              </p>
              <div className="space-y-1 text-slate-300">
                <p className="flex justify-between">
                  <span>ใบเบิกพัสดุ:</span>
                  <span className="font-bold text-white">
                    {requisitionCounts[hoveredIndex]} ใบ
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>มูลค่ารวม:</span>
                  <span className="font-bold text-emerald-400">
                    ฿{formatNumber(totalValues[hoveredIndex], 2)}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
