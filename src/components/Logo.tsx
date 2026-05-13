import React from 'react';

export const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="text-white font-bold tracking-[0.1em] text-xl uppercase font-sans">
        412 Nemesis
      </div>
    </div>
  );
};
