import Icon from '../AppIcon';

const ErrorFallback = ({ error, resetErrorBoundary, title = 'Something went wrong' }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
      <Icon name="AlertCircle" size={28} className="text-error" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mb-2">
      {error?.message || 'An unexpected error occurred. Please try again.'}
    </p>
    {resetErrorBoundary && (
      <button
        onClick={resetErrorBoundary}
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);

export default ErrorFallback;
