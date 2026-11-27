import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SeoHead } from "@/components/SeoHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <SeoHead
        title="404 Page Not Found — TAMS Pro"
        description="The page you requested could not be found on TAMS Pro. Return to the TAMS Pro homepage to explore travel agency management software in Pakistan."
        path="/404"
        noindex
      />
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <Link to="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
