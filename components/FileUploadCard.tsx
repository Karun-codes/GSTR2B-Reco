import React, { useRef } from 'react';

interface FileUploadCardProps {
    title: string;
    description: string;
    fileType: string;
    file: File | null;
    onFileChange: (file: File) => void;
    invoiceCount: number;
}

const FileUploadCard: React.FC<FileUploadCardProps> = ({ title, description, fileType, file, onFileChange, invoiceCount }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            onFileChange(event.target.files[0]);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            const droppedFile = event.dataTransfer.files[0];
            if (fileType.includes(droppedFile.name.split('.').pop() || '')) {
                onFileChange(droppedFile);
            }
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
        <div 
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-300 cursor-pointer ${file ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50'}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`Upload ${title}`}
        >
            <input
                type="file"
                accept={fileType}
                ref={inputRef}
                className="hidden"
                onChange={handleFileSelect}
                tabIndex={-1}
            />
            {!file ? (
                <>
                    <div className="flex justify-center mb-4">
                        <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
                    <p className="text-slate-500 text-sm mt-1">{description}</p>
                    <p className="mt-4 text-sm font-medium text-blue-600">
                        Click to upload or drag & drop
                    </p>
                </>
            ) : (
                <div className="text-left">
                    <div className="flex items-center space-x-3">
                         <svg className="w-10 h-10 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                         <div>
                            <p className="font-semibold text-slate-800 truncate" title={file.name}>{file.name}</p>
                            <p className="text-sm text-slate-500">{formatBytes(file.size)}</p>
                            {invoiceCount > 0 && <p className="text-sm font-medium text-green-600">{invoiceCount} records found</p>}
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUploadCard;