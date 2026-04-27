'use client';
import Link from 'next/link';
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
    gameType: 'NLH', // default to 'NLH'
  });
  const [editingPoker, setEditingPoker] = useState<Partial<Omit<Poker, '_id'>> | null>(null);
  const [editingPokerId, setEditingPokerId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState<boolean>(false);

  const socket = useSocket("tattvamasi");

  useEffect(() => {
    // Fetch existing poker games from your backend
    fetch('/api/admin/poker')
      .then((response) => response.json())
      .then((data: Poker[]) => setPokers(data));
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewPoker({ ...newPoker, [e.target.name]: e.target.value });
  };

  const handleRuleChange = (key: string, value: string) => {
    const updatedRules = new Map(newPoker.rules);
    updatedRules.set(key, value);
    setNewPoker({ ...newPoker, rules: updatedRules });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    // Simple validation
    if (!newPoker.name || !newPoker.objective || newPoker.rules.size === 0) {
      alert("Please fill in all fields, including rules.");
      return;
    }
  
    // Convert Map to plain object before sending
    const rulesObject = Object.fromEntries(newPoker.rules);
  
    fetch('/api/admin/createPoker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newPoker,
        rules: rulesObject,  // Convert the Map to an object
      }),
    }).then(() => {
      setPokers([...pokers, { ...newPoker, _id: '' } as Poker]); // Placeholder _id
      setNewPoker({
        name: '',
        objective: '',
        rules: new Map(), // Reset rules to an empty Map
        status: 'active',
        gameType: 'NLH',
      });
      setIsModalOpen(false); // Close the modal after submission
    });
  };
  

  // const startEditing = (poker: Poker) => {
  //   setEditingPoker({
  //     name: poker.name,
  //     objective: poker.objective,
  //     rules: new Map(poker.rules),
  //     status: poker.status,
  //     gameType: poker.gameType,
  //   });
  //   setEditingPokerId(poker._id);
  //   setIsEditingModalOpen(true);
  // };

  const startEditing = (poker: Poker) => {
    // Ensure that rules is a Map<string, string> by converting it if necessary
    const rules = poker.rules instanceof Map
      ? new Map<string, string>(Array.from(poker.rules as Map<string, string>)) // Ensure it's a Map<string, string>
      : new Map<string, string>(Object.entries(poker.rules || {}).map(([key, value]) => [key, String(value)])); // Convert to Map<string, string>
  
    setEditingPoker({
      name: poker.name,
      objective: poker.objective,
      rules: rules,
      status: poker.status,
      gameType: poker.gameType,
    });
    setEditingPokerId(poker._id);
    setIsEditingModalOpen(true);
  };
  

  const handleEditChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (editingPoker) {
      setEditingPoker({ ...editingPoker, [e.target.name]: e.target.value });
    }
  };

  const handleEditRuleChange = (key: string, value: string) => {
    if (editingPoker?.rules) {
      const updatedRules = new Map(editingPoker.rules);
      updatedRules.set(key, value);
      setEditingPoker({ ...editingPoker, rules: updatedRules });
    }
  };

  const handleUpdate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingPokerId && editingPoker) {
      fetch(`/api/admin/editPoker/${editingPokerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPoker),
      }).then(() => {
        setPokers(pokers.map((p) => (p._id === editingPokerId ? { ...editingPoker, _id: editingPokerId } as Poker : p)));
        setEditingPoker(null);
        setEditingPokerId(null);
        setIsEditingModalOpen(false);
      });
    }
  };

  const handleDelete = (id: string) => {
    fetch(`/api/admin/deletePoker/${id}`, { method: 'DELETE' }).then(() => {
      setPokers(pokers.filter((poker) => poker._id !== id));
    });
  };

  const cancelEditing = () => {
    setEditingPoker(null);
    setEditingPokerId(null);
    setIsEditingModalOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Poker Admin Panel</h1>

      {/* Button to open the modal */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Create Poker Game
      </button>

      {/* Modal for creating poker game */}
      

{/* Modal for creating poker game */}
{isModalOpen && (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
      <h2 className="text-xl font-semibold mb-4">Create Poker Game</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Name:</label>
          <input
            type="text"
            name="name"
            value={newPoker.name}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Objective:</label>
          <input
            type="text"
            name="objective"
            value={newPoker.objective}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Rule inputs */}
        <div>
          <label className="block text-sm font-medium">Rules:</label>
          <div className="space-y-2">
            {Array.from(newPoker.rules.keys()).map((key, index) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Rule"
                  value={key}
                  onChange={(e) => handleRuleChange(key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                />
                <input
                  type="text"
                  placeholder="Rule description"
                  value={newPoker.rules.get(key)}
                  onChange={(e) =>
                    handleRuleChange(key, e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const newKey = `Rule ${newPoker.rules.size + 1}`;
              handleRuleChange(newKey, '');
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            Add Rule
          </button>
        </div>

        {/* GameType Selection */}
        <div>
          <label className="block text-sm font-medium">Game Type:</label>
          <select
            name="gameType"
            value={newPoker.gameType}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="NLH">No Limit Hold'em (NLH)</option>
            <option value="PLO4">Pot Limit Omaha 4 (PLO4)</option>
            <option value="PLO5">Pot Limit Omaha 5 (PLO5)</option>
            <option value="OmahaHILO">Omaha High-Low (OmahaHILO)</option>
            <option value="SDH">Seven Card Stud High (SDH)</option>
            <option value="STUD">Seven Card Stud (STUD)</option>
            <option value="RAZZ">Razz</option>
            <option value="PINEAPPLE">Pineapple</option>
            <option value="COURCHEVEL">Courchevel</option>
            <option value="5CD">Five Card Draw (5CD)</option>
            <option value="BADUGI">Badugi</option>
            <option value="MIXED">Mixed Games</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Status:</label>
          <select
            name="status"
            value={newPoker.status}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="disable">Disable</option>
          </select>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Create Poker Game
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {/* List of Poker Games */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Poker Games</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="py-2 px-4 bg-gray-100 border-b">Name</th>
                <th className="py-2 px-4 bg-gray-100 border-b">Objective</th>
                <th className="py-2 px-4 bg-gray-100 border-b">Status</th>
                <th className="py-2 px-4 bg-gray-100 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pokers.map((poker) => (
                <tr key={poker._id}>
                  <td className="py-2 px-4 border-b">{poker.name}</td>
                  <td className="py-2 px-4 border-b">{poker.objective}</td>
                  <td className="py-2 px-4 border-b">{poker.status}</td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => startEditing(poker)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(poker._id)}
                      className="ml-4 text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                    <Link href={`/admin/pokerMode/${poker._id}`} className="ml-4 text-purple-600 hover:text-purple-800">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal for editing poker game */}
      {isEditingModalOpen && editingPoker && editingPokerId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Edit Poker Game</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Name:</label>
                <input
                  type="text"
                  name="name"
                  value={editingPoker.name || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Objective:</label>
                <input
                  type="text"
                  name="objective"
                  value={editingPoker.objective || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>

              {/* Editable Rules */}
              <div>
                <label className="block text-sm font-medium">Rules:</label>
                <div className="space-y-2">
                  {Array.from(editingPoker.rules?.keys() || []).map((key, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => handleEditRuleChange(key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                      />
                      <input
                        type="text"
                        value={editingPoker.rules?.get(key) || ''}
                        onChange={(e) =>
                          handleEditRuleChange(key, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newKey = `Rule ${editingPoker.rules?.size || 0 + 1}`;
                    handleEditRuleChange(newKey, '');
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Add Rule
                </button>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Update Poker Game
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
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

export default PokerAdmin;







// 'use client'
// import Link from 'next/link';
// import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
// import useSocket from '../../hooks/useSocket'
// interface Poker {
//   _id: string;
//   name: string;
//   communityCardsCount: number;
//   maxHoleCards: number;
//   numberOfRounds: number;
//   blindsOrAntes: 'Blinds' | 'Antes';
//   objective: string;
//   status: 'active' | 'maintenance' | 'disable';
// }

// const PokerAdmin: React.FC = () => {
//   const [pokers, setPokers] = useState<Poker[]>([]);
//   const [newPoker, setNewPoker] = useState<Omit<Poker, '_id'>>({
//     name: '',
//     communityCardsCount: 0,
//     maxHoleCards: 2,
//     numberOfRounds: 0,
//     blindsOrAntes: 'Blinds',
//     objective: '',
//     status: 'active',
//   });
//   const [editingPoker, setEditingPoker] = useState<Partial<Omit<Poker, '_id'>> | null>(null);
//   const [editingPokerId, setEditingPokerId] = useState<string | null>(null);
//   const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
//    const socket = useSocket("tattvamasi");
//   useEffect(() => {
//     // Fetch existing poker games from your backend
//     fetch('/api/admin/poker')
//       .then((response) => response.json())
//       .then((data: Poker[]) => setPokers(data));
//   }, []);

//   const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     setNewPoker({ ...newPoker, [e.target.name]: e.target.value });
//   };

//   const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     fetch('/api/admin/createPoker', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(newPoker),
//     }).then(() => {
//       setPokers([...pokers, { ...newPoker, _id: '' } as Poker]); // Placeholder _id
//       setNewPoker({
//         name: '',
//         communityCardsCount: 0,
//         maxHoleCards: 2,
//         numberOfRounds: 0,
//         blindsOrAntes: 'Blinds',
//         objective: '',
//         status: 'active',
//       });
//       setIsModalOpen(false); // Close the modal after submission
//     });
//   };

//   const startEditing = (poker: Poker) => {
//     setEditingPoker({
//       name: poker.name,
//       communityCardsCount: poker.communityCardsCount,
//       maxHoleCards: poker.maxHoleCards,
//       numberOfRounds: poker.numberOfRounds,
//       blindsOrAntes: poker.blindsOrAntes,
//       objective: poker.objective,
//       status: poker.status,
//     });
//     setEditingPokerId(poker._id);
//   };

//   const handleEditChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     if (editingPoker) {
//       setEditingPoker({ ...editingPoker, [e.target.name]: e.target.value });
//     }
//   };

//   const handleUpdate = (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     if (editingPokerId && editingPoker) {
//       fetch(`/api/admin/editPoker/${editingPokerId}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(editingPoker),
//       }).then(() => {
//         setPokers(pokers.map((p) => (p._id === editingPokerId ? { ...editingPoker, _id: editingPokerId } as Poker : p)));
//         setEditingPoker(null);
//         setEditingPokerId(null);
//       });
//     }
//   };

//   const handleDelete = (id: string) => {
//     fetch(`/api/admin/deletePoker/${id}`, { method: 'DELETE' }).then(() => {
//       setPokers(pokers.filter((poker) => poker._id !== id));
//     });
//   };

//   const cancelEditing = () => {
//     setEditingPoker(null);
//     setEditingPokerId(null);
//   };

//   return (
//     <div className="container mx-auto px-4">
//    <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 p-3 rounded-lg">
//   <h2 className="text-2xl font-semibold text-left text-white flex-grow">
//     Poker Games
//   </h2>

//   {/* Button to open the modal */}
//   <button
//     onClick={() => setIsModalOpen(true)}
//     className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-500 transition-all duration-300"
//   >
//     Create Poker Game
//   </button>
// </div>



//       {/* Modal for creating poker game */}
//       {isModalOpen && (
//         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
//           <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
//             <h2 className="text-xl font-semibold mb-4">Create Poker Game</h2>
//             <form onSubmit={handleSubmit} className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium">Name:</label>
//                 <input
//                   type="text"
//                   name="name"
//                   value={newPoker.name}
//                   onChange={handleChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Community Cards Count:</label>
//                 <input
//                   type="number"
//                   name="communityCardsCount"
//                   value={newPoker.communityCardsCount}
//                   onChange={handleChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   min="0"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Max Hole Cards:</label>
//                 <input
//                   type="number"
//                   name="maxHoleCards"
//                   value={newPoker.maxHoleCards}
//                   onChange={handleChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   min="1"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Number of Rounds:</label>
//                 <input
//                   type="number"
//                   name="numberOfRounds"
//                   value={newPoker.numberOfRounds}
//                   onChange={handleChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   min="0"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Blinds or Antes:</label>
//                 <select
//                   name="blindsOrAntes"
//                   value={newPoker.blindsOrAntes}
//                   onChange={handleChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                 >
//                   <option value="Blinds">Blinds</option>
//                   <option value="Antes">Antes</option>
//                 </select>
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Objective:</label>
//                 <input
//                   type="text"
//                   name="objective"
//                   value={newPoker.objective}
//                   onChange={handleChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Status:</label>
//                 <select
//                   name="status"
//                   value={newPoker.status}
//                   onChange={handleChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                 >
//                   <option value="active">Active</option>
//                   <option value="maintenance">Maintenance</option>
//                   <option value="disable">Disable</option>
//                 </select>
//               </div>
//               <div className="flex space-x-4">
//                 <button
//                   type="submit"
//                   className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
//                 >
//                   Create Poker Game
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => setIsModalOpen(false)}
//                   className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* List of Poker Games */}
//       <section>
//   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//     {pokers.map((poker) => (
//       <div key={poker._id} className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
//         <div className="p-4">
//           <h3 className="text-xl font-semibold text-gray-800">{poker.name}</h3>
//           <p className="text-gray-600 mt-2">Community Cards: {poker.communityCardsCount}</p>
//           <p className="text-gray-600">Max Hole Cards: {poker.maxHoleCards}</p>
//           <p className="text-gray-600">Rounds: {poker.numberOfRounds}</p>
//           <p className="text-gray-600">Blinds/Antes: {poker.blindsOrAntes}</p>
//           <p className="text-gray-600">Objective: {poker.objective}</p>
//           <p className={`text-sm mt-3 ${poker.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
//             Status: {poker.status}
//           </p>
//         </div>
//         <div className="flex justify-between p-4 bg-gray-100">
//           <button
//             onClick={() => startEditing(poker)}
//             className="text-blue-600 hover:text-blue-800 font-medium"
//           >
//             Edit
//           </button>
//           <button
//             onClick={() => handleDelete(poker._id)}
//             className="text-red-600 hover:text-red-800 font-medium"
//           >
//             Delete
//           </button>
//           <Link href={`/admin/pokerMode/${poker._id}`}>
//             <span className="text-indigo-600 hover:text-indigo-800 font-medium">Details</span>
//           </Link>
//         </div>
//       </div>
//     ))}
//   </div>
// </section>


//       {/* Modal for editing poker game */}
//       {editingPoker && editingPokerId && (
//         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
//           <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
//             <h2 className="text-xl font-semibold mb-4">Edit Poker Game</h2>
//             <form onSubmit={handleUpdate} className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium">Name:</label>
//                 <input
//                   type="text"
//                   name="name"
//                   value={editingPoker.name || ''}
//                   onChange={handleEditChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Community Cards Count:</label>
//                 <input
//                   type="number"
//                   name="communityCardsCount"
//                   value={editingPoker.communityCardsCount || 0}
//                   onChange={handleEditChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   min="0"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Max Hole Cards:</label>
//                 <input
//                   type="number"
//                   name="maxHoleCards"
//                   value={editingPoker.maxHoleCards || 2}
//                   onChange={handleEditChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   min="1"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Number of Rounds:</label>
//                 <input
//                   type="number"
//                   name="numberOfRounds"
//                   value={editingPoker.numberOfRounds || 0}
//                   onChange={handleEditChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                   min="0"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Blinds or Antes:</label>
//                 <select
//                   name="blindsOrAntes"
//                   value={editingPoker.blindsOrAntes || 'Blinds'}
//                   onChange={handleEditChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                 >
//                   <option value="Blinds">Blinds</option>
//                   <option value="Antes">Antes</option>
//                 </select>
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Objective:</label>
//                 <input
//                   type="text"
//                   name="objective"
//                   value={editingPoker.objective || ''}
//                   onChange={handleEditChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium">Status:</label>
//                 <select
//                   name="status"
//                   value={editingPoker.status || 'active'}
//                   onChange={handleEditChange}
//                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 focus:border-blue-500"
//                 >
//                   <option value="active">Active</option>
//                   <option value="maintenance">Maintenance</option>
//                   <option value="disable">Disable</option>
//                 </select>
//               </div>
//               <div className="flex space-x-4">
//                 <button
//                   type="submit"
//                   className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
//                 >
//                   Update Poker Game
//                 </button>
//                 <button
//                   type="button"
//                   onClick={cancelEditing}
//                   className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default PokerAdmin;
