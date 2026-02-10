import React from 'react';
import { TweetData } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

interface TweetCardProps {
  data: TweetData;
}

export const TweetCard: React.FC<TweetCardProps> = ({ data }) => {
  return (
    <div 
      className="bg-white text-black font-sans flex flex-col items-start relative overflow-hidden"
      style={{
        width: '1080px',
        height: '1440px', // 3:4 Aspect Ratio
        padding: '120px 100px', // Generous padding like the screenshot
      }}
    >
      {/* Header Section */}
      <div className="flex items-center gap-6 flex-shrink-0 w-full mb-16">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <img 
            src={data.avatarUrl} 
            alt={data.displayName} 
            className="rounded-full object-cover"
            style={{ width: '150px', height: '150px' }}
          />
        </div>

        {/* Name and Handle */}
        <div className="flex flex-col justify-center gap-1">
          <div className="flex items-center gap-3">
            <span 
              className="font-bold text-[#0F1419] tracking-tight"
              style={{ fontSize: '56px', lineHeight: '1' }}
            > 
              {data.displayName}
            </span>
            <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center' }}>
               <VerifiedBadge />
            </div>
          </div>
          <span 
            className="text-[#536471]"
            style={{ fontSize: '42px', lineHeight: '1.2' }}
          >
            {data.handle}
          </span>
        </div>
      </div>

      {/* Tweet Body - Massive Typography */}
      <div className="flex-1 flex flex-col justify-start w-full">
        <p 
          className="whitespace-pre-wrap text-[#0F1419] font-normal text-left"
          style={{ 
            fontSize: '92px', 
            lineHeight: '1.15', 
            letterSpacing: '-0.02em',
          }}
        >
          {data.content}
        </p>
      </div>
      
    </div>
  );
};
