import { Platform } from 'react-native';
import { SmsMessage } from './types';

type SmsAndroidModule = {
  list: (
    filters: { box: 'inbox'; maxCount: number },
    fail: (error: string) => void,
    success: (count: number, smsList: string) => void
  ) => void;
};

export const readInboxMessages = async (maxCount = 40): Promise<SmsMessage[]> => {
  if (Platform.OS !== 'android') {
    throw new Error('Device inbox reading is supported only on Android.');
  }

  let smsAndroid: SmsAndroidModule | null = null;
  try {
    const imported = require('react-native-get-sms-android') as
      | SmsAndroidModule
      | { default?: SmsAndroidModule | null }
      | null;
    if (imported && typeof (imported as SmsAndroidModule).list === 'function') {
      smsAndroid = imported as SmsAndroidModule;
    } else if (
      imported &&
      (imported as { default?: SmsAndroidModule | null }).default &&
      typeof (imported as { default?: SmsAndroidModule | null }).default?.list === 'function'
    ) {
      smsAndroid = (imported as { default?: SmsAndroidModule | null }).default ?? null;
    } else {
      smsAndroid = null;
    }
  } catch (_error) {
    throw new Error(
      'SMS module not available in this build. Use an Android development build for inbox reading.'
    );
  }

  if (!smsAndroid || typeof smsAndroid.list !== 'function') {
    throw new Error(
      'SMS reader is unavailable in this runtime (likely Expo Go). Use an Android development build and grant SMS permission.'
    );
  }

  return new Promise((resolve, reject) => {
    smsAndroid.list(
      { box: 'inbox', maxCount },
      (error) => reject(new Error(error)),
      (_count, smsList) => {
        try {
          const parsed = JSON.parse(smsList) as SmsMessage[];
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};
