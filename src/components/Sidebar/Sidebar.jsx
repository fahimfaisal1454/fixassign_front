// client/src/components/Sidebar.jsx
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { IoIosLogOut } from "react-icons/io";
import { AiFillHome } from "react-icons/ai";
import { MdSettings, MdExpandMore, MdExpandLess, MdClass, MdLibraryBooks } from "react-icons/md";
import { PiBuildingsDuotone } from "react-icons/pi";
import { FiPhone } from "react-icons/fi";
import { FaImages, FaUserTie, FaUserGraduate } from "react-icons/fa6";
import { FaChalkboardTeacher } from "react-icons/fa";
import { RiTeamFill } from "react-icons/ri";
import { BsClipboardData } from "react-icons/bs";
import { FaRegCalendarAlt, FaUniversity } from "react-icons/fa";
import { useUser } from "../../Provider/UseProvider";
import AxiosInstance from "../AxiosInstance";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openId, setOpenId] = useState(null); // "site" | "default" | "academic" | null
  const [institutionInfo, setInstitutionInfo] = useState(null);

  const { signOut } = useUser();
  const toggleSidebar = () => setCollapsed((s) => !s);
  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  const handleLogout = () => {
    signOut();
    window.location.href = "/login";
  };

  useEffect(() => {
    const fetchInstitutionInfo = async () => {
      try {
        const res = await AxiosInstance.get("institutions/");
        if (Array.isArray(res.data) && res.data.length > 0) setInstitutionInfo(res.data[0]);
      } catch (error) {
        console.error("Error fetching institution info:", error);
      }
    };
    fetchInstitutionInfo();
  }, []);

  // Default: white text; Active: black text; Hover: yellow bg, text stays white
  const navLinkStyle = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200
     ${isActive ? "bg-[#d8f999] text-black" : "hover:bg-[#e2b42b] text-white hover:text-white"}
     ${collapsed ? "justify-center text-base px-1" : ""}`;

  return (
    <aside
      className={`h-screen bg-[#2C8E3F] text-white flex flex-col ${collapsed ? "w-16" : "w-64"
        } transition-all duration-300`}
    >
      {/* Top */}
      <div className="relative">
        <div className="flex items-center px-4 py-4">
          <Link to="/">
            <img
              src={institutionInfo?.logo || "/default-logo.png"}
              className={`object-cover rounded-full transition-all duration-300 ${collapsed ? "w-10 h-10" : "w-12 h-12"
                }`}
              alt="Logo"
            />
          </Link>
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
        {/* Site Configuration */}
        <div>
          <button
            onClick={() => toggle("site")}
            className="flex gap-3 w-full px-3 py-2 text-white rounded-md hover:bg-[#e2b42b] hover:text-white"
            title="Site configuration"
          >
            <MdSettings className="text-xl" />
            {!collapsed && <span>Site Configuration</span>}
            {!collapsed && (
              <span className="ml-auto">{openId === "site" ? <MdExpandLess /> : <MdExpandMore />}</span>
            )}
          </button>

          <div
            className={`transition-all duration-300 overflow-hidden ${openId === "site" ? "max-h-[600px]" : "max-h-0"
              } ${collapsed ? "pl-0" : "pl-4"}`}
          >
            <NavLink to="/dashboard/college-info" className={navLinkStyle}>
              <PiBuildingsDuotone className="text-lg" />
              {!collapsed && "Institution Info"}
            </NavLink>
            <NavLink to="/dashboard/contact-info" className={navLinkStyle}>
              <FiPhone className="text-lg" />
              {!collapsed && "Contacts"}
            </NavLink>
            <NavLink to="/dashboard/principal-info" className={navLinkStyle}>
              <FaUserTie className="text-lg" />
              {!collapsed && "Principal / Vice Principal"}
            </NavLink>
            <NavLink to="/dashboard/committee-member" className={navLinkStyle}>
              <FaUserTie className="text-lg" />
              {!collapsed && "Committee Members"}
            </NavLink>
            <NavLink to="/dashboard/gallery-upload" className={navLinkStyle}>
              <FaImages className="text-lg" />
              {!collapsed && "Gallery"}
            </NavLink>
            <NavLink to="/dashboard/add-acknowledgement" className={navLinkStyle}>
              <FaImages className="text-lg" />
              {!collapsed && "Acknowledgement"}
            </NavLink>
            {/* NOTE: "Add Class" and "Add Subject" moved to Academic */}
          </div>
        </div>

        {/* Notice */}
        <NavLink to="/dashboard/notices" className={navLinkStyle}>
          <BsClipboardData className="text-lg" />
          {!collapsed && "Notices"}
        </NavLink>

        {/* Default (People) */}
        <div>
          <button
            onClick={() => toggle("default")}
            className="flex gap-3 w-full px-3 py-2 text-white rounded-md hover:bg-[#e2b42b] hover:text-white"
            title="Default"
          >
            <MdSettings className="text-xl" />
            {!collapsed && <span>Default</span>}
            {!collapsed && (
              <span className="ml-auto">
                {openId === "default" ? <MdExpandLess /> : <MdExpandMore />}
              </span>
            )}
          </button>

          <div
            className={`transition-all duration-300 overflow-hidden ${openId === "default" ? "max-h-[600px]" : "max-h-0"
              } ${collapsed ? "pl-0" : "pl-4"}`}
          >
            <NavLink to="/dashboard/student-info-form" className={navLinkStyle}>
              <FaUserGraduate className="text-lg" />
              {!collapsed && "Student Info"}
            </NavLink>
            <NavLink to="/dashboard/teacher-info-form" className={navLinkStyle}>
              <FaChalkboardTeacher className="text-lg" />
              {!collapsed && "Teacher Info"}
            </NavLink>
            <NavLink to="/dashboard/staff-info-form" className={navLinkStyle}>
              <RiTeamFill className="text-lg" />
              {!collapsed && "Staff Info"}
            </NavLink>
            <NavLink to="/dashboard/users" className={navLinkStyle}>
              <RiTeamFill className="text-lg" />
              {!collapsed && "Users"}
            </NavLink>
            <NavLink to="/dashboard/link-account" className={navLinkStyle}>
              <RiTeamFill className="text-lg" />
              {!collapsed && "Link Account"}
            </NavLink>
          </div>
        </div>

        {/* Academic */}
        <div>
          <button
            onClick={() => toggle("academic")}
            className="flex gap-3 w-full px-3 py-2 text-white rounded-md hover:bg-[#e2b42b] hover:text-white"
            title="Academic"
          >
            <FaUniversity className="text-xl" />
            {!collapsed && <span>Academic</span>}
            {!collapsed && (
              <span className="ml-auto">
                {openId === "academic" ? <MdExpandLess /> : <MdExpandMore />}
              </span>
            )}
          </button>

          <div
            className={`transition-all duration-300 overflow-hidden ${openId === "academic" ? "max-h-[600px]" : "max-h-0"
              } ${collapsed ? "pl-0" : "pl-4"}`}
          >
            {/* ✅ Moved here */}
            <NavLink to="/dashboard/class-timetable" className={navLinkStyle}>
              <MdLibraryBooks className="text-lg" />
              {!collapsed && "Class Timetable"}
            </NavLink>
            <NavLink to="/dashboard/periods" className={navLinkStyle}>
              <MdLibraryBooks className="text-lg" />
              {!collapsed && "Manage Periods"}
            </NavLink>
            <NavLink to="/dashboard/rooms" className={navLinkStyle}>
              <MdLibraryBooks className="text-lg" />
              {!collapsed && "Manage Classrooms"}
            </NavLink>
            <NavLink to="/dashboard/add-section" className={navLinkStyle}>
              <MdClass className="text-lg" />
              {!collapsed && "Add Section"}
            </NavLink>
            <NavLink to="/dashboard/add-class" className={navLinkStyle}>
              <MdClass className="text-lg" />
              {!collapsed && "Add Class"}
            </NavLink>
            <NavLink to="/dashboard/add-subject" className={navLinkStyle}>
              <MdLibraryBooks className="text-lg" />
              {!collapsed && "Add Subject"}
            </NavLink>
            <NavLink to="/dashboard/assigned-subjects" className={navLinkStyle}>
              <MdLibraryBooks className="text-lg" />
              {!collapsed && "Assign Subject"}
            </NavLink>
              
              <NavLink to="/dashboard/student-attendance" className={navLinkStyle}>
              <MdLibraryBooks className="text-lg" />
              {!collapsed && "Students Attendance"}
            </NavLink>
              
            {/* Existing academic items */}
            <NavLink to="/dashboard/assigned-teacher-list" className={navLinkStyle}>
              <FaRegCalendarAlt className="text-lg" />
              {!collapsed && "Class Routine"}
            </NavLink>
            <NavLink to="/dashboard/add-result" className={navLinkStyle}>
              <FaRegCalendarAlt className="text-lg" />
              {!collapsed && "Add Result"}
            </NavLink>
            <NavLink to="/dashboard/student-promotion" className={navLinkStyle}>
              <FaRegCalendarAlt className="text-lg" />
              {!collapsed && "Student Promotion"}
            </NavLink>
              <NavLink to="/dashboard/grade-scales" className={navLinkStyle}>
            <MdLibraryBooks className="text-lg" />
             {!collapsed && "Grade Scales"}
           </NavLink>

            <NavLink to="/dashboard/exams-admin" className={navLinkStyle}>
            <MdLibraryBooks className="text-lg" />
             {!collapsed && "Exams (Admin)"}
           </NavLink>    


          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="px-2 py-4 border-t border-purple-700">
        <NavLink to="/" className={navLinkStyle}>
          <AiFillHome className="text-lg" />
          {!collapsed && "Home"}
        </NavLink>

        <button
          className={`flex items-center gap-2 px-3 py-2 w-full rounded-md text-white hover:bg-[#e2b42b] hover:text-white transition-all duration-200 ${collapsed ? "justify-center" : ""
            }`}
          title="Logout"
          onClick={handleLogout}
        >
          <IoIosLogOut className="text-lg" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
