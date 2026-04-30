/**
 * @fileoverview Reusable Search Input Component
 * A strictly-typed, controlled input component for client-side filtering and searching.
 */

import React from 'react';

// 1. Strict Prop Definitions
interface SearchInputProps {
  /** The current value of the search input */
  search: string;
  /** Handler fired whenever the user types in the input field */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Optional custom placeholder text */
  placeholder?: string;
}

export default function SearchInput({ 
  search, 
  onChange, 
  placeholder = 'Search by Desk ID or Username' 
}: SearchInputProps): JSX.Element {
  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        name="search"
        value={search}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm text-gray-900 placeholder-gray-400"
      />
    </div>
  );
}