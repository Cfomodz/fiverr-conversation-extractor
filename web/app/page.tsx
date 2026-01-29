'use client';

import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import Link from 'next/link';

export default function Home() {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    // Generate a random ID if one isn't stored
    const stored = localStorage.getItem('amifree_userid');
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserId(stored);
    } else {
      const newId = nanoid(10);
      localStorage.setItem('amifree_userid', newId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserId(newId);
    }
  }, []);

  const regenerateId = () => {
    const newId = nanoid(10);
    localStorage.setItem('amifree_userid', newId);
    setUserId(newId);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold mb-2 text-indigo-600">Am I Free Right Now?</h1>
          <p className="text-xl text-gray-600">Signal-driven availability prediction.</p>
        </header>

        <main className="space-y-8">
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-4">1. Your User ID</h2>
            <div className="flex items-center gap-4 mb-4">
              <code className="bg-gray-100 p-4 rounded-lg text-2xl font-mono block w-full text-center tracking-wider border border-gray-200">
                {userId}
              </code>
              <button 
                onClick={regenerateId}
                className="px-4 py-4 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition"
                title="Regenerate ID"
              >
                🔄
              </button>
            </div>
            <p className="text-sm text-gray-500">
              This ID identifies your signals. Keep it secret if you want your availability to be private.
            </p>
          </section>

          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-4">2. Setup Extension</h2>
            <ol className="list-decimal list-inside space-y-2 text-lg text-gray-700">
              <li>Install the Chrome Extension (Load Unpacked <code>/extension</code> folder).</li>
              <li>Click the extension icon.</li>
              <li>Enter User ID: <strong>{userId}</strong></li>
              <li>Enter API URL: <strong>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/signal</strong></li>
              <li>Click <strong>Save Settings</strong>.</li>
            </ol>
          </section>

          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-4">3. View Availability</h2>
            <p className="mb-6 text-gray-700">Share this link with people who want to know if you are free:</p>
            
            <Link 
              href={`/${userId}`} 
              target="_blank"
              className="inline-block w-full text-center bg-indigo-600 text-white font-bold py-4 px-8 rounded-xl hover:bg-indigo-700 transition transform hover:scale-[1.02] shadow-lg"
            >
              Open My Public Availability Page
            </Link>
          </section>
          
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
             <h2 className="text-xl font-bold mb-4">How it works</h2>
             <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                   <h3 className="font-bold text-green-800 mb-2">✅ Free Signals</h3>
                   <ul className="list-disc list-inside text-green-700 space-y-1">
                      <li>Checking Gmail</li>
                      <li>Checking Slack</li>
                   </ul>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                   <h3 className="font-bold text-red-800 mb-2">❌ Busy Signals</h3>
                   <ul className="list-disc list-inside text-red-700 space-y-1">
                      <li>Coding (GitHub, VS Code)</li>
                      <li>Researching (StackOverflow)</li>
                      <li>Idle / Away for long periods</li>
                   </ul>
                </div>
             </div>
          </section>
        </main>
      </div>
    </div>
  );
}
