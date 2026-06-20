import { useCallback, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export type SoundType =
  | 'move' | 'move-self' | 'move-opponent' | 'move-check'
  | 'capture' | 'castle' | 'check' | 'promote'
  | 'game-end' | 'gameend' | 'game-win' | 'game-win-long'
  | 'game-lose' | 'game-lose-long' | 'game-draw' | 'game-start'
  | 'achievement' | 'notification' | 'notify'
  | 'click' | 'correct' | 'incorrect'
  | 'tenseconds' | 'clock-tick'
  | 'premove' | 'illegal'
  | 'drawoffer' | 'decline'
  | 'event-start' | 'event-end' | 'event-warning'
  | 'puzzle-correct' | 'puzzle-correct-2' | 'puzzle-wrong'
  | 'scatter' | 'shoutout'
  | 'lesson-fail' | 'lesson-pass'
  | 'correct-short'
  ;

const SOUND_FILES: Record<SoundType, string> = {
  'move': '/audio/move.mp3',
  'move-self': '/audio/move-self.mp3',
  'move-opponent': '/audio/move-opponent.mp3',
  'move-check': '/audio/move-check.mp3',
  'capture': '/audio/capture.mp3',
  'castle': '/audio/castle.mp3',
  'check': '/audio/check.mp3',
  'promote': '/audio/promote.mp3',
  'game-end': '/audio/game-end.mp3',
  'gameend': '/audio/gameend.mp3',
  'game-win': '/audio/game-win.mp3',
  'game-win-long': '/audio/game-win-long.mp3',
  'game-lose': '/audio/game-lose.mp3',
  'game-lose-long': '/audio/game-lose-long.mp3',
  'game-draw': '/audio/game-draw.mp3',
  'game-start': '/audio/game-start.mp3',
  'achievement': '/audio/achievement.mp3',
  'notification': '/audio/notification.mp3',
  'notify': '/audio/notify.mp3',
  'click': '/audio/click.mp3',
  'correct': '/audio/correct.mp3',
  'incorrect': '/audio/incorrect.mp3',
  'tenseconds': '/audio/tenseconds.mp3',
  'clock-tick': '/audio/click-original.mp3',
  'premove': '/audio/premove.mp3',
  'illegal': '/audio/illegal.mp3',
  'drawoffer': '/audio/drawoffer.mp3',
  'decline': '/audio/decline.mp3',
  'event-start': '/audio/event-start.mp3',
  'event-end': '/audio/event-end.mp3',
  'event-warning': '/audio/event-warning.mp3',
  'puzzle-correct': '/audio/puzzle-correct.mp3',
  'puzzle-correct-2': '/audio/puzzle-correct-2.mp3',
  'puzzle-wrong': '/audio/puzzle-wrong.mp3',
  'scatter': '/audio/scatter.mp3',
  'shoutout': '/audio/shoutout.mp3',
  'lesson-fail': '/audio/lesson-fail.mp3',
  'lesson-pass': '/audio/lesson-pass.mp3',
  'correct-short': '/audio/correct.mp3',
};

export function getSoundTypeFromSan(san: string): SoundType {
  if (san.includes('#')) return 'check';
  if (san.includes('+')) return 'move-check';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('=')) return 'promote';
  if (san.includes('x')) return 'capture';
  return 'move';
}

export function useSound() {
  const audioEnabled = useSettingsStore(s => s.settings.audioEnabled);
  const volume = useSettingsStore(s => s.settings.audioVolume);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((type: SoundType) => {
    if (!audioEnabled) return;
    const src = SOUND_FILES[type];
    if (!src) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio(src);
      audio.volume = volume;
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {}
  }, [audioEnabled, volume]);

  const playFromSan = useCallback((san: string) => {
    play(getSoundTypeFromSan(san));
  }, [play]);

  const playGameEnd = useCallback((result: string) => {
    if (result === '1-0') play('game-win');
    else if (result === '0-1') play('game-lose');
    else if (result === '1/2-1/2') play('game-draw');
    else play('gameend');
  }, [play]);

  return { play, playFromSan, playGameEnd };
}
