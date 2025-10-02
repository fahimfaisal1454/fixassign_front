import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { IoIosLogOut } from "react-icons/io";
import { AiFillHome } from "react-icons/ai";
import { FaUserAlt } from "react-icons/fa";
import { MdDashboard } from "react-icons/md";
import { FaBookOpen, FaRegCalendarAlt, FaBell } from "react-icons/fa";
import { useUser } from "../../Provider/UseProvider";
import AxiosInstance from "../AxiosInstance";

export default function StudentSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [institutionInfo, setInstitutionInfo] = useState(null);
  const { signOut } = useUser();

  useEffect(() => {
    (async () => {
      try {
        const res = await AxiosInstance.get("institutions/");
        setInstitutionInfo(Array.isArray(res.data) ? res.data[0] : res.data);
      } catch {}
    })();
  }, []);

  const toggleSidebar = () => setCollapsed(!collapsed);
  const navLinkStyle = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200
     ${isActive ? "bg-[#d8f999] text-black" : "hover:bg-[#e2b42b] text-white hover:text-white"}
     ${collapsed ? "justify-center text-base px-1" : ""}`;

  return (
    <aside className={`h-screen bg-[#2C8E3F] text-white flex flex-col ${collapsed ? "w-16" : "w-64"} transition-all duration-300`}>
      <div className="relative">
        <div className="flex items-center px-4 py-4">
          <Link to="/student/dashboard">
            <img
              src={institutionInfo?.logo || "/default-logo.png"}
              alt="Logo"
              className={`object-cover rounded-full transition-all duration-300 ${collapsed ? "w-10 h-10" : "w-12 h-12"}`}
            />
          </Link>
          {!collapsed && (
            <div className="ml-3">
              <div className="font-semibold leading-tight">{institutionInfo?.name || "Institute"}</div>
              <div className="text-xs opacity-90">Student Panel</div>
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

      <div className="flex-grow px-2 overflow-auto space-y-1">
        <NavLink to="/student/dashboard" className={navLinkStyle}><MdDashboard className="text-lg" />{!collapsed && "Dashboard"}</NavLink>
        <NavLink to="/student/profile" className={navLinkStyle}><FaUserAlt className="text-lg" />{!collapsed && "My Profile"}</NavLink>
        <NavLink to="/student/timetable" className={navLinkStyle}><FaRegCalendarAlt className="text-lg" />{!collapsed && "ClassRoutine"}</NavLink>
        <NavLink to="/student/results" className={navLinkStyle}><FaBookOpen className="text-lg" />{!collapsed && "My Results"}</NavLink>
        <NavLink to="/student/assignments" className={navLinkStyle}><FaBell className="text-lg" />{!collapsed && "Homework"}</NavLink>
        <NavLink to="/student/notices" className={navLinkStyle}><FaBell className="text-lg" />{!collapsed && "Notices"}</NavLink>
      </div>

      <div className="px-2 py-4 border-t border-purple-700">
        <NavLink to="/" className={navLinkStyle}><AiFillHome className="text-lg" />{!collapsed && "হোম"}</NavLink>
        <button onClick={() => { signOut?.(); window.location.href="/login"; }}
          className={`flex items-center gap-2 px-3 py-2 w-full rounded-md text-white hover:bg-[#e2b42b] hover:text-white transition-all duration-200 ${collapsed ? "justify-center" : ""}`}>
          <IoIosLogOut className="text-lg" />{!collapsed && <span>লগআউট</span>}
        </button>
      </div>
    </aside>
  );
}
