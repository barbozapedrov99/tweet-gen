
import React, { useEffect, useRef } from 'react';
import { TweetData, Guideline } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

interface TweetCardProps {
  data: TweetData;
  onMouseDown: (e: React.MouseEvent, element: 'header' | 'content' | 'tweetImage') => void;
  onTouchStart: (e: React.TouchEvent, element: 'header' | 'content' | 'tweetImage') => void;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, element: 'header' | 'content' | 'tweetImage', handle: string) => void;
  onDoubleClick: (element: 'displayName' | 'handle' | 'content') => void;
  editingField: 'displayName' | 'handle' | 'content' | null;
  onEditChange: (value: string) => void;
  onEditBlur: () => void;
  guidelines?: Guideline[];
}

// Helper component for Resize Handles
const ResizeHandles = ({ onResizeStart, element }: { 
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, element: 'header' | 'content' | 'tweetImage', handle: string) => void, 
  element: 'header' | 'content' | 'tweetImage' 
}) => {
  const handleStyle = "absolute w-6 h-6 bg-blue-500 border-2 border-white rounded-full shadow-lg z-50 pointer-events-auto transform transition-transform hover:scale-125 active:scale-110 touch-none";
  
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.stopPropagation(); // Prevent drag of the parent
    onResizeStart(e, element, handle);
  };

  return (
    <>
      <div className="absolute inset-0 border-2 border-blue-500 opacity-0 group-hover:opacity-100 pointer-events-none rounded-lg transition-opacity" />
      
      {/* Corners - Now passing specific handle IDs */}
      <div 
        className={`${handleStyle} -top-3 -left-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity`}
        onMouseDown={(e) => handleInteraction(e, 'nw')}
        onTouchStart={(e) => handleInteraction(e, 'nw')}
      />
      <div 
        className={`${handleStyle} -top-3 -right-3 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity`}
        onMouseDown={(e) => handleInteraction(e, 'ne')}
        onTouchStart={(e) => handleInteraction(e, 'ne')}
      />
      <div 
        className={`${handleStyle} -bottom-3 -left-3 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity`}
        onMouseDown={(e) => handleInteraction(e, 'sw')}
        onTouchStart={(e) => handleInteraction(e, 'sw')}
      />
      <div 
        className={`${handleStyle} -bottom-3 -right-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity`}
        onMouseDown={(e) => handleInteraction(e, 'se')}
        onTouchStart={(e) => handleInteraction(e, 'se')}
      />
    </>
  );
};

// Helper for Auto-Focus Textarea/Input
const AutoFocusInput = ({ value, onChange, onBlur, style, className, isTextArea = false }: any) => {
  const ref = useRef<any>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      // Move cursor to end
      ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length);
    }
  }, []);

  if (isTextArea) {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={style}
        className={className}
        onKeyDown={(e) => { e.stopPropagation(); }} // Stop deleting card when hitting delete inside text
      />
    );
  }
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => { 
        e.stopPropagation(); 
        if(e.key === 'Enter') onBlur();
      }}
      style={style}
      className={className}
    />
  );
};

