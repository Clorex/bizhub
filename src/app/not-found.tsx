import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-orange-100 flex items-center justify-center">
          <span className="text-3xl font-extrabold text-orange-600">404</span>
        </div>

        <h1 className="text-2xl font-extrabold text-gray-900">
          Page not found
        </h1>

        <p className="text-base text-gray-600 mt-3 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/market"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg hover:shadow-xl transition"
          >
            Go to Marketplace
          </Link>

          <Link
            href="/account"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
          >
            Go to Profile
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          myBizHub — If you think this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}
