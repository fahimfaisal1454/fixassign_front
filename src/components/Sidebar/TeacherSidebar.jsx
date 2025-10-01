import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { IoIosLogOut } from "react-icons/io";
import { AiFillHome } from "react-icons/ai";
import { FaUserAlt } from "react-icons/fa";
import { MdDashboard, MdAssignment } from "react-icons/md";
import { FaChalkboardTeacher, FaBookOpen, FaRegCalendarAlt, FaBell } from "react-icons/fa";
import { TbReportAnalytics } from "react-icons/tb";
import { useUser } from "../../Provider/UseProvider";
import AxiosInstance from "../AxiosInstance";

export default function TeacherSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [institutionInfo, setInstitutionInfo] = useState(null);
  const { signOut } = useUser();

  const toggleSidebar = () => setCollapsed(!collapsed);
  const handleLogout = () => {
    signOut?.();
    window.location.href = "/login";
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await AxiosInstance.get("institutions/");
        if (Array.isArray(res.data) && res.data.length > 0) setInstitutionInfo(res.data[0]);
      } catch (e) { console.error("Institution load failed", e); }
    })();
  }, []);

  const navLinkStyle = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200
     ${isActive ? "bg-[#d8f999] text-black" : "hover:bg-[#e2b42b] text-white hover:text-white"}
     ${collapsed ? "justify-center text-base px-1" : ""}`;

  return (
    <aside className={`h-screen bg-[#2C8E3F] text-white flex flex-col ${collapsed ? "w-16" : "w-64"} transition-all duration-300`}>
      {/* Top */}
      <div className="relative">
        <div className="flex items-center px-4 py-4">
          <Link to="/teacher/dashboard">
            <img
              src={institutionInfo?.logo || "/default-logo.png"}
              alt="Logo"
              className={`object-cover rounded-full transition-all duration-300 ${collapsed ? "w-10 h-10" : "w-12 h-12"}`}
            />
          </Link>
          {!collapsed && (
            <div className="ml-3">
              <div className="font-semibold leading-tight">{institutionInfo?.name || "Institute"}</div>
              <div className="text-xs opacity-90">Teacher Panel</div>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white text-purple-600 rounded-full shadow-md border border-purple-200 hover:bg-purple-100 w-6 h-6 flex items-center justify-center"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? "➡️" : "⬅️"}
        </button>
      </div>

      {/* Middle */}
      <div className="flex-grow px-2 overflow-auto space-y-1">
        <NavLink to="/teacher/dashboard" className={navLinkStyle} title="Dashboard">
          <MdDashboard className="text-lg" />
          {!collapsed && "Dashboard"}
        </NavLink>

        <NavLink to="/teacher/profile" className={navLinkStyle} title="My Profile">
          <FaUserAlt className="text-lg" />
          {!collapsed && "My Profile"}
        </NavLink>

        {/* <NavLink to="/teacher/classes" className={navLinkStyle} title="My Classes">
          <FaChalkboardTeacher className="text-lg" />
          {!collapsed && "My Classes"}
        </NavLink> */}
        <NavLink to="/teacher/students" className={navLinkStyle} title="Students">
          {/* choose any icon you already use; keeping style consistent */}
          <FaChalkboardTeacher className="text-lg" />
          {!collapsed && "My Students"}
        </NavLink>
        <NavLink to="/teacher/routine" className={navLinkStyle} title="My Routine">
          <FaRegCalendarAlt className="text-lg" />
          {!collapsed && "My Routine"}
        </NavLink>


        <NavLink to="/teacher/attendance" className={navLinkStyle} title="Attendance">
          <FaRegCalendarAlt className="text-lg" />
          {!collapsed && "Attendance"}
        </NavLink>
        <NavLink to="/teacher/attendance-report" className={navLinkStyle} title="Attendance">
          <FaRegCalendarAlt className="text-lg" />
          {!collapsed && "Attendance Report"}
        </NavLink>
        <NavLink to="/teacher/exams" className={navLinkStyle} title="Exams/Marks">
          <FaBookOpen className="text-lg" />
          {!collapsed && "Exams/Marks"}
        </NavLink>

        <NavLink to="/teacher/assignments" className={navLinkStyle} title="Assignments">
          <MdAssignment className="text-lg" />
          {!collapsed && "Assignments"}
        </NavLink>

        <NavLink to="/teacher/reports" className={navLinkStyle} title="Reports">
          <TbReportAnalytics className="text-lg" />
          {!collapsed && "Reports"}
        </NavLink>

        <NavLink to="/teacher/notices" className={navLinkStyle} title="Notices">
          <FaBell className="text-lg" />
          {!collapsed && "Notices"}
        </NavLink>
      </div>

      {/* Bottom */}
      <div className="px-2 py-4 border-t border-purple-700">
        <NavLink to="/" className={navLinkStyle} title="Home">
          <AiFillHome className="text-lg" />
          {!collapsed && "হোম"}
        </NavLink>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-2 px-3 py-2 w-full rounded-md text-white hover:bg-[#e2b42b] hover:text-white transition-all duration-200 ${collapsed ? "justify-center" : ""}`}
          title="Logout"
        >
          <IoIosLogOut className="text-lg" />
          {!collapsed && <span>লগআউট</span>}
        </button>
      </div>
    </aside>
  );
}
