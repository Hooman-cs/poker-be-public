import { BellIcon } from '@heroicons/react/outline';

const Header = () => {
  return (
    <header className="bg-white shadow-md p-4 flex justify-between items-center">
      <div className="text-xl font-semibold">Admin Dashboard</div>
      <div className="flex items-center space-x-4">
        <button className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-all">
          <BellIcon className="h-6 w-6 text-gray-600" />
        </button>
      </div>
    </header>
  );
};

export default Header;
