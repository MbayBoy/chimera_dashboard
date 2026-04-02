import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';

const Breadcrumbs = () => {
  const location = useLocation();
  
  const pathSegments = location?.pathname?.split('/')?.filter(segment => segment !== '');

  const formatSegment = (segment) => {
    return segment?.split('-')?.map(word => word?.charAt(0)?.toUpperCase() + word?.slice(1))?.join(' ');
  };

  const buildPath = (index) => {
    return '/' + pathSegments?.slice(0, index + 1)?.join('/');
  };

  if (pathSegments?.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link
        to="/"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-smooth"
      >
        <Icon name="Home" size={16} />
        <span>Home</span>
      </Link>
      {pathSegments?.map((segment, index) => {
        const isLast = index === pathSegments?.length - 1;
        const path = buildPath(index);

        return (
          <div key={path} className="flex items-center gap-2">
            <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground">
                {formatSegment(segment)}
              </span>
            ) : (
              <Link
                to={path}
                className="text-muted-foreground hover:text-foreground transition-smooth"
              >
                {formatSegment(segment)}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;