import { supabase, isSupabaseConfigured } from './supabase';

const SW_PATH = '/sw.js';

export function isReminderSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerReminderServiceWorker(): Promise<void> {
  if (!isReminderSupported()) return;
  await navigator.serviceWorker.register(SW_PATH);
}

function toUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output;
}

function getSubscriptionKeys(subscription: PushSubscription): {
  p256dh: string;
  auth: string;
} {
  const p256dhRaw = subscription.getKey('p256dh');
  const authRaw = subscription.getKey('auth');
  if (!p256dhRaw || !authRaw) {
    throw new Error('Missing push subscription keys.');
  }

  const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhRaw)));
  const auth = btoa(String.fromCharCode(...new Uint8Array(authRaw)));
  return { p256dh, auth };
}

export async function getReminderStatus(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean((count ?? 0) > 0);
}

export async function enableReminders(userId: string): Promise<void> {
  if (!isReminderSupported()) {
    throw new Error('This browser does not support push notifications.');
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('Missing VITE_VAPID_PUBLIC_KEY in environment.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();

  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8Array(vapidPublicKey) as unknown as BufferSource,
    }));

  const keys = getSubscriptionKeys(subscription);

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh_key: keys.p256dh,
      auth_key: keys.auth,
      user_agent: navigator.userAgent,
      is_active: true,
      updated_at: new Date().toISOString(),
      last_tested_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function disableReminders(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await subscription.unsubscribe();
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function sendTestReminder(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.functions.invoke('send-reminders', {
    body: {
      force: true,
      userId,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}
