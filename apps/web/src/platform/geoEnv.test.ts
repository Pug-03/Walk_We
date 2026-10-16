import { describe, expect, it } from 'vitest';
import { geoEnvironment } from './geoEnv.ts';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IOS_LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const ANDROID_FB = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0]';

describe('geoEnvironment', () => {
  it('detects the OS', () => {
    expect(geoEnvironment(IOS_SAFARI, true).os).toBe('ios');
    expect(geoEnvironment(ANDROID_CHROME, true).os).toBe('android');
    expect(geoEnvironment('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', true).os).toBe('desktop');
    // iPadOS reports itself as a Mac with touch.
    expect(geoEnvironment('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', true, 5, 'MacIntel').os).toBe('ios');
  });
  it('spots in-app browsers that block location', () => {
    expect(geoEnvironment(IOS_LINE, true).inApp).toBe('line');
    expect(geoEnvironment(ANDROID_FB, true).inApp).toBe('facebook');
    expect(geoEnvironment(IOS_SAFARI, true).inApp).toBeNull();
  });
  it('passes the secure-context flag through', () => {
    expect(geoEnvironment(ANDROID_CHROME, false).secure).toBe(false);
  });
});
