export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="text-gray-500 mt-2">The page you’re looking for doesn’t exist.</p>
      </div>
    </div>
  );
}
