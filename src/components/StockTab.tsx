import React, { useState, useEffect } from "react";
import { runScript, formatNumber, formatDateTimeForDisplay } from "../utils/api";
import { User, InventoryItem } from "../types";
import {
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertTriangle,
  Folder,
  MapPin,
  Image,
  Upload,
  X
} from "lucide-react";
import Swal from "sweetalert2";

interface StockTabProps {
  currentUser: User;
  onRefreshTrigger?: () => void;
}

export default function StockTab({ currentUser, onRefreshTrigger }: StockTabProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog Add / Edit state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditItem] = useState<InventoryItem | null>(null);

  // Form Field State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formUnitPrice, setFormUnitPrice] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formMinQuantity, setFormMinQuantity] = useState("");

  // Storage Image state
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedItemIdForImage, setSelectedItemIdForImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const data = await runScript("getInventoryItems");
      setItems(data || []);
      setCurrentPage(1);
    } catch (e: any) {
      Swal.fire("ดึงสต๊อกล้มเหลว", e.message || "เกิดความผิดพลาดของระบบ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setEditItem(null);
    setFormCode("");
    setFormName("");
    setFormCategory("");
    setFormLocation("");
    setFormUnit("");
    setFormUnitPrice("0");
    setFormQuantity("0");
    setFormMinQuantity("5");
    setModalOpen(true);
  };

  const handleOpenEditDialog = (item: InventoryItem) => {
    setEditItem(item);
    setFormCode(item.code);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormLocation(item.Location);
    setFormUnit(item.unit);
    setFormUnitPrice(item.UnitPrice.toString());
    setFormQuantity(item.quantity.toString());
    setFormMinQuantity(item.minQuantity.toString());
    setModalOpen(true);
  };

  const handleDeleteItem = async (itemId: string, itemCode: string) => {
    const confirm = await Swal.fire({
      title: `ลบวัสดุพัสดุ?`,
      html: `คุณปลอดภัยหรือไม่ที่จะลบรายการพัสดุ <strong class="text-rose-500 font-mono">${itemCode}</strong> ออกจากระบบถาวร ไม่สามารถย้อนกลับได้!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันลบพัสดุ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#e11d48",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);
    try {
      const res = await runScript("deleteInventoryItem", itemId);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "ลบสำเร็จ",
          text: "รายการพัสดุถูกลบเรียบร้อยแล้ว",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2000,
        });
        fetchStock();
        if (onRefreshTrigger) onRefreshTrigger();
      } else {
        Swal.fire("เสียใจด้วย", res.message || "เกิดข้อผิดพลาดในการลบ", "error");
      }
    } catch (err: any) {
      Swal.fire("ข้อผิดพลาด", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemData = {
      id: editingItem ? editingItem.id : undefined,
      code: formCode.trim(),
      name: formName.trim(),
      category: formCategory.trim(),
      location: formLocation.trim(),
      unit: formUnit.trim(),
      unitPrice: parseFloat(formUnitPrice),
      quantity: parseInt(formQuantity),
      minQuantity: parseInt(formMinQuantity),
    };

    if (isNaN(itemData.unitPrice) || itemData.unitPrice < 0) {
      Swal.fire("ข้อมูลผิดพลาด", "ราคาต่อหน่วยต้องไม่น้อยกว่า 0", "warning");
      return;
    }
    if (isNaN(itemData.quantity) || itemData.quantity < 0) {
      Swal.fire("ข้อมูลผิดพลาด", "คงเหลือจริงในคลังต้องไม่ต่ำกว่า 0", "warning");
      return;
    }
    if (isNaN(itemData.minQuantity) || itemData.minQuantity < 0) {
      Swal.fire("ข้อมูลผิดพลาด", "ยอดแจ้งเตือนจุดสั่งซื้อต้องไม่ต่ำกว่า 0", "warning");
      return;
    }

    setLoading(true);
    try {
      const action = editingItem ? "updateInventoryItem" : "addInventoryItem";
      const res = await runScript(action, itemData);

      if (res.success) {
        Swal.fire({
          icon: "success",
          title: editingItem ? "แก้ไขเสร็จสิ้น" : "เพิ่มพัสดุเรียบร้อย",
          text: editingItem ? "รายละเอียดข้อมูลพัสดุได้รับการอัปเดตแล้ว" : "พัสดุชิ้นใหม่เข้าสู่ฐานข้อมูลแล้ว",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000,
        });

        setModalOpen(false);
        fetchStock();
        if (onRefreshTrigger) onRefreshTrigger();
      } else {
        Swal.fire("ไม่สามารถทำรายการได้", res.message || "เกิดข้อผิดพลาดทางเทคนิค", "error");
      }
    } catch (err: any) {
      Swal.fire("เกิดข้อผิดพลาดในการบันทึก", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Image Upload logic
  const handleOpenImageUploader = (itemId: string) => {
    setSelectedItemIdForImage(itemId);
    setImageModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedItemIdForImage) return;

    if (!file.type.startsWith("image/")) {
      Swal.fire("ไฟล์ไม่ถูกต้อง", "กรุณาอัปโหลดเฉพาะไฟล์รูปภาพหลักเท่านั้น (.png, .jpg, .jpeg)", "warning");
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = (evt.target?.result as string).split(",")[1];
        const res = await runScript("uploadInventoryImage", selectedItemIdForImage, base64, file.type);
        if (res.success) {
          Swal.fire({
            icon: "success",
            title: "อัปโหลดรูปภาพสำเร็จ!",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 2000,
          });
          setImageModalOpen(false);
          fetchStock();
        } else {
          Swal.fire("ล้มเหลว", res.message || "เกิดข้อผิดพลาด", "error");
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      Swal.fire("เกิดข้อผิดพลาดในการนำรูปภาพขึ้น Storage", err.message, "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (itemId: string) => {
    const confirm = await Swal.fire({
      title: "ลบรูปภาพวัสดุ?",
      text: "คุณแน่ใจว่าต้องการลบรูปภาพพรีวิวนี้ออกจากแคตตาล็อก",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#e11d48",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);
    try {
      const res = await runScript("deleteInventoryImage", itemId);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "ลบรูปภาพสำเร็จ",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2000,
        });
        fetchStock();
      } else {
        Swal.fire("ล้มเหลว", res.message, "error");
      }
    } catch (e: any) {
      Swal.fire("ระบบมีปัญหา", e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.Location && item.Location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredItems.slice(startIndex, endIndex);

  return (
    <div className="max-w-[100rem] mx-auto p-2 animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header container */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">จัดการคลังพัสดุและคลังวัศดุคงคลัง</h2>
            <p className="text-slate-500 text-xs mt-1">
              เพิ่ม ลด ลบ และปรับปรุงราคา รูปภาพ ตลอดจนจุดสั่งซื้อเตือนสต๊อก ต่ำกว่าขั้นต่ำ
            </p>
          </div>
          <button
            onClick={handleOpenAddDialog}
            className="flex items-center text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-lg shadow-md transition-all duration-300"
          >
            <Plus className="w-5 h-5 mr-1" />
            เพิ่มวัสดุใหม่
          </button>
        </div>

        {/* Global Catalog Filter Search */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาพัสดุด้วย รหัส, ชื่อ, หมวดหมู่พัสดุ หรือสถานที่จัดเก็บในศูนย์..."
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg pl-10 pr-4 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-normal"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <button
            onClick={fetchStock}
            className="w-full sm:w-auto flex items-center justify-center text-xs font-semibold px-4 py-2 border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            ดึงข้อมูลล่าสุด
          </button>
        </div>

        {/* Stock main grid table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-20 bg-white">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">กำลังสตรีมประมวลผลสต๊อก...</p>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-20 bg-white text-slate-400">
                    <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    ไม่พบพัสดุชิ้นใดอยู่ในฐานข้อมูลสต๊อกตามหัวข้อค้นหา
                  </td>
                </tr>
              ) : (
                <>
                  {/* Table headers */}
                  <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200 text-xs text-left">
                    <th className="px-4 py-3 w-10 text-center">ID</th>
                    <th className="px-4 py-3 w-28">ภาพวัสดุ</th>
                    <th className="px-4 py-3 w-32">รหัสพัสดุ</th>
                    <th className="px-4 py-3">ชื่อสินค้าพัสดุ / หมวดหมู่</th>
                    <th className="px-4 py-3">ที่จัดเก็บ (Location)</th>
                    <th className="px-4 py-3 text-center">หน่วยนับ</th>
                    <th className="px-4 py-3 text-right">ราคา/หน่วย</th>
                    <th className="px-4 py-3 text-center">คงเหลือในคลัง</th>
                    <th className="px-4 py-3 text-center">จุดสั่งชื้อ Min</th>
                    <th className="px-4 py-3">ปรับปรุงเมื่อ</th>
                    <th className="px-4 py-3 text-center w-28">จัดการพัสดุ</th>
                  </tr>
                  {paginatedData.map((item) => {
                    const isOut = item.quantity <= 0;
                    const isLow = item.quantity > 0 && item.quantity <= item.minQuantity;

                    let stockBadge = "text-emerald-700 bg-emerald-50 border-emerald-200";
                    if (isOut) stockBadge = "text-rose-700 bg-rose-50 border-rose-200 font-black animate-pulse";
                    else if (isLow) stockBadge = "text-amber-700 bg-amber-50 border-amber-200 font-bold";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-200 last:border-none">
                        <td className="px-4 py-4 text-center text-slate-400 font-mono text-xs">{item.id}</td>
                        {/* Material Preview Image */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-center">
                            {item.imageUrl ? (
                              <div className="relative group/img h-14 w-14 rounded-lg border border-slate-200 overflow-hidden bg-white flex items-center justify-center shadow-inner">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="max-h-full max-w-full object-contain cursor-zoom-in"
                                  onClick={() => Swal.fire({ imageUrl: item.imageUrl!, showConfirmButton: false })}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImage(item.id)}
                                  className="absolute top-0 right-0 p-0.5 bg-rose-500 text-white rounded-bl opacity-0 group-hover/img:opacity-100 transition-opacity"
                                  title="ลบรูปภาพ"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenImageUploader(item.id)}
                                className="h-14 w-14 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg flex flex-col items-center justify-center text-[10px] gap-0.5 transition-all w-full"
                              >
                                <Upload className="w-4 h-4" />
                                <span>อัปภาพ</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono font-bold text-xs text-slate-500 text-left">{item.code}</td>
                        <td className="px-4 py-4">
                          <p className="font-extrabold text-slate-800 text-sm leading-snug">{item.name}</p>
                          <span className="inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-100 ring-1 ring-slate-200 rounded px-1.5 py-0.5 mt-1.5">
                            <Folder className="w-2.5 h-2.5 mr-1" />
                            {item.category || "ไม่มี"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center text-xs font-medium text-slate-500">
                            <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            {item.Location || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-slate-500">{item.unit || "-"}</td>
                        <td className="px-4 py-4 text-right font-medium text-slate-600 font-mono">
                          {formatNumber(item.UnitPrice)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-block px-3 py-1 text-xs border rounded-full font-bold ${stockBadge}`}>
                            {item.quantity} {item.unit}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-500">{item.minQuantity}</td>
                        <td className="px-4 py-4 text-xs text-slate-400">{formatDateTimeForDisplay(item.updatedAt)}</td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditDialog(item)}
                            className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors inline-block"
                            title="แก้ไขพัสดุ"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.code)}
                            className="text-rose-600 hover:bg-rose-50 p-2 rounded-full transition-colors inline-block ml-1"
                            title="ลบพัสดุ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginations controls */}
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

          <div className="text-sm font-medium text-slate-500 animate-fade-in">
            หน้า <span className="text-slate-800 font-bold">{currentPage}</span> จาก{" "}
            <span className="text-slate-800 font-bold">{totalPages || 1}</span>{" "}
            <span className="text-xs text-slate-400 font-normal">
              (คัดกรองพัสดุทั้งหมด {filteredItems.length} รายการเสร็จสิ้น)
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
      </div>

      {/* [MODAL DIALOG DIALOG] Add/Edit Materials form */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-auto max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black text-slate-800 flex items-center">
                <Package className="text-indigo-600 w-5 h-5 mr-2" />
                {editingItem ? "แก้ไขรายละเอียดพัสดุ" : "เพิ่มพัสดุชิ้นใหม่เข้าระบบ"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-450 hover:text-slate-650 h-8 w-8 hover:bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSaveItem} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2 bg-indigo-50/40 p-4 rounded-lg border border-indigo-100/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        รหัสพัสดุ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                        placeholder="เช่น M-OFF001"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ชื่อพัสดุวัสดุทางการแพทย์ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                        placeholder="เช่น กระดาษดับเบิ้ลเอ A4"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      หมวดหมู่พัสดุ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                      placeholder="เช่น เครื่องเขียน, อุปกรณ์การแพทย์"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      สถานที่จัดเก็บ / ที่ตั้งคลัง
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                      placeholder="เช่น ตู้ A ชั้น 2, ห้องคลัง 1"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      หน่วยนับวัสดุ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                      placeholder="เช่น แพ็ค, กล่อง, ชิ้น"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      ราคาซื้อ/จ่ายต่อหน่วย (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none font-mono"
                      placeholder="เช่น 120.00"
                      value={formUnitPrice}
                      onChange={(e) => setFormUnitPrice(e.target.value)}
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
                      ระดับพัสดุในคลัง (ปัจจุบัน) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full text-center bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-2 text-indigo-600 font-black text-lg focus:outline-none"
                      placeholder="0"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                    />
                  </div>

                  <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                    <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
                      จุดสั่งซื้อวิกฤตเตือน (Min Stock) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full text-center bg-white border border-rose-200 focus:ring-2 focus:ring-rose-500 rounded-lg px-3 py-2 text-rose-700 font-extrabold text-lg focus:outline-none"
                      placeholder="5"
                      value={formMinQuantity}
                      onChange={(e) => setFormMinQuantity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6 shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-5 py-2 border border-slate-200 text-slate-650 bg-white hover:bg-slate-50 rounded-lg text-sm font-semibold transition-all"
                  >
                    ยกเลิกพิจารณา
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-lg text-sm shadow-md transition-all duration-300"
                  >
                    {editingItem ? "บันทึกข้อมูลล่าสุด" : "ลงทะเบียนพัสดุใหม่"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* [MODAL DIALOG IMAGE] Image Upload modal */}
      {imageModalOpen && selectedItemIdForImage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-auto overflow-hidden animate-scale-up border border-slate-200">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center">
                <Image className="w-5 h-5 text-indigo-600 mr-2" />
                อัปโหลดรูปภาพพัสดุ
              </h3>
              <button
                onClick={() => setImageModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 font-bold text-2xl h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100"
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              <div className="border-2 border-dashed border-slate-350 hover:border-indigo-400 rounded-xl p-8 text-center transition-colors relative cursor-pointer group bg-slate-50 hover:bg-indigo-50/10">
                <Upload className="w-10 h-10 text-slate-400 mx-auto group-hover:text-indigo-500 mb-3 transition-colors" />
                {uploadingImage ? (
                  <p className="text-indigo-700 font-bold animate-pulse text-sm">กำลังสตรีมอัปไฟล์ภาพ...</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-700">คลิกที่นี่เพื่อเปิดเลือกรูปถ่ายพพัสดุ</p>
                    <p className="text-xs text-slate-400 mt-1">ไฟล์ที่รองรับ: .png, .jpg, .jpeg ยอดจำกัด 10MB</p>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  disabled={uploadingImage}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
