import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./App.css";

import Root from "./components/Root.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import Contact from "./pages/Contacts.jsx";
import Home from "./pages/Home/Home.jsx";
import Academic from "./pages/Academic.jsx";
import FacnStaff from "./pages/FacnStaff.jsx";
import Notice from "../src/pages/Notice/Notice.jsx";
import { UserProvider } from "./Provider/UseProvider.jsx";
import Authentication from "./pages/Authentication/Authentication.jsx";
import ProtectedRoute from "./Provider/ProtectedRoute.jsx";
import AdminList from "./pages/AdminList/AdminList.jsx";
import PrincipleList from "./pages/PrincipleList/PrincipleList.jsx";
import Faculty from "./pages/Faculty/Faculty.jsx";
import Gallery from "../src/pages/Gallery.jsx";
import Admission from "../src/pages/Admission.jsx";
import AboutCollege from "./pages/AboutCollege.jsx";
import Routine from "./pages/Academic/Routine.jsx";
import Acknowledgment from "./pages/Acknowledgment/Acknowledgment.jsx";
import Result from "./pages/Academic/Result.jsx";

import Dashboard from "../src/Layout/Dashboard.jsx";
import AddNotice from "./pages/DashboardPages/Notice/Notice.jsx";
import GalleryUpload from "./pages/DashboardPages/Master/GalleryUpload.jsx";
import AddClass from "./pages/DashboardPages/academics/AddClass.jsx";
import CollegeInfo from "../src/pages/DashboardPages/Master/CollegeInfo.jsx";
import PrincipalForms from "./pages/DashboardPages/Master/PrincipalForms.jsx";
import AddSubject from "./pages/DashboardPages/academics/AddSubject.jsx";
import StaffInfo from "./pages/DashboardPages/Default/StaffInfo.jsx";
import TeacherInfo from "./pages/DashboardPages/Default/TeacherInfo.jsx";
import StudentInfo from "./pages/DashboardPages/Default/StudentInfo.jsx";
import CommitteeMember from "./pages/DashboardPages/Master/CommitteeMember.jsx";
import ContactList from "./pages/DashboardPages/Master/ContactList.jsx";
import AdminAcknowledgment from "./pages/DashboardPages/Master/AdminAcknowledgment.jsx";
import ResultManager from "./pages/DashboardPages/academics/ResultManager.jsx";
import ManageUsers from "./pages/Admin/ManageUsers.jsx";
import LinkAccount from "./pages/Admin/LinkAccount.jsx"
import ManagePeriods from "./pages/DashboardPages/academics/ManagePeriods.jsx";
import AddSection from "./pages/DashboardPages/academics/AddSection.jsx";
import AssignedSubjects from "./pages/DashboardPages/Academics/AssignedSubjects.jsx";
import ClassTimetable from "./pages/DashboardPages/academics/ClassTimetable.jsx"
// import AssignTeacherForm from "./pages/DashboardPages/academics/AssignTeacherForm.jsx";
// import AssignTeacherList from "./pages/DashboardPages/academics/AssignTeacherList.jsx";
import ManageClassrooms from "./pages/DashboardPages/academics/ManageClassrooms.jsx";
import StudentAttendance from "./pages/DashboardPages/academics/StudentAttendance.jsx";
import StudentPromotion from "./pages/DashboardPages/academics/StudentPromotion.jsx";
import GradeScaleManager from "./pages/DashboardPages/academics/GradeScaleManager.jsx";
import ExamsAdmin from "./pages/DashboardPages/academics/ExamsAdmin.jsx";
// import AdminFinalizeButton from "./pages/AdminFinalizeButton.jsx";
import AdminMarksViewer from "./pages/DashboardPages/academics/AdminMarksViewer.jsx"; 
/* === Teacher Panel imports (new) === */
import TeacherPanel from "./Layout/TeacherPanel.jsx";
import TeacherDashboard from "./pages/Teachers/Dashboard.jsx";
import MyProfile from "./pages/Teachers/MyProfile.jsx";
import MyClasses from "./pages/Teachers/MyClasses.jsx";
import Attendance from "./pages/Teachers/Attendance.jsx";
import Exams from "./pages/Teachers/Exams.jsx";
import Assignments from "./pages/Teachers/Assignments.jsx";
import Reports from "./pages/Teachers/Reports.jsx";
import TeacherNotices from "./pages/Teachers/Notices.jsx";
import MyStudents from "./pages/Teachers/MyStudents.jsx";
import TeacherRoutine from "./pages/Teachers/TeacherRoutine.jsx";
import AttendanceReport from "./pages/Teachers/AttendanceReport";
import AttendanceSheet from "./pages/Teachers/AttendanceSheet.jsx";


