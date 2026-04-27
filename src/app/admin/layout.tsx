import Link from 'next/link';
import { Inter } from 'next/font/google';
import '../globals.css';
import Sidebar from '../../components/admin/Sidebar';
import Header from '../../components/admin/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Admin Panel',
  description: 'Admin Panel Dashboard',
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
    <body className={inter.className}>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <div className=" bg-gray-800 text-white flex-shrink-0">
          <Sidebar />
        </div>
  
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <Header />
  
          {/* Content Area */}
          <main className="flex-1 px-6 bg-white" style={{height:"100%"}}>
            {children}
          </main>
        </div>
      </div>
    </body>
  </html>
  

  );
};

export default AdminLayout;
