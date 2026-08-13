export type DeviceTier = 'low' | 'mid' | 'high';

type NavigatorWithMemory = Navigator & {
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
};

export function detectDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'mid';
  const nav = navigator as NavigatorWithMemory;

  // User has data-saver on → treat as low
  if (nav.connection?.saveData === true) return 'low';

  // Slow connection → likely budget phone on cellular
  const effectiveType = nav.connection?.effectiveType;
  if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') {
    return 'low';
  }

  // deviceMemory in GB. API optional.
  const memory = nav.deviceMemory;
  if (typeof memory === 'number') {
    if (memory <= 2) return 'low';
    if (memory <= 4) return 'mid';
    return 'high';
  }

  // Fallback: hardware concurrency
  const cores = nav.hardwareConcurrency || 2;
  if (cores <= 2) return 'low';
  if (cores <= 4) return 'mid';
  return 'high';
}

/** Recommended engine depth for each device tier. Conservative for low-end. */
export function recommendedDepth(tier: DeviceTier): number {
  switch (tier) {
    case 'low': return 8;
    case 'mid': return 12;
    case 'high': return 15;
  }
}

/** Recommended parallel worker count for each device tier. */
export function recommendedWorkers(tier: DeviceTier): number {
  switch (tier) {
    case 'low': return 1;
    case 'mid': return 2;
    case 'high': return 4;
  }
}