export const TweetCard: React.FC<TweetCardProps> = ({ 
  data, 
  onMouseDown, 
  onTouchStart, 
  onResizeStart, 
  onDoubleClick,
  editingField,
  onEditChange,
  onEditBlur,
  guidelines = [] 
}) => {
  const isDark = data.background === '#000000' || data.background === '#15202B' || data.background.includes('111827');
  
  return (
    <div 
      className="text-black flex flex-col items-start relative overflow-hidden select-none shadow-2xl"
      style={{
        width: '1080px',
        height: '1440px', // 3:4 Aspect Ratio
        padding: '120px 100px', // Generous padding
        background: data.background
      }}
    >
      {/* Visual Alignment Guidelines Overlay */}
      {guidelines.map((guide, index) => (
        <div
          key={index}
          className="absolute z-50 pointer-events-none"
          style={{
            left: guide.type === 'vertical' ? `${guide.position}px` : '0',
            top: guide.type === 'horizontal' ? `${guide.position}px` : '0',
            width: guide.type === 'vertical' ? '1px' : '100%',
            height: guide.type === 'horizontal' ? '1px' : '100%',
            backgroundColor: '#ff0055', 
            borderLeft: guide.type === 'vertical' ? '1px dashed #ff0055' : 'none',
            borderTop: guide.type === 'horizontal' ? '1px dashed #ff0055' : 'none',
          }}
        />
      ))}

      {/* Header Section (Moveable & Scalable) */}
      <div 
        className="group relative flex items-center gap-6 flex-shrink-0 w-full mb-16 cursor-move touch-none rounded-lg"
        onMouseDown={(e) => onMouseDown(e, 'header')}
        onTouchStart={(e) => onTouchStart(e, 'header')}
        style={{
          transform: `translate(${data.headerPosition.x}px, ${data.headerPosition.y}px) scale(${data.headerScale})`,
          transformOrigin: 'left center',
        }}
      >
        <ResizeHandles onResizeStart={onResizeStart} element="header" />
        
        {/* Avatar */}
        <div className="flex-shrink-0">
          <img 
            src={data.avatarUrl} 
            alt={data.displayName} 
            className="rounded-full object-cover pointer-events-none"
            style={{ width: '150px', height: '150px' }}
          />
        </div>

        {/* Name and Handle */}
        <div className="flex flex-col justify-center gap-1 w-full">
          <div className="flex items-center gap-3">
            {editingField === 'displayName' ? (
                <AutoFocusInput 
                    value={data.displayName}
                    onChange={onEditChange}
                    onBlur={onEditBlur}
                    style={{ fontSize: '56px', lineHeight: '1', color: isDark ? 'white' : '#0F1419' }}
                    className="bg-transparent outline-none w-full font-bold tracking-tight p-0 m-0 border-b border-blue-500"
                />
            ) : (
                <span 
                  className="font-bold tracking-tight cursor-text"
                  onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick('displayName'); }}
                  style={{ fontSize: '56px', lineHeight: '1', color: isDark ? 'white' : '#0F1419' }}
                > 
                  {data.displayName}
                </span>
            )}
            
            <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center' }}>
               <VerifiedBadge />
            </div>
          </div>

          {editingField === 'handle' ? (
              <AutoFocusInput 
                  value={data.handle}
                  onChange={onEditChange}
                  onBlur={onEditBlur}
                  style={{ fontSize: '42px', lineHeight: '1.2', color: isDark ? '#9CA3AF' : '#536471' }}
                  className="bg-transparent outline-none w-full p-0 m-0 border-b border-blue-500"
              />
          ) : (
              <span 
                className="cursor-text"
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick('handle'); }}
                style={{ fontSize: '42px', lineHeight: '1.2', color: isDark ? '#9CA3AF' : '#536471' }}
              >
                {data.handle}
              </span>
          )}
        </div>
      </div>

      {/* Tweet Body (Moveable & Scalable) */}
      <div 
        className="group relative flex-shrink-0 cursor-move touch-none rounded-lg mb-8"
        onMouseDown={(e) => onMouseDown(e, 'content')}
        onTouchStart={(e) => onTouchStart(e, 'content')}
        style={{
            transform: `translate(${data.contentPosition.x}px, ${data.contentPosition.y}px) scale(${data.contentScale})`,
            transformOrigin: 'left top',
            width: `${data.contentWidth ?? 100}%`,
            maxWidth: '1300px',
        }}
      >
        <ResizeHandles onResizeStart={onResizeStart} element="content" />
        
        {editingField === 'content' ? (
            <AutoFocusInput 
                isTextArea
                value={data.content}
                onChange={onEditChange}
                onBlur={onEditBlur}
                style={{ 
                    fontSize: '92px', 
                    lineHeight: '1.15', 
                    letterSpacing: '-0.02em',
                    color: isDark ? 'white' : '#0F1419',
                    height: 'auto',
                    minHeight: '200px'
                }}
                className="bg-transparent outline-none w-full whitespace-pre-wrap font-normal resize-none overflow-hidden border border-blue-500/50 rounded p-2"
            />
        ) : (
            <p 
              className="whitespace-pre-wrap font-normal text-left cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick('content'); }}
              style={{ 
                fontSize: '92px', 
                lineHeight: '1.15', 
                letterSpacing: '-0.02em',
                color: isDark ? 'white' : '#0F1419'
              }}
            >
              {data.content}
            </p>
        )}
      </div>

      {/* Tweet Image Section (Draggable & Scalable) */}
      {data.tweetImage && (
        <div
            className="group relative cursor-move touch-none rounded-2xl"
            onMouseDown={(e) => onMouseDown(e, 'tweetImage')}
            onTouchStart={(e) => onTouchStart(e, 'tweetImage')}
            style={{
                transform: `translate(${data.tweetImagePosition.x}px, ${data.tweetImagePosition.y}px) scale(${data.tweetImageScale})`,
                transformOrigin: 'top left',
                width: '100%',
                display: 'flex',
                justifyContent: 'center'
            }}
        >
             <ResizeHandles onResizeStart={onResizeStart} element="tweetImage" />
             <img 
                src={data.tweetImage}
                alt="Tweet attachment"
                className="w-full h-auto rounded-3xl border border-gray-100/10 shadow-sm pointer-events-none object-cover max-h-[800px]"
             />
        </div>
      )}
      
    </div>
  );
};
