
import { TweetData, BackgroundOption } from "./types";

// A simple gray 1x1 pixel image to prevent large string syntax errors. 
// The previous large image might have caused copy-paste truncation issues.
export const DEFAULT_AVATAR_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'classic',
    name: 'Clássico',
    style: '#FFFFFF',
    previewClass: 'bg-white border-2 border-slate-200'
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    style: '#15202B',
    previewClass: 'bg-[#15202B] border-2 border-slate-700'
  },
  {
    id: 'sunset',
    name: 'Sunset Viral',
    style: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)',
    previewClass: 'bg-gradient-to-br from-pink-300 to-pink-100'
  },
  {
    id: 'tech',
    name: 'Tech Blue',
    style: 'linear-gradient(135deg, #E0F2FE 0%, #E0E7FF 100%)',
    previewClass: 'bg-gradient-to-br from-blue-100 to-indigo-100'
  },
  {
    id: 'lemon',
    name: 'Fresh Lemon',
    style: 'linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)',
    previewClass: 'bg-gradient-to-br from-slate-50 to-slate-200'
  },
  {
    id: 'neon',
    name: 'Neon Dark',
    style: 'linear-gradient(to bottom right, #111827, #1e1b4b)',
    previewClass: 'bg-gradient-to-br from-gray-900 to-indigo-950'
  }
];

export const DEFAULT_TWEET_DATA: TweetData = {
  displayName: "Pedro Barboza",
  handle: "@Pedro.barboza_",
  content: "Dê vida aos seus posts usando a primeira ferramenta do Brasil que gera posts do Instagram no Formato de Tweet.",
  avatarUrl: DEFAULT_AVATAR_BASE64,
  headerPosition: { x: 0, y: 0 },
  headerScale: 1,
  contentPosition: { x: 0, y: 0 },
  contentScale: 1,
  contentWidth: 100,
  
  background: BACKGROUND_OPTIONS[0].style,

  // New Media defaults
  tweetImage: null,
  tweetImagePosition: { x: 0, y: 0 },
  tweetImageScale: 1.0,
};

export const GEMINI_MODEL = 'gemini-2.5-flash-image';
