import { Inter } from 'next/font/google';
import '@/app/globals.css'; // Admin-specific global styles (if needed)
import Sidebar from '../../components/admin/Sidebar';
import Header from '../../components/admin/Header'; // Fixed: PascalCase

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Admin Panel',
  description: 'Enterprise Poker Management Dashboard',
};

/**
 * Admin Layout Wrapper
 * Note: Removed <html> and <body> tags as they are already handled by the Root Layout.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flex h-screen bg-gray-100 ${inter.className}`}>
      {/* Sidebar */}
      <div className="bg-gray-800 text-white flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <Header />

        {/* Content Area */}
        <main className="flex-1 px-6 bg-white pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}