/* === Student Panel imports (new) === */
import StudentPanel from "./Layout/StudentPanel.jsx";
import StudentDashboard from "./pages/Students/Dashboard.jsx";
import StudentProfile from "./pages/Students/MyProfile.jsx";
import StudentTimetable from "./pages/Students/MyTimetable.jsx";
import StudentResults from "./pages/Students/MyResults.jsx";
import StudentNotices from "./pages/Students/Notices.jsx";




// Define the router
const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "contact",
        element: <Contact />,
      },
      {
        path: "/login",
        element: <Authentication />,
      },
      {
        path: "/notice",
        element: <Notice />,
      },
      {
        path: "/academic",
        element: <Academic />,
      },
      {
        path: "/facnstaff",
        element: <Faculty />,
      },
      {
        path: "/gallery",
        element: <Gallery />,
      },
      {
        path: "/admission",
        element: <Admission />,
      },
      {
        path: "/about",
        element: <AboutCollege />,
      },
      {
        path: "/routine",
        element: <Routine />,
      },
      {
        path: "/result",
        element: <Result />,
      },
      {
        path: "/acknowledgment",
        element: <Acknowledgment />,
      },
    ],
  },

  // === Admin Dashboard (existing) ===
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
    children: [
      { path: "college-info", element: <CollegeInfo /> },
      { path: "notices", element: <AddNotice /> },
      { path: "contact-info", element: <ContactList /> },
      { path: "gallery-upload", element: <GalleryUpload /> },
      { path: "principal-info", element: <PrincipalForms /> },
      { path: "student-info-form", element: <StudentInfo /> },
      { path: "teacher-info-form", element: <TeacherInfo /> },
      { path: "staff-info-form", element: <StaffInfo /> },
      { path: "add-class", element: <AddClass /> },
      { path: "add-subject", element: <AddSubject /> },
      { path: "committee-member", element: <CommitteeMember /> },
      { path: "add-acknowledgement", element: <AdminAcknowledgment /> },
      { path: "add-result", element: <ResultManager /> },
      { path: "users", element: <ManageUsers /> },
      { path: "rooms", element: <ManageClassrooms /> },
    

      { path: "add-section", element: <AddSection /> },
      { path: "assigned-subjects", element: <AssignedSubjects /> },
      { path: "class-timetable", element: <ClassTimetable /> },
      // { path: "assigned-teacher-form", element: <AssignTeacherForm /> },
      // { path: "assigned-teacher-list", element: <AssignTeacherList /> },
      { path: "link-account", element: <LinkAccount /> },
      { path: "periods", element: <ManagePeriods /> }, 
      { path: "student-attendance", element: <StudentAttendance /> },
       { path: "student-promotion", element: <StudentPromotion /> },
       { path: "grade-scales", element: <GradeScaleManager /> },
       { path: "exams-admin", element: <ExamsAdmin /> },
      //  { path: "finalize-marks", element: <AdminFinalizeButton /> },
       { path: "view-marks", element: <AdminMarksViewer /> },
    ],
  },

  // === Teacher Panel (new) ===
  {
    path: "/teacher",
    element: (
      <ProtectedRoute>
        <TeacherPanel />
      </ProtectedRoute>
    ),
    children: [
      { path: "dashboard", element: <TeacherDashboard /> },
      { path: "classes", element: <MyClasses /> },
      { path: "attendance", element: <Attendance /> },
      { path: "exams", element: <Exams /> },
      { path: "assignments", element: <Assignments /> },
      { path: "reports", element: <Reports /> },
      { path: "notices", element: <TeacherNotices /> },
      { path: "students", element: <MyStudents /> },
      { path: "profile", element: <MyProfile /> },
      { path: "routine", element: <TeacherRoutine /> },
      { path: "attendance-report", element: <AttendanceReport /> },
      { path: "attendance-sheet", element: <AttendanceSheet /> },
     
      
    ],
  },

  // === Student Panel (new) ===
  {
  path: "/student",
  element: (
    <ProtectedRoute allowedRoles={["Student"]}>
      <StudentPanel />
    </ProtectedRoute>
  ),
  children: [
    { path: "dashboard", element: <StudentDashboard /> },
    { path: "profile", element: <StudentProfile /> },
    { path: "timetable", element: <StudentTimetable /> },
    { path: "results", element: <StudentResults /> },
    { path: "notices", element: <StudentNotices /> },
  ],
},
]);

// Render to root
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UserProvider>
      <RouterProvider router={router} />
    </UserProvider>
  </React.StrictMode>
);
