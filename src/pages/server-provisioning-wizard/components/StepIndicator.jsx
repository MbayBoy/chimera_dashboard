import Icon from '../../../components/AppIcon';

const StepIndicator = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-between">
      {steps?.map((step, index) => (
        <div key={step?.number} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
              step?.number < currentStep
                ? 'bg-primary border-primary text-primary-foreground'
                : step?.number === currentStep
                ? 'bg-primary/10 border-primary text-primary' :'bg-muted border-border text-muted-foreground'
            }`}>
              {step?.number < currentStep ? (
                <Icon name="Check" size={16} />
              ) : (
                <Icon name={step?.icon} size={16} />
              )}
            </div>
            <span className={`text-xs mt-2 font-medium hidden sm:block ${
              step?.number <= currentStep ? 'text-foreground' : 'text-muted-foreground'
            }`}>{step?.label}</span>
          </div>
          {index < steps?.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${
              step?.number < currentStep ? 'bg-primary' : 'bg-border'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
