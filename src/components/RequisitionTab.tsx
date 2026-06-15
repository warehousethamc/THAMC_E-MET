import React, { useState, useEffect } from "react";
import { runScript, formatNumber, formatDateForDisplay } from "../utils/api";
import { User, InventoryItem } from "../types";
import {
  FileText,
  Calendar,
  User as UserIcon,
  Briefcase,
  Search,
  ShoppingCart,
  Trash2,
  Send,
  X,
  Plus,
  Compass,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import Swal from "sweetalert2";

interface RequisitionTabProps {
  currentUser: User;
}

export default function RequisitionTab({ currentUser }: RequisitionTabProps) {
  const [requisitionDate, setRequisitionDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setLoading] = useState(false);
  const [cart, setCart] = useState<any[]>([]);

  // Inventory logic
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedItemsModalOpen, setSelectedItemsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    // Set default date to today in YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10);
    setRequisitionDate(today);
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoadingInventory(true);
    try {
      const data = await runScript("getInventoryItems");
      setInventory(data || []);
    } catch (e) {
      console.error("Failed to load inventory for requisition basket:", e);
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleOpenSearchModal = () => {
    // Reset modal searches
    setSearchTerm("");
    const newQuants: Record<string, number> = {};
    inventory.forEach((item) => {
      const existing = cart.find((c) => c.id === item.id);
      newQuants[item.id] = existing ? existing.requestedQuantity : 0;
    });
    setQuantities(newQuants);
    setSelectedItemsModalOpen(true);
  };

  const handleAddItemsFromModal = () => {
    const updatedCart: any[] = [];
    let overStockAlert = false;

    inventory.forEach((item) => {
      const qty = quantities[item.id] || 0;
      if (qty > 0) {
        if (qty > item.quantity) {
          overStockAlert = true;
        }
        updatedCart.push({
          id: item.id,
          code: item.code,
          name: item.name,
          location: item.Location || "N/A",
          unit: item.unit,
          unitPrice: item.UnitPrice || 0,
          requestedQuantity: qty,
        });
      }
    });

    setCart(updatedCart);
    setSelectedItemsModalOpen(false);

    if (updatedCart.length > 0) {
      if (overStockAlert) {
        Swal.fire({
          icon: "warning",
          title: "เพิ่มลงตะกร้าแล้ว",
          text: `บางรายการมียอดเบิกเกินปริมาณคงเหลือในคลัง ซึ่งจะถูกอนุมัติจ่ายเป็นรายการค้างจ่าย (Backorder) หากคลังพัสดุอนุมัติ`,
          confirmButtonText: "รับทราบ",
          confirmButtonColor: "#d97706",
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "เพิ่มรายการสำเร็จ",
          text: `เพิ่มวัสดุจำนวน ${updatedCart.length} รายการเข้าตะกร้าเรียบร้อย`,
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2000,
        });
      }
    }
  };

  const handleRemoveFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const handleUpdateCartQty = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) return;
    const updated = [...cart];
    updated[index].requestedQuantity = newQty;
    setCart(updated);
  };

  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      Swal.fire("กรุณาเลือกรายการ", "กรุณาเพิ่มรายการพัสดุประสงค์เบิกอย่างน้อย 1 รายการลงตะกร้า", "warning");
      return;
    }

    const confirmSubmit = await Swal.fire({
      title: "ยืนยันส่งใบเบิก?",
      text: "คุณกำลังจัดตั้งคำขอใบเบิกเพื่อเสนอขอพิจารณาไปยังผู้จัดการ แผนกคลังพัสดุ",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ส่งใบเบิกพัสดุ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#4f46e5",
    });

    if (!confirmSubmit.isConfirmed) return;

    setLoading(true);
    try {
      const payloadData = {
        date: requisitionDate,
        purpose: purpose.trim(),
        requestedBy: currentUser.username,
        requestorName: currentUser.name,
        requestorDepartment: currentUser.department,
      };

      const itemsPayload = cart.map((c) => ({
        itemId: c.id,
        itemName: c.name,
        quantity: c.requestedQuantity,
        unit: c.unit,
      }));

      const res = await runScript("createRequisition", payloadData, itemsPayload);
      if (res.success) {
        await Swal.fire({
          icon: "success",
          title: "ส่งคำขอสำเร็จ!",
          html: `ระบบสร้างใบเบิกเลขที่ <strong class="text-indigo-600 font-bold">${res.requisitionId}</strong> สำเร็จเรียบร้อยแล้ว`,
          confirmButtonColor: "#059669",
        });

        // Reset Form
        setCart([]);
        setPurpose("");
        // Reload inventories
        loadInventory();
      } else {
        Swal.fire("ข้อผิดพลาด", res.message || "ไม่สามารถทำรายการใบเบิกได้", "error");
      }
    } catch (err: any) {
      Swal.fire("เกิดข้อผิดพลาด", err.message || "เกิดความเสียหายทางระบบคลังพัสดุ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    Swal.fire({
      title: "ล้างตระกร้าทั้งหมด?",
      text: "รายการวัสดุที่เลือกไว้จะหายไปทั้งหมด",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      confirmButtonText: "ยืนยันล้างข้อมูล",
      cancelButtonText: "ยกเลิก",
    }).then((result) => {
      if (result.isConfirmed) {
        setCart([]);
        setPurpose("");
      }
    });
  };

  const filteredItems = inventory.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto p-2 animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center">
            <FileText className="w-5 h-5 text-indigo-600 mr-2" />
            สร้างใบเบิกวัสดุพัสดุ (New Requisition)
          </h2>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmitRequisition}>
            {/* Header section (Readonly user profiles) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 bg-slate-50/50 p-5 rounded-lg border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  เลขที่ใบเบิกพัสดุ
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-100 text-slate-500 text-center font-mono py-2 rounded-lg border border-slate-200 border-dashed text-sm"
                  readOnly
                  value="[ สร้างอัตโนมัติ ]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  วันที่ต้องการเบิกใช้ <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={requisitionDate}
                    onChange={(e) => setRequisitionDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  ชื่อผู้ยื่นเบิกพัสดุ
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    readOnly
                    value={currentUser.name}
                    className="w-full pl-10 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  แผนกสังกัดงาน
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    readOnly
                    value={currentUser.department}
                    className="w-full pl-10 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-sm"
                  />
                </div>
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  วัตถุประสงค์ความต้องการเบิกใช้พัสดุ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="กรุณาระบุวัตถุประสงค์โดยเฉพาะเจาะจง หรือสถานการณ์ที่จะนำพัสดุนี้ไปประกอบการดำเนินงาน..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
            </div>

            {/* Middle Section (Select Materials list) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <ShoppingCart className="w-5 h-5 text-indigo-600 mr-2" />
                ตระกร้าเบิกพัสดุ ({cart.length} รายการ)
              </h3>
              <button
                type="button"
                onClick={handleOpenSearchModal}
                disabled={loadingInventory}
                className="flex items-center text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
              >
                <Search className="w-4 h-4 mr-1.5" />
                ค้นหาและเพิ่มพัสดุ
              </button>
            </div>

            {/* Cart Listing table */}
            <div className="overflow-x-auto mb-6 border border-slate-200 rounded-xl shadow-sm bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      รหัสพัสดุ
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      ชื่อพัสดุคงคลัง
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                      ที่จัดเก็บ (คลัง)
                    </th>
                    <th className="px-6 py-3 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">
                      หน่วยนับ
                    </th>
                    <th className="px-6 py-3 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">
                      ราคาต่อหน่วย
                    </th>
                    <th className="px-6 py-3 text-center font-bold text-indigo-700 text-xs uppercase tracking-wider bg-indigo-50/30">
                      จำนวนที่เบิก
                    </th>
                    <th className="px-6 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 bg-white">
                        <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        ยังไม่มีรายการวัสดุชิ้นใดส่งเบิกในตระกร้าของคุณ
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-slate-500">{item.code}</td>
                        <td className="px-6 py-3 font-semibold text-slate-800">{item.name}</td>
                        <td className="px-6 py-3 text-slate-500">{item.location}</td>
                        <td className="px-6 py-3 text-center text-slate-500">{item.unit}</td>
                        <td className="px-6 py-3 text-right text-slate-500">
                          {formatNumber(item.unitPrice)}
                        </td>
                        <td className="px-6 py-3 text-center bg-indigo-50/10">
                          <input
                            type="number"
                            min="1"
                            value={item.requestedQuantity}
                            onChange={(e) =>
                              handleUpdateCartQty(index, parseInt(e.target.value) || 1)
                            }
                            className="w-20 px-2 py-1 border border-indigo-200 focus:ring-1 focus:ring-indigo-400 font-extrabold text-center rounded text-indigo-600 focus:outline-none"
                          />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(index)}
                            className="text-slate-400 hover:text-rose-500 rounded p-1 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-5.5 h-5.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClearForm}
                disabled={submitting || cart.length === 0}
                className="px-5 py-2 border border-slate-200 text-slate-600 font-bold bg-white hover:bg-slate-50 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ล้างข้อมูลตะกร้า
              </button>
              <button
                type="submit"
                disabled={submitting || cart.length === 0}
                className="flex items-center px-8 py-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-lg text-sm shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    กำลังประมวลผลคำขอ...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5" />
                    ส่งใบเบิกวัสดุ
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* [MODAL] Items Selection Modal with nice image previews and pagination-free live filtering */}
      {selectedItemsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-auto flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 animate-scale-up">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black text-slate-800 flex items-center">
                <Plus className="w-5 h-5 text-indigo-600 mr-2" />
                ค้นหาและเลือกพัสดุต้องการจัดเบิก
              </h3>
              <button
                onClick={() => setSelectedItemsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาด้วยรหัสคลังสินค้า, ชื่อพัสดุ, หมวดหมู่พัสดุ หรือพื้นที่จัดเก็บ..."
                  className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg pl-10 pr-4 py-2 text-slate-700 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-normal"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar bg-slate-50/30 p-2">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-white sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase text-xs">
                      รายการพัสดุในคลัง
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase text-xs w-28">
                      คงเหลือ (คลัง)
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-indigo-700 uppercase text-xs w-40 bg-indigo-50">
                      ระบุจำนวนเบิก
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-slate-400">
                        <Compass className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        ไม่พบคลังวัสดุพัสดุชิ้นใดตรงกับการค้นหาระบุ
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isOut = item.quantity <= 0;
                      const isLow = item.quantity <= item.minQuantity && !isOut;
                      let stockColor = "text-emerald-700 bg-emerald-50 border-emerald-100";
                      if (isOut) stockColor = "text-rose-700 bg-rose-50 border-rose-100";
                      else if (isLow) stockColor = "text-amber-700 bg-amber-50 border-amber-100";

                      const actualImg =
                        item.imageUrl && item.imageUrl !== "null"
                          ? item.imageUrl
                          : "https://via.placeholder.com/150/f1f5f9/cbd5e1?text=No+Img";

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-start space-x-3">
                              {/* Lightbox thumbnail preview */}
                              <div
                                onClick={() => item.imageUrl && setPreviewImage(item.imageUrl)}
                                className={`shrink-0 h-14 w-14 rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center shadow-sm select-none transition-transform hover:scale-105 duration-200 ${
                                  item.imageUrl ? "cursor-pointer" : "cursor-default"
                                }`}
                              >
                                <img src={actualImg} alt={item.name} className="max-h-full max-w-full object-contain" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  <span className="font-mono text-slate-500 mr-2">{item.code}</span>
                                  <span>{item.category}</span>
                                  {item.Location && (
                                    <span className="ml-2 bg-slate-100 px-1 rounded text-[10px]">
                                      พื้นที่: {item.Location}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs border ${stockColor}`}
                            >
                              {item.quantity} {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center align-middle bg-indigo-50/10">
                            <input
                              type="number"
                              min="0"
                              className="w-full max-w-[110px] px-3 py-1.5 border border-indigo-200 focus:ring-1 focus:ring-indigo-400 text-center font-bold text-indigo-600 focus:outline-none rounded"
                              placeholder="0"
                              value={quantities[item.id] || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setQuantities({
                                  ...quantities,
                                  [item.id]: val >= 0 ? val : 0,
                                });
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end space-x-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button
                onClick={() => setSelectedItemsModalOpen(false)}
                className="px-5 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-lg text-sm font-bold transition-all"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={handleAddItemsFromModal}
                className="px-8 py-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-lg text-sm shadow-md transition-all flex items-center"
              >
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                เพิ่มลงตะกร้าพัสดุ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 h-10 w-10 flex items-center justify-center text-2xl font-bold transition-colors shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/15"
          />
        </div>
      )}
    </div>
  );
}
