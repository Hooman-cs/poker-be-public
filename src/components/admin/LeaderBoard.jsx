const LeaderBoard = ({topPlayers}) => {

 return (
   <div className="bg-white border border-gray-300 rounded-lg shadow p-4 w-80">
     <div className="border-b border-gray-200 pb-2 mb-4">
       <h3 className="text-lg font-semibold text-gray-700">Top Players</h3>
     </div>
     <ul className="space-y-3">
       {topPlayers.map((player, index) => (
         <li
           key={index}
           className="flex items-center space-x-3 border border-gray-200 rounded p-3 hover:shadow-md"
         >
           <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
             {/* <img
               src="path/to/wonga-swiss-2.0-icon.png"
               
               className="w-8 h-8 object-contain"
             /> */}
           </div>
           <div className="flex-1">
             <span className="block text-sm font-medium text-gray-700">{player.username}</span>
             <span className="block text-sm text-gray-500">
               {player.totalBet.toLocaleString()} Chips
             </span>
           </div>
         </li>
       ))}
     </ul>
     <div className="mt-4 text-center">
       <a
         href="#"
         className="text-blue-500 text-sm font-medium hover:underline"
       >
         View All Players
       </a>
     </div>
   </div>
 );
};

export default LeaderBoard;