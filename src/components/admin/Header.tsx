/**
 * @fileoverview Admin Dashboard Header Component
 * Displays the global admin branding and utility actions (e.g., notifications).
 */

import React from 'react';
import { BellIcon } from '@heroicons/react/24/outline';

export default function Header(): JSX.Element {
  return (
    <header className="bg-white shadow-md p-4 flex justify-between items-center">
      <div className="text-xl font-semibold text-gray-800">
        Admin Dashboard
      </div>
      
      <div className="flex items-center space-x-4">
        <button 
          type="button"
          aria-label="View notifications"
          className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <BellIcon className="h-6 w-6 text-gray-600" />
        </button>
      </div>
    </header>
  );
}