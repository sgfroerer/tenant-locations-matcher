
import React, { useCallback, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FileData, parseFile, parseClipboardText } from '@/utils/fileUtils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface FileUploaderProps {
  onFileParsed: (data: FileData, headers: string[], fileType: 'source1' | 'source2') => void;
  fileType: 'source1' | 'source2';
  label: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileParsed, fileType, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [clipboardText, setClipboardText] = useState('');
  const [activeTab, setActiveTab] = useState('file');
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

  const handleClipboardPaste = useCallback(() => {
    if (!clipboardText.trim()) {
      toast({
        variant: "destructive",
        title: "No data to parse",
        description: "Please paste some data into the text area.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, headers } = parseClipboardText(clipboardText);
      
      if (headers.length === 0) {
        throw new Error("No headers detected. Please ensure the pasted data has headers.");
      }
      
      onFileParsed(data, headers, fileType);
      toast({
        title: "Data processed successfully",
        description: `${headers.length} columns and ${data.length} rows detected.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error processing clipboard data",
        description: error instanceof Error ? error.message : "Failed to parse clipboard data",
      });
    } finally {
      setIsLoading(false);
    }
  }, [clipboardText, onFileParsed, fileType, toast]);

  return (
    <div className="w-full">
      <h3 className="font-medium mb-2">{label}</h3>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file">Upload File</TabsTrigger>
          <TabsTrigger value="clipboard">Paste Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="file" className="mt-4">
          <div
            className={`file-drop border-2 border-dashed rounded-md p-6 text-center ${
              isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
            } ${fileName ? 'border-green-500' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.tsv,.txt"
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
                <p className="mt-2 text-sm text-muted-foreground">Accepts .csv, .xlsx, .xls, .tsv, .txt</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="clipboard" className="mt-4">
          <div className="space-y-4">
            <Textarea
              placeholder="Paste your data here (headers required)..."
              className="min-h-[150px]"
              value={clipboardText}
              onChange={(e) => setClipboardText(e.target.value)}
            />
            <Button 
              onClick={handleClipboardPaste}
              disabled={isLoading || !clipboardText.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                  Processing...
                </>
              ) : (
                'Process Data'
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Paste tab or comma separated data with headers in the first row
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FileUploader;
