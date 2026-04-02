import { useState, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ListUploader = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleDragOver = useCallback((e) => {
    e?.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e?.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e?.preventDefault();
    setIsDragging(false);
    
    const files = e?.dataTransfer?.files;
    if (files?.length > 0) {
      handleFileUpload(files?.[0]);
    }
  }, []);

  const handleFileSelect = (e) => {
    const files = e?.target?.files;
    if (files?.length > 0) {
      handleFileUpload(files?.[0]);
    }
  };

  const handleFileUpload = (file) => {
    if (!file) return;

    const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    if (!validTypes?.includes(file?.type) && !file?.name?.endsWith('.csv') && !file?.name?.endsWith('.xlsx')) {
      alert('Please upload a valid Excel (.xlsx) or CSV (.csv) file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFile(file);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          
          // Simulate classification and create new list
          const newList = {
            id: 'list-' + Date.now(),
            name: file?.name?.replace(/\.(xlsx|csv)$/, ''),
            totalContacts: Math.floor(Math.random() * 10000) + 1000,
            tierBreakdown: {
              platinum: Math.floor(Math.random() * 500),
              gold: Math.floor(Math.random() * 2000),
              silver: Math.floor(Math.random() * 3000),
              bronze: Math.floor(Math.random() * 2000),
              lead: Math.floor(Math.random() * 2500)
            },
            engagementScore: Math.floor(Math.random() * 40) + 60,
            verificationCoverage: 0,
            deliverabilityRate: 0,
            lastUpdated: new Date()?.toISOString(),
            createdAt: new Date()?.toISOString()
          };
          
          onUpload?.(newList);
          
          setTimeout(() => {
            setUploadedFile(null);
            setUploadProgress(0);
          }, 2000);
          
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Upload Contact List
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Import Excel or CSV files to create new contact lists
          </p>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50 hover:bg-muted'
        }`}
      >
        {isUploading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin">
                <Icon name="Loader" size={32} className="text-primary" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground mb-2">
                Uploading {uploadedFile?.name}...
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {uploadProgress}% complete
              </div>
            </div>
          </div>
        ) : uploadProgress === 100 ? (
          <div className="space-y-3">
            <Icon name="CheckCircle" size={48} className="text-success mx-auto" />
            <div className="text-sm font-medium text-success">
              Upload Complete!
            </div>
            <div className="text-xs text-muted-foreground">
              Classifying contacts by engagement tier...
            </div>
          </div>
        ) : (
          <>
            <Icon name="Upload" size={48} className="text-muted-foreground mx-auto mb-4" />
            <div className="mb-4">
              <p className="text-sm font-medium text-foreground mb-1">
                Drag and drop your file here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button as="span" iconName="FolderOpen">
                Select File
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-4">
              Supported formats: .xlsx, .csv (Max 50MB)
            </p>
          </>
        )}
      </div>

      <div className="mt-6 bg-muted rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Automatic Tier Classification</p>
            <p>
              Uploaded contacts will be automatically classified into tiers (Lead to Platinum) based on engagement history and verification status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListUploader;