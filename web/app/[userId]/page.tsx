'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface StatusData {
  status: string;
  confidence: number;
  reason: string;
}

export default function AvailabilityPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/status?userId=${userId}`);
        const data = await res.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch status', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [userId]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-100">Loading...</div>;
  }

  if (!status) {
    return <div className="flex items-center justify-center h-screen bg-gray-100">User not found or no data.</div>;
  }

  const isFree = status.status === 'FREE';
  const bgColor = isFree ? 'bg-green-500' : (status.status === 'BUSY' ? 'bg-red-500' : 'bg-yellow-500');

  return (
    <div className={`flex flex-col items-center justify-center h-screen ${bgColor} text-white transition-colors duration-500`}>
      <h1 className="text-6xl font-bold mb-4">
        {status.status === 'FREE' ? 'YES' : (status.status === 'BUSY' ? 'NO' : 'MAYBE')}
      </h1>
      <p className="text-2xl opacity-90 mb-8">
        {isFree ? 'I am free right now.' : 'I am busy right now.'}
      </p>
      
      <div className="bg-white bg-opacity-20 p-6 rounded-xl backdrop-blur-sm max-w-md text-center">
        <p className="text-lg font-semibold mb-2">Confidence: {status.confidence}%</p>
        <p className="text-md italic">&quot;{status.reason}&quot;</p>
      </div>

      <div className="absolute bottom-8 text-sm opacity-60">
        Signal Driven Availability &copy; 2024
      </div>
    </div>
  );
}
