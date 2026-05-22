'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import useSocket from '../../hooks/useSocket'; 

interface Poker {
  _id: string;
  name: string;
  objective: string;
  rules: Map<string, string>;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status: 'active' | 'maintenance' | 'disable';
  gameType: 'NLH' | 'PLO4' | 'PLO5' | 'OmahaHILO' | 'SDH' | 'STUD' | 'RAZZ' | 'PINEAPPLE' | 'COURCHEVEL' | '5CD' | 'BADUGI' | 'MIXED';
}

const PokerAdmin: React.FC = () => {
  const [pokers, setPokers] = useState<Poker[]>([]);
  const [newPoker, setNewPoker] = useState<Omit<Poker, '_id'>>({
    name: '',
    objective: '',
    rules: new Map(),
    status: 'active',
    gameType: 'NLH',
  });
  const [editingPoker, setEditingPoker] = useState<Partial<Omit<Poker, '_id'>> | null>(null);
  const [editingPokerId, setEditingPokerId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const socket = useSocket('admin');

  useEffect(() => {
    fetchPokers();
  }, []);

  const fetchPokers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/poker');
      if (!response.ok) throw new Error('Failed to fetch poker games');
      
      const data = await response.json();
      
      const formattedData: Poker[] = data.map((game: any) => ({
        ...game,
        rules: game.rules ? new Map(Object.entries(game.rules)) : new Map(),
      }));

      setPokers(formattedData);
    } catch (error) {
      console.error('Error fetching poker games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewPoker({ ...newPoker, [name]: value });
  };

  const handleRuleChange = (key: string, value: string) => {
    const updatedRules = new Map(newPoker.rules);
    updatedRules.set(key, value);
    setNewPoker({ ...newPoker, rules: updatedRules });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newPoker.name || !newPoker.objective || newPoker.rules.size === 0) {
      alert("Please fill in all fields, including rules.");
      return;
    }

    try {
      const rulesObject = Object.fromEntries(newPoker.rules);

      const response = await fetch('/api/admin/poker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPoker,
          rules: rulesObject,
        }),
      });

      if (!response.ok) throw new Error('Failed to create poker game');

      await fetchPokers();
      
      setNewPoker({
        name: '',
        objective: '',
        rules: new Map(),
        status: 'active',
        gameType: 'NLH',
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating poker game:', error);
      alert('Error creating poker game. Check console for details.');
    }
  };

  const startEditing = (poker: Poker) => {
    setEditingPokerId(poker._id);
    setEditingPoker({
      ...poker,
      rules: new Map(poker.rules),
    });
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (editingPoker) {
      const { name, value } = e.target;
      setEditingPoker({ ...editingPoker, [name]: value });
    }
  };

  const handleEditRuleChange = (key: string, value: string) => {
    if (editingPoker && editingPoker.rules) {
      const updatedRules = new Map(editingPoker.rules);
      updatedRules.set(key, value);
      setEditingPoker({ ...editingPoker, rules: updatedRules });
    }
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (editingPoker && editingPokerId) {
      try {
        const rulesObject = editingPoker.rules ? Object.fromEntries(editingPoker.rules) : {};

        const response = await fetch(`/api/admin/poker/${editingPokerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...editingPoker,
            rules: rulesObject,
          }),
        });

        if (!response.ok) throw new Error('Failed to update poker game');

        await fetchPokers();
        
        setEditingPoker(null);
        setEditingPokerId(null);
      } catch (error) {
        console.error('Error updating poker game:', error);
        alert('Error updating poker game. Check console for details.');
      }
    }
  };

  const cancelEditing = () => {
    setEditingPoker(null);
    setEditingPokerId(null);
  };

  /**
   * API MIGRATION: Deletes a Poker game via DELETE /api/admin/poker/[id]
   * RESTORED: Added missing delete handler with safety confirmation.
   */
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this game? This action cannot be undone.")) return;

    try {
      const response = await fetch(`/api/admin/poker/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete poker game');

      // Update state directly to remove it from the UI immediately
      setPokers(pokers.filter((poker) => poker._id !== id));
    } catch (error) {
      console.error('Error deleting poker game:', error);
      alert('Error deleting game. Check console for details.');
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-7xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Poker Games Management</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          + Add New Game
        </button>
      </div>

      {loading && pokers.length === 0 ? (
        <div className="text-center py-10">Loading games...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pokers.map((poker) => (
            <div key={poker._id} className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{poker.name}</h3>
                <p className="text-sm text-gray-600 mt-2 line-clamp-3">{poker.objective}</p>
                <div className="mt-4 flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    poker.status === 'active' ? 'bg-green-100 text-green-800' :
                    poker.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {poker.status.toUpperCase()}
                  </span>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {poker.gameType}
                  </span>
                </div>
              </div>
              
              <div className="mt-6 flex space-x-2">
                <button
                  onClick={() => startEditing(poker)}
                  className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600"
                >
                  Edit
                </button>
                {/* RESTORED: Delete Button */}
                <button
                  onClick={() => handleDelete(poker._id)}
                  className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New Poker Game</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Game Name</label>
                <input
                  type="text"
                  name="name"
                  value={newPoker.name}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Objective</label>
                <textarea
                  name="objective"
                  value={newPoker.objective}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={newPoker.description || ''}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={newPoker.status}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="disable">Disable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Game Type</label>
                  <select
                    name="gameType"
                    value={newPoker.gameType}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="NLH">No Limit Hold&apos;em (NLH)</option>
                    <option value="PLO4">PLO4</option>
                    <option value="PLO5">PLO5</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Rules</h3>
                <div className="space-y-2 mb-2">
                  {Array.from(newPoker.rules.keys()).map((key) => (
                    <div key={key}>
                      <input
                        type="text"
                        value={newPoker.rules.get(key) || ''}
                        onChange={(e) => handleRuleChange(key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder={`Enter ${key}`}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleRuleChange(`Rule ${newPoker.rules.size + 1}`, '')}
                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                >
                  + Add Rule
                </button>
              </div>

              <div className="flex space-x-4 pt-4">
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  Save Game
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-gray-400 text-white py-2 rounded hover:bg-gray-500">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingPokerId && editingPoker && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Poker Game</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  name="name"
                  value={editingPoker.name || ''}
                  onChange={handleEditInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Objective</label>
                <textarea
                  name="objective"
                  value={editingPoker.objective || ''}
                  onChange={handleEditInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={editingPoker.status || 'active'}
                    onChange={handleEditInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="disable">Disable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Game Type</label>
                  <select
                    name="gameType"
                    value={editingPoker.gameType || 'NLH'}
                    onChange={handleEditInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="NLH">No Limit Hold&apos;em (NLH)</option>
                    <option value="PLO4">PLO4</option>
                    <option value="PLO5">PLO5</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Rules</h3>
                <div className="space-y-2 mb-2">
                  {editingPoker.rules && Array.from(editingPoker.rules.keys()).map((key) => (
                    <div key={key}>
                      <input
                        type="text"
                        value={editingPoker.rules?.get(key) || ''}
                        onChange={(e) => handleEditRuleChange(key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newKey = `Rule ${(editingPoker.rules?.size || 0) + 1}`;
                    handleEditRuleChange(newKey, '');
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                >
                  + Add Rule
                </button>
              </div>

              <div className="flex space-x-4 pt-4">
                <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                  Update Game
                </button>
                <button type="button" onClick={cancelEditing} className="w-full bg-gray-400 text-white py-2 rounded hover:bg-gray-500">
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

export default PokerAdmin;