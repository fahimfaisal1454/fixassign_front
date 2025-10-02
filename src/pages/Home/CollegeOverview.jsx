import React, { useEffect, useState } from "react";
import AxiosInstance from "../../components/AxiosInstance";
import defaultImage from "../../images/person.PNG";
import clgLogo from "../../images/default_logo.PNG";
import { ExternalLink, Link2, ShieldCheck } from "lucide-react";

export default function CollegeOverview() {
  const establishedYear = 2002;
  const currentYear = new Date().getFullYear();
  const totalYears = currentYear - establishedYear;

  const [instituteInfo, setInstituteInfo] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [members, setMembers] = useState([]);
  const [principal, setPrincipal] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [instRes, teacherRes, memberRes, principalRes] = await Promise.all([
          AxiosInstance.get("institutions/"),
          AxiosInstance.get("teachers/"),
          AxiosInstance.get("committee-members/"),
          AxiosInstance.get("principal-vice-principal/"),
        ]);

        const instArr = Array.isArray(instRes.data) ? instRes.data : [];
        setInstituteInfo(instArr[0] || null);

        setTeachers(Array.isArray(teacherRes.data) ? teacherRes.data : []);
        setMembers(Array.isArray(memberRes.data) ? memberRes.data : []);

        const principals = Array.isArray(principalRes.data) ? principalRes.data : [];
        const p = principals.find(
          (person) => String(person?.designation || "").toLowerCase() === "principal"
        );
        setPrincipal(p || null);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, []);

  const teacherCount = Array.isArray(teachers) ? teachers.length : 0;

  const usefulLinks = [
    {
      name: "Directorate of Secondary & Higher Education",
      url: "https://www.dshe.gov.bd/",
      tag: "Official",
    },
    {
      name: "Board of Intermediate & Secondary Education, Jashore",
      url: "https://www.jessoreboard.gov.bd/",
      tag: "Board",
    },
    { name: "Ministry of Education", url: "https://moedu.gov.bd/", tag: "Gov" },
    { name: "Jessore District Education Office", url: "https://jessore.gov.bd/" },
    { name: "Education Management Information System (EMIS)", url: "https://emis.gov.bd/" },
    { name: "BANBEIS (Education Info & Statistics)", url: "https://banbeis.gov.bd/" },
  ];

  return (
    <div className="bg-[#f1f5f9] py-12 px-4 md:px-10">
      {/* Top Summary Row-by-Row */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-8">
        {/* About College Card */}
        <div className="bg-white/60 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-6 flex flex-col justify-between">
          <div className="text-center mb-4">
            <img
              src={instituteInfo?.logo || clgLogo}
              alt="Institution Logo"
              className="h-20 w-20 object-cover rounded-full border-4 border-white shadow mx-auto"
              onError={(e) => {
                e.currentTarget.src = clgLogo;
              }}
            />
            <h2 className="mt-4 text-xl font-bold text-[#0A3B68]">
              {instituteInfo?.name || "Institution Name"}
            </h2>
            <p className="text-xs text-gray-500">
              Established: {instituteInfo?.government_approval_date || "####"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#0A3B68] mb-1">Institution History</h3>
            <p className="text-sm text-gray-700 leading-relaxed text-justify">
              {instituteInfo?.history ||
                "In line with the needs of the times, we nurture students with ethics, creativity, and leadership..."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mt-6">
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <h4 className="text-[#0A3B68] font-bold">{totalYears}+</h4>
              <p className="text-xs text-gray-600">Years of Pride</p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <h4 className="text-[#0A3B68] font-bold">{teacherCount}+</h4>
              <p className="text-xs text-gray-600">Teachers</p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <h4 className="text-[#0A3B68] font-bold">100%</h4>
              <p className="text-xs text-gray-600">Commitment to Values</p>
            </div>
          </div>
        </div>

        {/* Administration Card */}
        <div className="bg-white/60 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-6 overflow-y-auto">
          <h2 className="text-xl font-bold text-[#0A3B68] mb-4 text-center border-b pb-2">
            College Administration
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {members.map((member, index) => (
              <div
                key={index}
                className="bg-white p-3 rounded-xl text-center shadow hover:shadow-md transition"
              >
                {/* Passport-size photo: 2x3 ratio */}
                <img
                  src={member?.photo || defaultImage}
                  alt={member?.full_name || "Member"}
                  className="w-24 h-32 mx-auto object-cover object-top rounded-md border-2 border-[#0A3B68] bg-white shadow-sm"
                  onError={(e) => {
                    e.currentTarget.src = defaultImage;
                  }}
                />
                <h3 className="text-sm font-semibold text-[#0A3B68] mt-2 leading-tight">
                  {member?.full_name || "—"}
                </h3>
                <p className="text-xs text-gray-500">{member?.role || ""}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Principal Message Card */}
        <div className="bg-white/60 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-6 flex flex-col justify-between">
          <h2 className="text-xl font-bold text-[#0A3B68] text-center mb-4 border-b pb-2">
            Principal’s Message
          </h2>

          <div className="flex justify-center mb-4">
            {/* Passport-size photo: 2x3 ratio */}
            <img
              src={principal?.photo || defaultImage}
              alt="Principal"
              className="w-24 h-32 object-cover object-top rounded-md border bg-white shadow"
              onError={(e) => {
                e.currentTarget.src = defaultImage;
              }}
            />
          </div>

          <blockquote className="text-sm italic text-gray-700 border-l-4 pl-4 border-blue-400">
            “{principal?.message || "Loading principal’s message..."}”
          </blockquote>

          <p className="font-semibold text-[#0A3B68] text-right mt-4 text-sm">
            - {principal?.full_name || "Principal’s name"}
          </p>
        </div>
      </div>

      {/* Useful Links */}
      <div className="max-w-7xl mx-auto mt-12 px-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0A3B68]">
            Useful Websites
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {usefulLinks.map((item, idx) => {
            let hostname = "";
            let favicon = "";
            try {
              const u = new URL(item.url);
              hostname = u.hostname.replace(/^www\./, "");
              favicon = new URL("/favicon.ico", u.origin).href;
            } catch {
              hostname = "";
              favicon = "";
            }

            return (
              <a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block rounded-2xl bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-[2px] transition-all duration-300"
              >
                <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0A3B68]/10 via-transparent to-yellow-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {favicon ? (
                        <img
                          src={favicon}
                          alt=""
                          className="h-8 w-8 rounded-md border border-gray-200 object-contain bg-white"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-md border border-gray-200 grid place-items-center bg-gray-50">
                          <Link2 className="h-4 w-4 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-[#0A3B68] leading-tight">
                          {item.name}
                        </h3>
                        {hostname && (
                          <p className="text-[12px] md:text-sm text-gray-500">{hostname}</p>
                        )}
                      </div>
                    </div>
                    {item.tag && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400 bg-yellow-50 px-2 py-1 text-[11px] font-medium text-yellow-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#0A3B68]/80 group-hover:text-[#0A3B68] transition-colors">
                      Open
                    </span>
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-[#0A3B68] transition-colors" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
