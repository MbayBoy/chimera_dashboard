import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

const ServerProvisioningWizard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Server" size={32} className="text-primary" />
            </div>
            <h1 className="text-2xl font-heading font-semibold text-foreground mb-2">Server Provisioning</h1>
            <p className="text-muted-foreground mb-6">
              The server provisioning wizard has been moved to the new Server Management page for a better experience.
            </p>
            <Button
              variant="default"
              iconName="ArrowRight"
              iconPosition="right"
              onClick={() => navigate('/server-management')}
            >
              Go to Server Management
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ServerProvisioningWizard;
