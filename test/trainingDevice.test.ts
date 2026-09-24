import { describe, it, expect } from 'vitest';
import { isWeChatBrowser, tryNativeCast } from '../src/components/training/device';

/**
 * 跟裝置有關的兩件事（Keep 規格 §3.8，票 B7）：微信內建瀏覽器認不認得出來（下載不了 .ics，要改說明），
 * 投屏先試瀏覽器自己的（`video.remote.prompt()`、Safari 的 `webkitShowPlaybackTargetPicker()`），叫不出來
 * 才開說明。實機行為（微信、AirPlay、Chromecast）這裡驗不到，只驗「叫得出／叫不出」的判斷。
 */

describe('微信內建瀏覽器', () => {
  it('iPhone、Android 的微信都認得出來', () => {
    expect(isWeChatBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.47(0x18002f2c) NetType/WIFI Language/zh_CN')).toBe(true);
    expect(isWeChatBrowser('Mozilla/5.0 (Linux; Android 13; V2172A) AppleWebKit/537.36 Chrome/111.0 XWEB/1110 MMWEBSDK/20230805 Mobile Safari/537.36 MMWEBID/1 MicroMessenger/8.0.42.2460(0x28002A58) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64')).toBe(true);
  });

  it('一般瀏覽器不是', () => {
    expect(isWeChatBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false);
    expect(isWeChatBrowser('')).toBe(false);
  });
});

describe('投屏：先試瀏覽器自己的', () => {
  it('沒有片（沒有 video）→ 叫不出來', async () => {
    expect(await tryNativeCast(null)).toBe(false);
  });

  it('有 remote.prompt()（Chrome、Safari）：叫得出來就算', async () => {
    let prompted = 0;
    const video = { remote: { prompt: async () => void (prompted += 1) } };
    expect(await tryNativeCast(video as unknown as HTMLVideoElement)).toBe(true);
    expect(prompted).toBe(1);
  });

  it('remote.prompt() 說附近沒有裝置、不支援這支片 → 叫不出來（開說明）', async () => {
    for (const name of ['NotFoundError', 'NotSupportedError', 'InvalidStateError']) {
      const video = { remote: { prompt: () => Promise.reject(new DOMException('x', name)) } };
      expect(await tryNativeCast(video as unknown as HTMLVideoElement), name).toBe(false);
    }
  });

  it('家長自己把選單關掉（NotAllowedError）→ 不再跳說明', async () => {
    const video = { remote: { prompt: () => Promise.reject(new DOMException('dismissed', 'NotAllowedError')) } };
    expect(await tryNativeCast(video as unknown as HTMLVideoElement)).toBe(true);
  });

  it('只有 Safari 的 webkitShowPlaybackTargetPicker → 叫它', async () => {
    let shown = 0;
    const video = { webkitShowPlaybackTargetPicker: () => void (shown += 1) };
    expect(await tryNativeCast(video as unknown as HTMLVideoElement)).toBe(true);
    expect(shown).toBe(1);
  });

  it('兩樣都沒有（微信的 X5、舊瀏覽器）→ 叫不出來', async () => {
    expect(await tryNativeCast({} as HTMLVideoElement)).toBe(false);
  });
});
