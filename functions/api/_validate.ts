const ALLOWED_AVATAR_HOSTS = new Set([
  'api.dicebear.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'avatars.githubusercontent.com',
]);

export function isAllowedAvatar(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_AVATAR_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}