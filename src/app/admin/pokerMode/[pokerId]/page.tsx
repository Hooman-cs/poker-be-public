'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
interface PokerMode {
  _id: string;
  pokerId: string;
  stake?: number;
  minBuyIn: number;
  maxBuyIn: number;
  minPlayerCount: number;
  bType: 'blinds' | 'antes' | 'both';
  status: 'active' | 'disable';
  description?: string;
  mode : 'cash' | 'practice';
  createdAt: Date;
  updatedAt: Date;
}

const PokerModeAdmin: React.FC = () => {
  const params : any = useParams();
  const [pokerUID, setPokerUID] = useState("");
  const pokerId = params?.pokerId as string | undefined;
  const [pokerModes, setPokerModes] = useState<PokerMode[]>([]);
  const [newPokerMode, setNewPokerMode] = useState<Omit<PokerMode, '_id' | 'createdAt' | 'updatedAt'>>({
    pokerId: pokerId!,
    stake: 0,
    minBuyIn: 0,
    maxBuyIn: 0,
    minPlayerCount: 0,
    bType: 'blinds',
    status: 'active',
    mode:'cash',
    description: ''
  });
  const [editingPokerMode, setEditingPokerMode] = useState<Partial<PokerMode>>({});
  const [editingPokerModeId, setEditingPokerModeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (pokerId) {
      const fetchPokerModes = async () => {
        try {
          const response = await axios.get(`/api/admin/pokerModes`, { params: { pokerId } });
          setPokerModes(response.data);
        } catch (error) {
          console.error('Failed to fetch poker modes:', error);
        }
      };

      fetchPokerModes();
    }
  }, [pokerId]);

  

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewPokerMode({ ...newPokerMode, [e.target.name]: e.target.value });
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewPokerMode({ ...newPokerMode, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPokerMode.pokerId) {
      console.error('Poker ID is required');
      return;
    }

    try {
      const response = await fetch('/api/admin/pokerModes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPokerMode),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setPokerModes([...pokerModes, { ...newPokerMode, _id: data._id } as PokerMode]);
      setNewPokerMode({
        pokerId: pokerId || '',
        stake: 0,
        minBuyIn: 0,
        maxBuyIn: 0,
        minPlayerCount: 0,
        bType: 'blinds',
        status: 'active',
        mode : 'cash',
        description: ''
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create poker mode:', error);
    }
  };

  const startEditing = (pokerMode: PokerMode) => {
    setEditingPokerMode(pokerMode);
    setEditingPokerModeId(pokerMode._id);
    setIsModalOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditingPokerMode({ ...editingPokerMode, [e.target.name]: e.target.value });
  };

  const handleEditTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingPokerMode({ ...editingPokerMode, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPokerModeId) return;

    try {
      const response = await fetch(`/api/admin/pokerModes/${editingPokerModeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPokerMode),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      setPokerModes(pokerModes.map((p) => (p._id === editingPokerModeId ? { ...editingPokerMode, _id: editingPokerModeId } as PokerMode : p)));
      setEditingPokerMode({});
      setEditingPokerModeId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to update poker mode:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/pokerModes/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Network response was not ok');
      setPokerModes(pokerModes.filter((pokerMode) => pokerMode._id !== id));
    } catch (error) {
      console.error('Failed to delete poker mode:', error);
    }
  };

  const cancelEditing = () => {
    setEditingPokerMode({});
    setEditingPokerModeId(null);
    setIsModalOpen(false);
  };

  return (
    <div className="container mx-auto px-4 pb-8">
    
    <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-green-500 via-teal-400 to-cyan-500 px-4 py-2 rounded-lg">
  <h1 className="text-2xl font-bold text-white flex-grow">
    Poker Mode
  </h1>

  {/* Button to open the modal */}
  <button
    onClick={() => setIsModalOpen(true)}
    className="px-6 py-3 bg-orange-400 text-black font-bold rounded-lg hover:bg-orange-500 transition-all duration-300"
  >
    Create Poker Mode
  </button>
</div>



      {/* <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Poker ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stake</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Buy-In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Buy-In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Player Count</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blinds/Antes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pokerModes.map((pokerMode) => (
              <tr key={pokerMode._id}>
                <td className="px-6 py-4 whitespace-nowrap">{pokerMode.pokerId}</td>
                <td className="px-6 py-4 whitespace-nowrap">{pokerMode.stake}</td>
                <td className="px-6 py-4 whitespace-nowrap">{pokerMode.minBuyIn}</td>
                <td className="px-6 py-4 whitespace-nowrap">{pokerMode.maxBuyIn}</td>
                <td className="px-6 py-4 whitespace-nowrap">{pokerMode.maxPlayerCount}</td>
                <td className="px-6 py-4 whitespace-nowrap">{pokerMode.blindsOrAntes}</td>
                <td className="px-6 py-4 whitespace-nowrap">{pokerMode.status}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => startEditing(pokerMode)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(pokerMode._id)}
                    className="ml-2 px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>

                  <Link href={`/admin/pokerDesk/${pokerMode._id}`}>
                     details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> */}

      <section> 
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {pokerModes.map((pokerMode) => (
      <div key={pokerMode._id} className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-800">Poker ID: {pokerMode.pokerId}</h3>
          <p className="text-gray-600 mt-2">Stake: {pokerMode.stake}</p>
          <p className="text-gray-600">Min Buy-In: {pokerMode.minBuyIn}</p>
          <p className="text-gray-600">Max Buy-In: {pokerMode.maxBuyIn}</p>
          <p className="text-gray-600">Max Player Count: {pokerMode.minPlayerCount}</p>
          <p className="text-gray-600">mode : {pokerMode.mode}</p>
          <p className="text-gray-600">Blinds/Antes: {pokerMode.bType}</p>
          <p className={`text-sm mt-3 ${pokerMode.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
            Status: {pokerMode.status}
          </p>
        </div>
        <div className="flex justify-between p-4 bg-gray-100">
          <button
            onClick={() => startEditing(pokerMode)}
            className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(pokerMode._id)}
            className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
          >
            Delete
          </button>
          <Link href={`/admin/pokerDesk/${pokerMode._id}`}>
            <span className="text-indigo-600 hover:text-indigo-800 font-medium">Details</span>
          </Link>
        </div>
      </div>
    ))}
  </div>
</section>


      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-gray-900 bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">{editingPokerModeId ? 'Edit Poker Mode' : 'Create Poker Mode'}</h2>
            <form onSubmit={editingPokerModeId ? handleUpdate : handleSubmit}>
              <div className="mb-4">
                <label htmlFor="pokerId" className="block text-sm font-medium text-gray-700">Poker ID</label>
                <p>
                  {pokerId}
                </p>
              </div>
              <div className="mb-4">
                <label htmlFor="stake" className="block text-sm font-medium text-gray-700">Stake</label>
                <input
                  id="stake"
                  name="stake"
                  type="number"
                  value={editingPokerModeId ? editingPokerMode.stake : newPokerMode.stake}
                  onChange={editingPokerModeId ? handleEditChange : handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="minBuyIn" className="block text-sm font-medium text-gray-700">Min Buy-In</label>
                <input
                  id="minBuyIn"
                  name="minBuyIn"
                  type="number"
                  value={editingPokerModeId ? editingPokerMode.minBuyIn : newPokerMode.minBuyIn}
                  onChange={editingPokerModeId ? handleEditChange : handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="maxBuyIn" className="block text-sm font-medium text-gray-700">Max Buy-In</label>
                <input
                  id="maxBuyIn"
                  name="maxBuyIn"
                  type="number"
                  value={editingPokerModeId ? editingPokerMode.maxBuyIn : newPokerMode.maxBuyIn}
                  onChange={editingPokerModeId ? handleEditChange : handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="maxPlayerCount" className="block text-sm font-medium text-gray-700">Max Player Count</label>
                <input
                  id="maxPlayerCount"
                  name="maxPlayerCount"
                  type="number"
                  value={editingPokerModeId ? editingPokerMode.minPlayerCount : newPokerMode.minPlayerCount}
                  onChange={editingPokerModeId ? handleEditChange : handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="mode" className="block text-sm font-medium text-gray-700">mode</label>
                <select
  id="mode"
  name="mode" // Correct this if not set
  value={editingPokerModeId ? editingPokerMode.mode : newPokerMode.mode}
  onChange={editingPokerModeId ? handleEditChange : handleChange}
  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
  required
>
  <option value="cash">Cash</option>
  <option value="practice">Practice</option>
        </select>

              </div>
              <div className="mb-4">
                <label htmlFor="blindsOrAntes" className="block text-sm font-medium text-gray-700">Blinds or Antes</label>
                <select
                  id="blindsOrAntes"
                  name="blindsOrAntes"
                  value={editingPokerModeId ? editingPokerMode.bType : newPokerMode.bType}
                  onChange={editingPokerModeId ? handleEditChange : handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                >
                  <option value="blinds">Blinds</option>
                  <option value="antes">Antes</option>
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  id="status"
                  name="status"
                  value={editingPokerModeId ? editingPokerMode.status : newPokerMode.status}
                  onChange={editingPokerModeId ? handleEditChange : handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                >
                  <option value="active">Active</option>
                  <option value="disable">Disable</option>
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={editingPokerModeId ? editingPokerMode.description : newPokerMode.description}
                  onChange={editingPokerModeId ? handleEditTextAreaChange : handleTextAreaChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingPokerModeId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="ml-4 px-4 py-2 bg-gray-300 text-black rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokerModeAdmin;
