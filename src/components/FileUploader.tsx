
import React, { useCallback, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FileData, parseFile } from '@/utils/fileUtils';
import { Button } from '@/components/ui/button';

interface FileUploaderProps {
  onFileParsed: (data: FileData, headers: string[], fileType: 'source1' | 'source2') => void;
  fileType: 'source1' | 'source2';
  label: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileParsed, fileType, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      try {
        const { data, headers } = await parseFile(file);
        onFileParsed(data, headers, fileType);
        setFileName(file.name);
        toast({
          title: "File uploaded successfully",
          description: `${file.name} has been processed.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error uploading file",
          description: error instanceof Error ? error.message : "Failed to process file",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onFileParsed, fileType, toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  return (
    <div className="w-full">
      <h3 className="font-medium mb-2">{label}</h3>
      <div
        className={`file-drop ${isDragging ? 'file-drop-active' : ''} ${fileName ? 'border-green-500' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          id={`file-input-${fileType}`}
        />
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p>Processing file...</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center">
            <p className="text-green-600 font-medium mb-2">{fileName}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setFileName(null);
                document.getElementById(`file-input-${fileType}`)?.click();
              }}
            >
              Change File
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-2">Drag & drop your file here, or</p>
            <Button
              variant="outline"
              onClick={() => document.getElementById(`file-input-${fileType}`)?.click()}
            >
              Browse Files
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">Accepts .csv, .xlsx, .xls</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
