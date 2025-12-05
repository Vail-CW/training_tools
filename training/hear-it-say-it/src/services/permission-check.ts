import { isIOS } from '../core/speech-recognition';

export async function checkMicrophonePermission(): Promise<'granted' | 'prompt' | 'denied'> {
  if (navigator.permissions?.query) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state;
    } catch {
      // Permissions API doesn't support microphone on this browser (e.g., iOS Safari)
    }
  }
  return 'prompt'; // Fallback: trigger getUserMedia to find out
}

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Release immediately
    return true;
  } catch {
    return false;
  }
}

export function getDeniedInstructions(): string {
  const isIOSSafari = /Safari/.test(navigator.userAgent) && isIOS();
  const isChromeMobile = /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);

  if (isIOSSafari) {
    return 'Go to Settings → Safari → Microphone and enable access for this site.';
  } else if (isChromeMobile) {
    return 'Tap the lock icon in the address bar → Site settings → Microphone → Allow.';
  }
  return 'Click the lock/info icon in your browser\'s address bar and allow microphone access, then refresh.';
}
