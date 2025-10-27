
import React from 'react';
import IconButton from './IconButton';

interface ResultCardProps {
  title: string;
  text: string;
  onSave: () => void;
}

const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ResultCard: React.FC<ResultCardProps> = ({ title, text, onSave }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg flex flex-col h-full ring-1 ring-white/10">
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-blue-300">{title}</h3>
        <IconButton onClick={onSave} aria-label={`Salva ${title}`}>
          <DownloadIcon />
        </IconButton>
      </div>
      <div className="p-4 overflow-y-auto flex-grow">
        <p className="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
};

export default ResultCard;