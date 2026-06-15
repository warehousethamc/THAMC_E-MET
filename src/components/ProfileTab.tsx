import React, { useState, useEffect } from "react";
import { runScript } from "../utils/api";
import { User } from "../types";
import { UserCheck, Save, Key, UserCheck2, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";

interface ProfileTabProps {
  currentUser: User;
  departments: string[];
  onProfileUpdated: (updatedUser: User) => void;
}

export default function ProfileTab({ currentUser, departments, onProfileUpdated }: ProfileTabProps) {
  const [formName, setFormName] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormName(currentUser.name);
      setFormDepartment(currentUser.department);
    }
  }, [currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDepartment) {
      Swal.fire("กรุณาเลือกแผนก", "โปรดเลือกแผนกงานสังกัดอย่างเป็นทางการเสร็จสมบูรณ์", "warning");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      Swal.fire("รหัสผ่านไม่ตรงกัน", "รหัสเข้ารหัสผ่านใหม่และรหัสผ่านเพื่อยืนยันไม่ตรงกัน โปรดพิจารณากรอกข้อมูลใหม่อีกครั้ง", "error");
      return;
    }

    setSubmitting(true);
    try {
      const updatedData: any = {
        username: currentUser.username,
        name: formName.trim(),
        department: formDepartment,
      };
      if (newPassword) {
        updatedData.password = newPassword;
      }

      const res = await runScript("updateUserProfile", updatedData);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "อัปเดตสำเร็จ!",
          text: "ข้อมูลส่วนบุคคลของท่านได้รับการตรวจบันทึกเข้าสู่อย่างเรียบร้อยแล้ว",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000,
        });

        // Callback parent frame to update state
        onProfileUpdated({
          ...currentUser,
          name: updatedData.name,
          department: updatedData.department,
        });

        setNewPassword("");
        setConfirmPassword("");
      } else {
        Swal.fire("อัปเดตล้มเหลว", res.message || "เกิดความผิดพลาดของระบบหลังบ้าน", "error");
      }
    } catch (err: any) {
      Swal.fire("เกิดข้อผิดพลาดในการบันทึก", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-2 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 h-32 relative flex items-center justify-center">
          <div className="absolute -bottom-10 left-8 h-20 w-24 rounded-full bg-white p-1.5 shadow-lg border">
            <div className="h-full w-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold">
              {currentUser.name ? currentUser.name.slice(0, 1).toUpperCase() : "U"}
            </div>
          </div>
        </div>

        <div className="pt-16 pb-8 px-8 text-sm">
          <h2 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-2 flex items-center">
            <UserCheck className="w-6 h-6 text-indigo-600 mr-2" />
            ข้อมูลส่วนบุคคลด้านบัญชีผู้ยื่นเบิก
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  ชื่อผู้ใช้บัญชีหลัก (Username)
                </label>
                <input
                  type="text"
                  readOnly
                  className="w-full bg-slate-100 text-slate-400 font-mono text-center py-2 border border-slate-200 border-dashed rounded-lg text-sm shadow-inner"
                  value={currentUser.username}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  ชื่อ-นามสกุล บุคลากร <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ป้อนชื่อและนามสกุลจริง"
                  className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  แผนกงานสังกัด <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  className="w-full bg-white border border-slate-350 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-750 text-sm focus:outline-none"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                >
                  <option value="" disabled>-- โปรดเลือกแผนกสังกัด --</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Change Password segments */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <h3 className="text-md font-bold text-amber-600 mb-4 flex items-center uppercase tracking-wide">
                <Key className="w-5 h-5 text-amber-500 mr-2" />
                รีเซ็ตปรับแต่งรหัสผ่านรักษาความปลอดภัย (ทางเลือก)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    รหัสผ่านรังเกียจชุดใหม่ (ใหม่)
                  </label>
                  <input
                    type="password"
                    placeholder="ปล่อยว่างไว้หากตัวต้องการคงรหัสพวงเดิม..."
                    className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none placeholder:text-gray-350"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ยืนยันตัวตนรหัสผ่านใหม่อีกครั้ง
                  </label>
                  <input
                    type="password"
                    placeholder="ป้อนรหัสผ่านซ้ำอีกรอบ..."
                    className="w-full bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-slate-700 text-sm focus:outline-none placeholder:text-gray-350"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center px-8 py-2 bg-indigo-600 font-bold hover:bg-slate-700 rounded-lg text-white hover:text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    กำลังบันทึกประวัติพนักงาน...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    บันทึกข้อมูลส่วนตัวของฉัน
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
