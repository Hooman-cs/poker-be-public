'use client'

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import LatestGameHistory from '@/components/admin/latestGameHistory';

export default function DeskGameArchive() {
    const [data, setData] = useState([]);
    const [pageNo, setPageNo] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [username, setUsername] = useState('');
    const [startDate, setStartDate] = useState('2021-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [sortBy, setSortBy] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc');
    const [totalPages, setTotalPages] = useState(0);

    const params = useParams();
    const deskId = params?.pokerDeskId;
     

    const fetchPokerGameData = () => {
        // Construct the query parameters for the request
        const params = {
            deskId  
        };
    
        // Make the API request
        axios.get('/api/admin/auth/getGameData', { params })
            .then(response => {
                // Log the response to the console
                console.log('API Response:', response.data);
            })
            .catch(error => {
                // Handle error
                console.error('Error fetching poker game data:', error);
            });
    }

    return (
        <div className="p-2 "> 
         <LatestGameHistory deskId={deskId} />
        </div>
    );
}
