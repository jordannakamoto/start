/**
 * 🎨 Clean App - Mature Document Management System
 * 
 * A complete rewrite using the mature document/tab/workspace management system.
 * Simple, reliable, and well-architected.
 */

import { useEffect } from 'react';
import { OrderedDisplay } from '@/components/OrderedDisplay';

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