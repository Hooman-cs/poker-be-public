'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchInput from '@/components/admin/SearchInput';

export default function UsersFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const mounted = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const sp = new URLSearchParams();
      if (search) sp.set('search', search);
      if (statusRef.current) sp.set('status', statusRef.current);
      sp.set('page', '1');
      router.push(`/admin/users?${sp.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, router]);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setStatus(val);
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    if (val) sp.set('status', val);
    sp.set('page', '1');
    router.push(`/admin/users?${sp.toString()}`);
  }

  return (
    <div className="flex gap-3 items-center px-4 py-3 border-b border-slate-200 bg-white">
      <SearchInput value={search} onChange={setSearch} placeholder="Search username or email…" />
      <select
        value={status}
        onChange={handleStatusChange}
        className="text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-9"
      >
        <option value="">All status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>
  );
}
