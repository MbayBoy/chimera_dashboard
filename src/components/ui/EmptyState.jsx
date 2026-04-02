import Icon from '../AppIcon';

const EmptyState = ({
  icon = 'Inbox',
  title = 'No data found',
  description = 'There is nothing here yet.',
  actionLabel,
  onAction,
  className = ''
}) => (
  <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
      <Icon name={icon} size={28} className="text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
