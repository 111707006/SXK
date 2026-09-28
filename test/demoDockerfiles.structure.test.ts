import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Render 的兩個展示站（`sxk-demo`＝A、`sxk-demo-b`＝B，deploy/render-demo.md）。
 *
 * B 的 Dockerfile 是 A 那一份複製來改 ENV 的 —— 不用 build arg 切換，寫錯一個字 B 會安安靜靜建成一份 A。
 * 代價是兩份要一起改，這裡擋住它們分岔：除了開頭的註解與 ENV 那一段，一行都不能不同。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

/** 拿掉開頭那一段註解與 ENV 區塊，剩下的就是兩份共用的步驟。 */
function steps(dockerfile: string): string {
  const body = dockerfile.slice(dockerfile.search(/^ARG /m));
  return body.replace(/^ENV [\s\S]*?\n\n/m, 'ENV …\n\n');
}

function envBlock(dockerfile: string): string {
  return dockerfile.match(/^ENV [\s\S]*?\n\n/m)![0];
}

const a = read('deploy/demo/Dockerfile');
const b = read('deploy/demo/Dockerfile.b');
const blueprint = read('render.yaml');

describe('兩個展示站的 Dockerfile', () => {
  it('除了開頭的註解與 ENV，步驟一行不差', () => {
    expect(steps(b)).toBe(steps(a));
  });

  it('A 建 full、B 建 t1only（執行期與建置期兩個開關都要對）', () => {
    expect(envBlock(a)).toMatch(/APP_MODE=full \\\n\s+VITE_APP_MODE=full \\/);
    expect(envBlock(b)).toMatch(/APP_MODE=t1only \\\n\s+VITE_APP_MODE=t1only \\/);
  });

  it('B 的簡訊只印在日誌（展示站沒有簡訊通道）；兩邊的展示家長不是同一支手機', () => {
    expect(envBlock(b)).toContain('SMS_PROVIDER=console');
    const phone = (env: string) => env.match(/DEMO_PARENT_PHONE=(\d+)/)![1];
    expect(phone(envBlock(a))).not.toBe(phone(envBlock(b)));
  });
});

describe('render.yaml 的交接設定', () => {
  const service = (name: string) => {
    const start = blueprint.indexOf(`name: ${name}\n`);
    expect(start).toBeGreaterThan(-1);
    const next = blueprint.indexOf('\n  - type:', start);
    const end = next === -1 ? blueprint.indexOf('\nenvVarGroups:', start) : next;
    return blueprint.slice(start, end);
  };

  it('A 向 B 兌換、B 的連結指去 A；密鑰兩邊讀同一個群組', () => {
    expect(service('sxk-demo')).toContain('dockerfilePath: ./deploy/demo/Dockerfile\n');
    expect(service('sxk-demo')).toMatch(/key: HANDOFF_SOURCE_ORIGIN\n\s+value: https:\/\/sxk-demo-b\.onrender\.com/);
    expect(service('sxk-demo-b')).toContain('dockerfilePath: ./deploy/demo/Dockerfile.b\n');
    expect(service('sxk-demo-b')).toMatch(/key: HANDOFF_TARGET_ORIGIN\n\s+value: https:\/\/sxk-demo\.onrender\.com/);
    for (const name of ['sxk-demo', 'sxk-demo-b']) expect(service(name)).toContain('- fromGroup: sxk-demo-handoff');
    expect(blueprint).toMatch(/envVarGroups:\n\s+- name: sxk-demo-handoff\n\s+envVars:\n\s+- key: HANDOFF_SECRET\n\s+generateValue: true/);
  });

  it('密鑰不寫死在 Blueprint 或 Dockerfile 裡', () => {
    expect(blueprint).not.toMatch(/HANDOFF_SECRET\n\s+value:/);
    expect(a + b).not.toMatch(/HANDOFF_SECRET=/);
  });
});
