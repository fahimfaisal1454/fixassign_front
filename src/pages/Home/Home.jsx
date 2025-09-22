import '../../App.css'

import HeroSection from '../../components/HeroSection.jsx';
import CollegeOverview from './CollegeOverview.jsx';
import { Link } from "react-router-dom";   // ✅ import Link

const Home = () => {
  return (
    <div>
      <HeroSection />
      <CollegeOverview />

      {/* ✅ Teacher Dashboard Button
      <div className="mt-6 flex justify-center">
        <Link
          to="/teacher/dashboard"
          className="px-6 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
        >
          Go to Teacher Dashboard
        </Link>
      </div> */}
    </div>
  );
};

export default Home;
