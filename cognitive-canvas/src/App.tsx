/**
 * 🎨 Clean App - Mature Document Management System
 * 
 * A complete rewrite using the mature document/tab/workspace management system.
 * Simple, reliable, and well-architected.
 */

import "./App.css";

import { OrderedDisplay } from '@/components/OrderedDisplay';
import { useEffect } from 'react';

function App() {
  // Simple initialization log
  useEffect(() => {
    console.log('🚀 App: Using ordered display system with first-draw coordination');
  }, []);

  return (
    <>
      {/* Ordered display handles panels → tabs → content rendering */}
      <OrderedDisplay />
    </>
  );
}

export default App;