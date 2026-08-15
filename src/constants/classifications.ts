export const classificationImages: Record<string, string> = {
  brilliant: '/img/classifications/brilliant.svg',
  critical: '/img/classifications/critical.svg',
  best: '/img/classifications/best.svg',
  excellent: '/img/classifications/excellent.svg',
  good: '/img/classifications/good.svg',
  okay: '/img/classifications/good.svg',
  inaccuracy: '/img/classifications/inaccuracy.svg',
  mistake: '/img/classifications/mistake.svg',
  blunder: '/img/classifications/blunder.svg',
  forced: '/img/classifications/forced.svg',
  book: '/img/classifications/book.svg',
  risky: '/img/classifications/sharp.svg',
};

export const loadingClassificationIcon = '/img/classifications/correct.svg';
export const errorClassificationIcon = '/img/classifications/incorrect.svg';

export const classificationColours: Record<string, string> = {
  brilliant: '#1baaa6',
  critical: '#5b8baf',
  best: '#98bc49',
  excellent: '#98bc49',
  okay: '#97af8b',
  good: '#97af8b',
  inaccuracy: '#f4bf44',
  mistake: '#e28c28',
  blunder: '#c93230',
  forced: '#97af8b',
  book: '#a88764',
  risky: '#8983ac',
};

export const classificationNames: Record<string, string> = {
  brilliant: 'Brilliant',
  critical: 'Critical',
  best: 'Best',
  excellent: 'Excellent',
  okay: 'Okay',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  forced: 'Forced',
  book: 'Book',
  risky: 'Risky',
};

export type ClassificationBadgeStyle = {
  label: string;
  color: string;
  bg: string;
  border: string;
};

// Badge colors shared by the Coach panel and the what-if display, so the same
// classification reads the same everywhere: blunder red, mistake orange,
// inaccuracy yellow, best green, brilliant purple, mate solid red/white.
export const classificationBadgeStyles: Record<string, ClassificationBadgeStyle | undefined> = {
  mate: { label: 'Mate', color: '#ffffff', bg: 'rgba(220,38,38,0.9)', border: 'rgba(220,38,38,0.9)' },
  blunder: { label: 'Blunder', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
  mistake: { label: 'Mistake', color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)' },
  inaccuracy: { label: 'Inaccuracy', color: '#facc15', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)' },
  best: { label: 'Best', color: '#4ade80', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)' },
  brilliant: { label: 'Brilliant', color: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)' },
  critical: { label: 'Critical', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' },
};
