import React, { useState, useEffect } from "react";
import { runScript, formatNumber } from "../utils/api";
import { InventoryItem } from "../types";
import {
  FileText,
  Calendar,
  Layers,
  Search,
  ShoppingCart,
  Trash2,
  Save,
  HelpCircle,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Plus
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

interface GoodsReceiptTabProps {
  currentUser: any;
  onRefreshStock?: () => void;
}

export default function GoodsReceiptTab({ currentUser, onRefreshStock }: GoodsReceiptTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"manual" | "excel">("manual");
  const [loading, setLoading] = useState(false);

  // Inventories Cache
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [grSearchTerm, setGrSearchTerm] = useState("");
  const [selectedGrItemCode, setSelectedGrItemCode] = useState("");
  const [grQuantityReceived, setGrQuantityReceived] = useState("");
  const [grUnitPrice, setGrUnitPrice] = useState("");

  // Manual GR form header
  const [referenceNo, setReferenceNo] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [notes, setNotes] = useState("");

  // Manual list items
  const [receiptItems, setReceiptItems] = useState<any[]>([]);

  // Excel Upload State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRefNo, setExcelRefNo] = useState("");
  const [excelReceiptDate, setExcelReceiptDate] = useState("");
  const [excelNotes, setExcelNotes] = useState("");
  const [excelStatus, setExcelStatus] = useState<string>("");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setReceiptDate(today);
    setExcelReceiptDate(today);
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const data = await runScript("getInventoryItems");
      setInventory(data || []);
    } catch (e) {
      console.error("Failed to load inventory:", e);
    }
  };

  const handleAddItemToReceipt = () => {
    if (!selectedGrItemCode) {
      Swal.fire("ข้อผิดพลาด", "กรุณาเลือกวัสดุชิ้นที่ต้องการรับเข้า", "warning");
      return;
    }
    const quantity = parseInt(grQuantityReceived);
    if (isNaN(quantity) || quantity <= 0) {
      Swal.fire("ข้อผิดพลาด", "กรุณาระบุจำนวนสินค้าที่รับเข้ามาจริง (> 0)", "warning");
      return;
    }

    const price = grUnitPrice.trim() !== "" ? parseFloat(grUnitPrice) : null;
    if (price !== null && (isNaN(price) || price < 0)) {
       Swal.fire("ข้อผิดพลาด", "ราคาต่อหน่วยต้องระบุเป็นตัวเลขไม่น้อยกว่า 0", "warning");
       return;
    }

    const matchedItem = inventory.find((i) => i.code === selectedGrItemCode);
    if (!matchedItem) return;

    // Check Duplicate
    if (receiptItems.find((item) => item.code === selectedGrItemCode)) {
      Swal.fire("มีข้อมูลแล้ว", "พัสดุชิ้นนี้อยู่ใบรับรายการด้านล่างแล้ว หากต้องการแก้จำนวน ให้ทำการลบแถวเดิมแล้วทำรายการไถ่ถอนใหม่", "info");
      return;
    }

    setReceiptItems([
      ...receiptItems,
      {
        id: matchedItem.id,
        code: matchedItem.code,
        name: matchedItem.name,
        unit: matchedItem.unit,
        quantityReceived: quantity,
        unitPrice: price,
      },
    ]);

    setSelectedGrItemCode("");
    setGrQuantityReceived("");
    setGrUnitPrice("");
  };

  const handleRemoveReceiptItem = (index: number) => {
    const updated = [...receiptItems];
    updated.splice(index, 1);
    setReceiptItems(updated);
  };

  const handleManualGRSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (receiptItems.length === 0) {
      Swal.fire("ข้อมูลไม่ครบถ้วน", "กรุณาเพิ่มรายการวัสดุที่ต้องการรับเข้าอย่างน้อย 1 รายการ", "warning");
      return;
    }
    if (!receiptDate) {
      Swal.fire("ข้อมูลไม่ครบถ้วน", "กรุณาระบุวันที่จัดส่งรับสินค้าจริง", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "บันทึกรับเข้าคลัง?",
      text: `คุณต้องการนำวัสดุพัสดุจำนวน ${receiptItems.length} รายการรับเข้ายอดสต๊อกหรือไม่? ระบบจะทำการบันทึก log ทันที`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ตกลง รับเข้าคลัง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);
    try {
      const receiptInfo = {
        referenceNo: referenceNo.trim() || "Manual Intake",
        receiptDate: receiptDate,
        notes: notes.trim(),
        receivedByUsername: currentUser.username,
        source: "Manual Form",
        items: receiptItems.map((item) => ({
          itemCode: item.code,
          quantityReceived: item.quantityReceived,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await runScript("processGoodsReceiptServer", receiptInfo);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "บันทึกสำเร็จ!",
          text: "สต๊อกวัสดุได้รับการอัปเดตและบันทึกประวัติล่วงลับเรียบร้อยแล้ว",
          confirmButtonColor: "#059669",
        });

        // Reset state values
        setReceiptItems([]);
        setReferenceNo("");
        setNotes("");
        await loadInventory();
        if (onRefreshStock) onRefreshStock();
      } else {
        Swal.fire("บันทึกรับเข้าล้มเหลว", res.message || "เกิดข้อผิดพลาดทางเซิร์ฟเวอร์", "error");
      }
    } catch (err: any) {
      Swal.fire("เกิดข้อผิดพลาดในการรับเข้า", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGrTemplateDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const headers = await runScript("getGoodsReceiptTemplateHeaders");
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "THAMC_GoodsReceipt_Template.xlsx");
    } catch (err: any) {
      Swal.fire("โหลด Template ล้มเหลว", err.message, "error");
    }
  };

  const handleExcelImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      Swal.fire("ไม่ได้อัปโหลดไฟล์", "กรุณาเลือกไฟล์ Excel นำเข้าเข้าสู่ระบบก่อนทำการประมวลผล", "warning");
      return;
    }
    if (!excelReceiptDate) {
      Swal.fire("ข้อมูลไม่ครบถ้วน", "กรุณาระบุวันที่รับสินค้าสำหรับการลงบันทึกในสต๊อก", "warning");
      return;
    }

    setLoading(true);
    setExcelStatus("กำลังอ่านโครงสร้างของไฟล์ Excel...");

    const fileReader = new FileReader();
    fileReader.onload = async (evt) => {
      try {
        const buffer = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[];

        if (jsonData.length < 2) {
          throw new Error("โครงสร้างไฟล์ขาดปริมาณแถวหรือไม่มีข้อมูลรายการสินค้า");
        }

        const headers = (jsonData[0] || []).map((h: any) => (h ? h.toString().trim() : ""));
        const itemCodeIdx = headers.indexOf("ItemCode");
        const quantityIdx = headers.indexOf("QuantityReceived");
        const unitPriceIdx = headers.indexOf("UnitPrice");

        if (itemCodeIdx === -1 || quantityIdx === -1) {
          throw new Error("หัวตารางไม่ถูกต้อง! คอลัมน์หลักต้องมีชื่อ 'ItemCode' และ 'QuantityReceived'");
        }

        const itemsToReceive: any[] = [];
        let errors = "";

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every((c: any) => c === null || c === undefined || c.toString().trim() === "")) {
            continue;
          }

          const itemCode = row[itemCodeIdx] ? row[itemCodeIdx].toString().trim() : null;
          const qtyStr = row[quantityIdx] ? row[quantityIdx].toString().trim() : null;
          let unitPrice = null;

          if (unitPriceIdx !== -1 && row[unitPriceIdx] !== undefined && row[unitPriceIdx] !== null && row[unitPriceIdx].toString().trim() !== "") {
            unitPrice = parseFloat(row[unitPriceIdx].toString().trim());
            if (isNaN(unitPrice) || unitPrice < 0) {
              errors += `<p class="text-amber-600 text-xs">- แถวที่ ${i + 1} (${itemCode}): ราคาไม่ถูกต้อง จะใช้ราคาเดิมพรีบิวด์</p>`;
              unitPrice = null;
            }
          }

          if (!itemCode || !qtyStr) {
            errors += `<p class="text-rose-500 text-xs">- แถวที่ ${i + 1}: ข้อมูลไม่ครบถ้วน (ข้ามรายการ)</p>`;
            continue;
          }

          const qty = parseInt(qtyStr);
          if (isNaN(qty) || qty <= 0) {
            errors += `<p class="text-rose-500 text-xs">- แถวที่ ${i + 1} (${itemCode}): จำนวนต้องมากกว่า 0 (ข้ามรายการ)</p>`;
            continue;
          }

          itemsToReceive.push({
            itemCode,
            quantityReceived: qty,
            unitPrice,
          });
        }

        if (itemsToReceive.length === 0) {
          throw new Error("ไม่มีข้อมูลใดเลยที่สามารถดึงออกมาลงทะเบียนได้ กรุณาตรวจสอบตารางพัสดุของคุณ");
        }

        setExcelStatus(`ตรวจพบวัสดุเตรียมอัปสต๊อก ${itemsToReceive.length} รายการ กำลังสื่อสารกับดาต้าเบส...`);

        const requestPayload = {
          referenceNo: excelRefNo.trim() || "Excel Batch Import",
          receiptDate: excelReceiptDate,
          notes: excelNotes.trim(),
          receivedByUsername: currentUser.username,
          source: "Excel Import",
          items: itemsToReceive,
        };

        const res = await runScript("processGoodsReceiptServer", requestPayload);
        if (res.success) {
          Swal.fire({
            icon: "success",
            title: "อัปโหลด Excel สำเร็จ!",
            text: `นำพัสดุพ่วงสต๊อกสำเร็จ ${itemsToReceive.length} รายการเรียบร้อย`,
            confirmButtonColor: "#10b981",
          });

          setExcelFile(null);
          setExcelRefNo("");
          setExcelNotes("");
          setExcelStatus("");
          await loadInventory();
          if (onRefreshStock) onRefreshStock();
        } else {
          let errMsg = `เกิดเหตุขัดข้อง: ${res.message || "Unknown Error"}`;
          if (res.details && res.details.length > 0) {
             errMsg += "\n" + res.details.filter((d: any) => !d.success).map((d: any) => `- ${d.itemCode}: ${d.message}`).join("\n");
          }
          setExcelStatus(`<div class="text-rose-600 font-bold">นำเข้าล้มเหลว!</div><pre class="bg-rose-50 p-2 text-rose-500 text-xs mt-2 border rounded whitespace-pre-wrap">${errMsg}</pre>`);
        }
      } catch (err: any) {
         setExcelStatus(`<p class="text-rose-600 font-semibold mb-2">โครงสร้างชีสไม่ถูกต้อง:</p><p class="text-slate-500 text-xs">${err.message}</p>`);
      } finally {
        setLoading(false);
      }
    };

    fileReader.onerror = () => {
      setExcelStatus("ไม่สามารถอ่านไฟล์เป้าหมายจากบราวเซอร์ได้");
      setLoading(false);
    };

    fileReader.readAsArrayBuffer(excelFile);
  };

  const filteredGrItems = inventory.filter(
    (item) =>
      item.code.toLowerCase().includes(grSearchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(grSearchTerm.toLowerCase())
  );

  const selectedGrItemDetails = inventory.find((i) => i.code === selectedGrItemCode);

  return (
    <div className="max-w-5xl mx-auto p-2 animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 bg-slate-50">
          <nav className="flex -mb-px" aria-label="Tabs">
            <button
              onClick={() => setActiveSubTab("manual")}
              className={`flex-1 py-4 px-1 text-center border-b-2 font-bold text-sm flex items-center justify-center transition-all ${
                activeSubTab === "manual"
                  ? "border-emerald-500 text-emerald-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Save className="w-4 h-4 mr-2" />
              กรอกรับเข้าคลังสินค้าด้วยตัวเอง
            </button>
            <button
              onClick={() => setActiveSubTab("excel")}
              className={`flex-1 py-4 px-1 text-center border-b-2 font-bold text-sm flex items-center justify-center transition-all ${
                activeSubTab === "excel"
                  ? "border-emerald-500 text-emerald-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              นำเข้าผ่านไฟล์ตาราง Excel (.xlsx)
            </button>
          </nav>
        </div>

        {/* Tab 1: Manual */}
        {activeSubTab === "manual" && (
          <div className="p-6">
            <form onSubmit={handleManualGRSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 bg-slate-50 p-5 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    เอกสารรับส่งอ้างอิง (เลขที่ PO หรือใบรับของ)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น PO-690021"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    วันที่รับเข้าคลังจริง <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      required
                      className="w-full pl-10 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    หมายเหตุเพิ่มเติม (ถ้ามี)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ระบุชื่อผู้ขนส่งทางบก หรือผู้รับจัดส่งอื่นๆ..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Material Dropdown selection sub-form */}
              <div className="border-t border-dashed border-slate-200 pt-6 mb-4">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <Layers className="w-5 h-5 text-emerald-600 mr-2" />
                  เพิ่มรายการที่รับเข้ามา
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-55 border border-slate-200 p-4 rounded-xl">
                  {/* Select Materials */}
                  <div className="md:col-span-5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      พิมพ์หาพัสดุและคลิกเลือก
                    </label>
                    <input
                      type="text"
                      placeholder="พิมพ์เพื่อกรอง..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs mb-1.5 focus:outline-none font-normal"
                      value={grSearchTerm}
                      onChange={(e) => setGrSearchTerm(e.target.value)}
                    />
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={selectedGrItemCode}
                      onChange={(e) => setSelectedGrItemCode(e.target.value)}
                    >
                      <option value="">-- แตะเลือกพัสดุรับเข้า --</option>
                      {filteredGrItems.map((item) => (
                        <option key={item.id} value={item.code}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price */}
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                      ราคาใหม่ต่อหน่วย (เว้นว่างไว้เพื่อใช้ของเดิม)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-medium">
                        ฿
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={
                          selectedGrItemDetails ? selectedGrItemDetails.UnitPrice.toFixed(2) : "0.00"
                        }
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none text-right font-mono"
                        value={grUnitPrice}
                        onChange={(e) => setGrUnitPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Quantity received input */}
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                      จำนวนที่รับเข้ามาจริง <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="จำนวน"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-center font-black text-emerald-600 focus:outline-none"
                      value={grQuantityReceived}
                      onChange={(e) => setGrQuantityReceived(e.target.value)}
                    />
                  </div>

                  {/* Add button */}
                  <div className="md:col-span-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleAddItemToReceipt}
                      className="w-full text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors border border-indigo-600 flex justify-center items-center shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      เพิ่มเข้าลิสต์
                    </button>
                  </div>
                </div>

                {/* Micro preview existing stocks warning */}
                {selectedGrItemDetails && (
                  <div className="mt-3 text-xs text-slate-500 text-right bg-slate-50 px-3 py-2 rounded border border-slate-100 animate-fade-in font-medium flex justify-between items-center">
                    <span>
                      สต๊อกที่มีในคลังของชิ้นนี้ขณะนี้:{" "}
                      <strong className="text-indigo-600">
                        {selectedGrItemDetails.quantity} {selectedGrItemDetails.unit}
                      </strong>
                    </span>
                    <span>ที่ตั้งเก็บในโรงพยาบาล: {selectedGrItemDetails.Location || "ไม่กำหนด"}</span>
                  </div>
                )}
              </div>

              {/* Items pending upload list table */}
              <div className="overflow-x-auto mb-6 border border-slate-200 rounded-xl shadow-sm bg-white text-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                        รหัสพัสดุ
                      </th>
                      <th className="px-5 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                        ชื่อพัสดุคลัง
                      </th>
                      <th className="px-5 py-3 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">
                        หน่วยนับ
                      </th>
                      <th className="px-5 py-3 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">
                        ราคาใหม่/หน่วย
                      </th>
                      <th className="px-5 py-3 text-center font-bold text-emerald-700 text-xs uppercase tracking-wider bg-emerald-50/50">
                        จำนวนที่รับจริง
                      </th>
                      <th className="px-5 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {receiptItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 bg-white">
                          <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                          ยังไม่มีรายการพัสดุใดแอดลงฟอร์มนำรับเข้าคลังด้านบน
                        </td>
                      </tr>
                    ) : (
                      receiptItems.map((item, index) => (
                        <tr key={item.code} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.code}</td>
                          <td className="px-5 py-3 font-semibold text-slate-800">{item.name}</td>
                          <td className="px-5 py-3 text-center text-slate-500">{item.unit}</td>
                          <td className="px-5 py-3 text-right text-slate-500 font-mono text-xs">
                            {item.unitPrice !== null ? (
                              formatNumber(item.unitPrice)
                            ) : (
                              <span className="text-slate-450 italic">คงราคาเดิมในระบบ</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center bg-emerald-50/10 text-emerald-600 font-black">
                            +{item.quantityReceived}
                          </td>
                          <td className="px-5 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRemoveReceiptItem(index)}
                              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1 rounded transition-colors"
                            >
                              <Trash2 className="w-5 h-5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom submits manual buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                     setReceiptItems([]);
                     setReferenceNo("");
                     setNotes("");
                  }}
                  disabled={loading || receiptItems.length === 0}
                  className="px-5 py-2 border border-slate-250 text-slate-600 bg-white hover:bg-slate-50 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ล้างตารางทั้งหมด
                </button>
                <button
                  type="submit"
                  disabled={loading || receiptItems.length === 0}
                  className="flex items-center px-8 py-2 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-lg text-sm shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                      กำลังบันทึกยอดพัสดุ...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      บันทึกรับเข้าคลังพัสดุ
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Excel */}
        {activeSubTab === "excel" && (
          <div className="p-6 bg-slate-50/20">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center pb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 mb-4 shadow-sm">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800">นำเข้าสต๊อกผ่านไฟล์ Excel</h3>
                <p className="text-slate-500 text-sm mt-1">
                  ดาวน์โหลดไฟล์เทมเพลตมาตรฐาน ระบุรายการรหัสและความคุ้มค่าอัปเพิ่ม จากนั้นจึงอัปโหลดเพื่อประมวลผลทันที
                </p>
              </div>

              <form onSubmit={handleExcelImportSubmit} className="space-y-5">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      ขั้นตอนที่ 1: จัดเตรียมเอกสารชีตตามแบบฟอร์ม
                    </span>
                    <button
                      type="button"
                      onClick={handleGrTemplateDownload}
                      className="inline-flex items-center text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 border border-indigo-150 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      โหลด Template.xlsx
                    </button>
                  </div>

                  <div className="mb-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      ขั้นตอนที่ 2: เลือกไฟล์อัปโหลด (.xlsx) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer group bg-slate-50/50 hover:bg-emerald-50/5 transition-all">
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-500 mx-auto mb-2 transition-colors" />
                      <span className="font-bold text-slate-700 text-xs block">
                        {excelFile ? excelFile.name : "ยังไม่ได้เลือกไฟล์สำหรับประมวลผลข้อมูล"}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        ขนาดไฟล์จำกัดไม่เกิน 15MB เฉพาะนามสกุล .xlsx เท่านั้น
                      </span>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setExcelFile(file);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-sm">
                  <span className="font-bold text-slate-800 block mb-4 border-b border-slate-100 pb-2">
                    ขั้นตอนที่ 3: ข้อมูลส่งอ้างอิงใบนำรับพัสดุ
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        เลขเอกสารอ้างอิง (PO / ใบส่งพัสดุ)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น Import-Batch-2501"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={excelRefNo}
                        onChange={(e) => setExcelRefNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        วันที่ลงบัญชีรับเข้าคลัง <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={excelReceiptDate}
                        onChange={(e) => setExcelReceiptDate(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        หมายเหตุอื่นๆ
                      </label>
                      <textarea
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={excelNotes}
                        onChange={(e) => setExcelNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !excelFile}
                    className="w-full flex items-center justify-center py-3 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-xl text-md shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                        กำลังตรวจสอบข้อมูลโครงสร้างฟอร์มตาราง...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        เริ่มประมวลผลนำข้อมูลขึ้นในระบบสต๊อก
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Status Report Logger */}
              {excelStatus && (
                <div
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-inner max-h-56 overflow-y-auto font-mono text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: excelStatus }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
