import React from 'react';

interface SectionHeaderProps {
  title: string;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, className = '' }) => {
  return (
    <div className={`text-xl font-bold text-slate-300 mb-6 border-b border-slate-700 pb-3 ${className}`}>
      {title}
    </div>
  );
};

export default SectionHeader;