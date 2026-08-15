/**
 * Heat-alarm browser notifications.
 *
 * Uses the Notification API + setTimeout.  Timers are re-registered on
 * every app mount so page refreshes don't lose pending alarms.
 * Works on desktop and Android-Chrome PWA.  iOS requires the app to be
 * added to the home screen (iOS 16.4+).
 */

/** Map of heatId → active timer handles */
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleHeatNotifications(
  heatId: string,
  scheduledBreedAt: string,
  alertAt: string,
  animalDisplay: string,  // barn name or reg name
  breedingType: 'conventional' | 'sexed',
) {
  cancelHeatNotifications(heatId);

  const handles: ReturnType<typeof setTimeout>[] = [];
  const now = Date.now();
  const typeLabel = breedingType === 'sexed' ? 'Sexed' : 'Conventional';

  const alertMs = new Date(alertAt).getTime() - now;
  const breedMs = new Date(scheduledBreedAt).getTime() - now;

  if (alertMs > 0) {
    handles.push(
      setTimeout(() => {
        fire(
          `⏰ Breed in 1 hour — ${animalDisplay}`,
          `${typeLabel} AI window opens at ${fmt(scheduledBreedAt)}`,
        );
      }, alertMs),
    );
  }

  if (breedMs > 0) {
    handles.push(
      setTimeout(() => {
        fire(
          `🐄 Time to breed! — ${animalDisplay}`,
          `${typeLabel} AI window is open now`,
        );
      }, breedMs),
    );
  }

  if (handles.length) timers.set(heatId, handles);
}

export function cancelHeatNotifications(heatId: string) {
  timers.get(heatId)?.forEach(clearTimeout);
  timers.delete(heatId);
}

function fire(title: string, body: string) {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: `heat-${title}`,
      renotify: true,
    });
  } catch {
    // Notifications blocked or unsupported
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
