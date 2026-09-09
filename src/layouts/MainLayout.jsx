import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const MainLayout = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div id="app-container" className={isCollapsed ? 'collapsed' : ''}>
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden', minWidth: 0 }}>
        <TopBar />
        <main id="main-content" style={{ flexGrow: 1, overflowY: 'auto', padding: 'clamp(1rem, 2vw, 2.5rem)' }}>
          <div style={{ maxWidth: 'min(1400px, 100%)', margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
