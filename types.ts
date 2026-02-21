
export interface Position {
  x: number;
  y: number;
}

export interface TweetData {
  displayName: string;
  handle: string;
  content: string;
  avatarUrl: string;
  
  // Design Properties
  background: string; // CSS background property (e.g., color or gradient)
  headerPosition: Position;
  headerScale: number;
  contentPosition: Position;
  contentScale: number;
  contentWidth: number; // percentage width for content block

  // New Media Properties
  tweetImage?: string | null;
  tweetImagePosition: Position;
  tweetImageScale: number;
}

export interface GeminiError {
  message: string;
}

export interface Guideline {
  type: 'vertical' | 'horizontal';
  position: number; // pixel value relative to the card container
}

export interface BackgroundOption {
  id: string;
  name: string;
  style: string; // CSS background value
  previewClass: string; // Tailwind class for the preview circle
}
