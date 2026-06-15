import React from "react";
import { Megaphone, CalendarCheck, AlertTriangle, PhoneCall } from "lucide-react";

export default function AnnouncementsTab() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in p-2">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">ประกาศข่าวสาร</h2>
        <p className="text-slate-500 mt-2 text-sm sm:text-base">อัปเดตข้อมูลและแจ้งเตือนจากแผนกคลังพัสดุ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-t-4 border-t-indigo-600 hover:shadow-md transition-all duration-300">
          <div className="flex items-start mb-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600 mr-4">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">รอบการตัด-จ่ายพัสดุประจำสัปดาห์</h3>
              <p className="text-xs text-slate-400 mt-1">อัปเดตล่าสุด: วันนี้</p>
            </div>
          </div>
          <div className="text-slate-600 text-sm space-y-3 pl-2 border-l-2 border-slate-100 ml-5 font-normal">
            <p>
              รอบการเบิกพัสดุของศูนย์การแพทย์จำกัดที่ <strong className="text-indigo-600">1 ครั้งต่อสัปดาห์</strong>
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2 text-slate-500">
              <li>
                คีย์ใบเบิกสำเร็จภายใน <strong className="text-slate-800 font-semibold">วันพุธ ก่อนเวลา 10:00 น.</strong> เพื่อรับพัสดุในวันศุกร์ถัดไป
              </li>
              <li>หากทำรายการเบิกหลังเวลาดังกล่าว คลังสินค้าจะยกยอดจ่ายไปจัดส่งพร้อมรอบใบเบิกของสัปดาห์ถัดไปโดยอัตโนมัติ</li>
            </ul>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-t-4 border-t-amber-500 hover:shadow-md transition-all duration-300">
          <div className="flex items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-500 mr-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">แจ้งเตือนสถานะสินค้า "ค้างจ่าย"</h3>
              <p className="text-xs text-slate-400 mt-1">อัปเดตล่าสุด: เมื่อวานนี้</p>
            </div>
          </div>
          <div className="text-slate-600 text-sm pl-2 border-l-2 border-slate-100 ml-5">
            <p>
              ในกรณีที่พัสดุในคลังมีปริมาณน้อยกว่ายอดเบิกจ่ายพัสดุ เจ้าหน้าที่คลังจะลงบันทึกในใบเบิกพัสดุของท่านเป็นสถานะ{" "}
              <strong className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-xs font-semibold">"ค้างจ่าย (Backorder)"</strong>
            </p>
            <p className="text-slate-500 mt-3 italic">
              เมื่อมีการเติมสินค้าพัสดุเข้าคลังเรียบร้อยแล้ว แผนกคลังพัสดุจะจัดส่งตามจ่ายของค้างจ่ายนั้นโดยตรงโดยที่ท่านไม่จำเป็นต้องสร้างใบเบิกใบใหม่
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-t-4 border-t-sky-500 hover:shadow-md transition-all duration-300 md:col-span-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center">
              <div className="p-3 bg-sky-50 rounded-lg text-sky-500 mr-4">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">ติดต่อสอบถามข้อมูลระบบขัดข้อง</h3>
                <p className="text-sm text-slate-500 font-normal">หากพบปัญหาการเบิกจ่ายหรือติดปัญหาใช้งาน กรุณาติดต่อสายด่วน</p>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-2xl font-black text-sky-600 tracking-wider">02-078-0056</p>
              <p className="text-sm text-slate-400">ต่อสายเบอร์ภายในแผนก: 0050</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
