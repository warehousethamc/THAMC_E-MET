import React, { useState, useEffect } from "react";
import { runScript, formatDateTimeForDisplay } from "../utils/api";
import { User } from "../types";
import {
  Users,
  Search,
  UserCog,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  X,
  Save,
  Key
} from "lucide-react";
import Swal from "sweetalert2";

interface AdminUsersTabProps {
  currentUser: User;
  departments: string[];
}

export default function AdminUsersTab({ currentUser, departments }: AdminUsersTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Modal forms fields State
  const [formName, setFormName] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formRole, setFormRole] = useState<any>("User");
  const [formNewPassword, setFormNewPassword] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await runScript("getAllUsers", currentUser);
      if (data.error) {
         Swal.fire("ข้อผิดพลาด", data.message || "เกิดข้อขัดข้องในการโหลดข้อมูลผู้ใช้", "error");
         return;
      }
      setUsers(data || []);
      setCurrentPage(1);
    } catch (e: any) {
      Swal.fire("ดึงข้อมูลผู้ใช้ขัดข้อง", e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormDepartment(user.department);
    setFormRole(user.role);
    setFormNewPassword("");
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const userDataToUpdate = {
      usernameToUpdate: editingUser.username,
      name: formName.trim(),
      department: formDepartment,
      role: formRole,
      newPassword: formNewPassword.trim()
    };

    if (!userDataToUpdate.name || !userDataToUpdate.department || !userDataToUpdate.role) {
       Swal.fire("ข้อมูลไม่ครบถ้วน", "กรุณาระบุรายละเอียดให้ครบถ้วนก่อนการบันทึกสิทธิ์ผู้ใช้งาน", "warning");
       return;
    }

    setLoading(true);
    try {
      const res = await runScript("updateUserByAdmin", userDataToUpdate, currentUser);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "บันทึกเสร็จสิ้น!",
          text: "สิทธิ์การเข้าถึงข้อมูลระบบของผู้ใช้งานได้รับการอัปเดตเรียบร้อย",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000,
        });
        setModalOpen(false);
        fetchUsers();
      } else {
        Swal.fire("บันทึกสิทธิ์ล้มเหลว", res.message || "เกิดข้อผิดพลาดทางเซิร์ฟเวอร์", "error");
      }
    } catch (err: any) {
      Swal.fire("เกิดข้อผิดพลาดในการบันทึก", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === currentUser.username) {
      Swal.fire("ยกเลิกการดำเนินงาน", "คุณไม่สามารถลบบัญชีผู้ใช้งานระบบสัญกรณ์ที่ตนเองกำลังเข้าใช้งานอยู่ในพริบตานี้", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: `ลบผู้ใช้งานระบบ?`,
      html: `คุณปลอดภัยหรือไม่ที่จะลบผู้ใช้ <strong class="text-rose-500 font-mono">${username}</strong> ออกจากระบบคลังพัสดุถาวร`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบผู้ใช้และถอนสิทธิ์",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#e11d48",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);
    try {
      const res = await runScript("deleteUserByAdmin", username, currentUser);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "ลบสำเร็จ",
          text: "บัญชีผู้ใช้นี้ได้ถูกกำจัดสิทธิ์ในการเข้าถึงพัสดุเป็นทางการแล้ว",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2000,
        });
        fetchUsers();
      } else {
        Swal.fire("เกิดข้อผิดพลาดในการลบ", res.message || "Unknown error", "error");
      }
    } catch (err: any) {
      Swal.fire("เกิดข้อผิดพลาดในการทำรายการ", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <div className="max-w-6xl mx-auto p-2 animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center">
              <UserCog className="w-6 h-6 text-indigo-600 mr-2" />
              จัดการสิทธิ์ผู้ใช้งานระบบ
            </h2>
            <p className="text-slate-500 text-xs mt-1">คัดแต่งสิทธิ์การเข้าใช้งาน สิทธิ์อนุมัติ ตลอดจนจัดการรีเซ็ตรหัสผ่านพนักงานทางการพัสดุ</p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center text-xs font-semibold px-4 py-2 border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            ดึงข้อมูลล่าสุด
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้บริการ, ชื่อแอดมิน, แผนก, หรือระดับสิทธิ์..."
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg pl-10 pr-4 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-normal"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Users list table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm text-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-5 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                  ชื่อบัญชี (Username)
                </th>
                <th className="px-5 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                  ชื่อ-นามสกุล บุคลากร
                </th>
                <th className="px-5 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                  แผนกสังกัด
                </th>
                <th className="px-5 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                  ขอบเขตสิทธิ์ (Role)
                </th>
                <th className="px-5 py-3 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">
                  สร้างเมื่อ
                </th>
                <th className="px-5 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 bg-white">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">กำลังสตรีมดึงสิทธิ์พนักงาน...</p>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 bg-white">
                    <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    ไม่พบบัญชีพนักงานสังกัดตามที่ทำการกรองกรอกค้นหา
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  let roleBadge = "bg-slate-100 text-slate-600";
                  if (user.role === "Admin") roleBadge = "bg-rose-100 text-rose-700 font-bold border border-rose-200";
                  else if (user.role === "Manager") roleBadge = "bg-orange-100 text-orange-700 font-bold border border-orange-200";
                  else if (user.role === "Staff") roleBadge = "bg-emerald-100 text-emerald-700 font-bold border border-emerald-200";

                  return (
                    <tr key={user.username} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-500 text-xs">{user.username}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{user.name}</td>
                      <td className="px-5 py-4 text-slate-500">{user.department}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded text-xs uppercase ${roleBadge}`}>{user.role}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400">{formatDateTimeForDisplay(user.createdAt)}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors inline-block"
                          title="แก้ไขสิทธิ์"
                        >
                          <UserCog className="w-4 h-4" />
                        </button>
                        {currentUser.username !== user.username && (
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="text-rose-600 hover:bg-rose-50 p-2 rounded-full transition-colors inline-block ml-1"
                            title="ลบบัญชีพนักงาน"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginations Controls */}
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
              (พนักงานทั้งหมดประมวลผล {filteredUsers.length} บัญชีคู่สาย)
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

      {/* [MODAL EDIT PROCESS] Admin Edit Users dialog */}
      {modalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-auto overflow-hidden animate-scale-up border border-slate-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 flex items-center">
                <Shield className="w-5 h-5 text-indigo-650 mr-2" />
                ปรับปรุงสิทธิ์บทบาทและรหัสพนักงาน
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-2xl h-8 w-8 hover:bg-slate-100 rounded-full flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                    ชื่อเข้าระบบ (Username - ยืนยันในลิสต์ระบบ)
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="w-full bg-slate-100 text-slate-500 font-mono py-1.5 px-3 rounded-lg border border-slate-200 text-sm shadow-inner"
                    value={editingUser.username}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                    ชื่อ-นามสกุล บุคลากร <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                      สังกัดแผนกทำงาน <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                    >
                      <option value="" disabled>-- เลือกแผนกสังกัด --</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
                      สิทธิ์อนุญาติในองค์กร <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      className="w-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                    >
                      <option value="User">User</option>
                      <option value="Staff">Staff (คลังพัสดุ)</option>
                      <option value="Manager">Manager (ผจก.อนุมัติ)</option>
                      <option value="Admin">Admin (แอดมินดูแลระบบ)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4">
                  <label className="block text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center">
                    <Key className="w-3.5 h-3.5 mr-1" />
                    กำหนดรหัสผ่านชุดใหม่ (บังคับเปลี่ยนสิทธิ์)
                  </label>
                  <input
                    type="password"
                    placeholder="พิมพ์รหัสผ่านใหม่ที่นี่เมื่อพึงประสงค์รีเซ็ต..."
                    className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                    value={formNewPassword}
                    onChange={(e) => setFormNewPassword(e.target.value)}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-6 shrink-0 border-t border-slate-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-5 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-lg text-sm font-semibold transition-all"
                  >
                    ยกเลิกพิจารณา
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2 bg-indigo-650 hover:bg-indigo-750 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-lg text-sm shadow-md transition-all duration-300"
                  >
                    บันทึกข้อมูลสิทธิ์ที่เปลี่ยน
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
