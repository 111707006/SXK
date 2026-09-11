/**
 * 最小的 zip 讀取器 —— 只讀，不寫，不依賴任何套件。
 *
 * 為什麼自己寫：`node_modules` 裡沒有任何 zip 函式庫，而抽題腳本與紙本比對
 * 腳本都要從 `NEWT2/` 的兩個 zip 讀檔（docx 本身也是 zip）。為了兩支腳本裝
 * 一個依賴不划算；zip 的「只讀 deflate」子集用 `zlib.inflateRawSync` 六十行
 * 就寫完，而且沒有外部程式碼會碰到工具包的內容。
 *
 * 支援的範圍刻意很窄：central directory 找得到、壓縮方式是 0（stored）或
 * 8（deflate）、檔名是 UTF-8（兩個 zip 的 general purpose flag 都設了
 * bit 11）。其他情況直接丟錯，不猜。
 */

import { inflateRawSync } from 'node:zlib';

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export interface ZipEntry {
  /** zip 內的路徑，用 `/` 分隔，UTF-8 解碼。 */
  name: string;
  data: Buffer;
}

/** 把整個 zip 讀成 `路徑 → 內容`。目錄項（以 `/` 結尾）略過。 */
export function readZip(buf: Buffer): Map<string, Buffer> {
  const eocd = findEndOfCentralDirectory(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  const centralOffset = buf.readUInt32LE(eocd + 16);

  const out = new Map<string, Buffer>();
  let p = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(p) !== SIG_CENTRAL) {
      throw new Error(`zip：第 ${i} 個 central directory 項的簽章不對（offset ${p}）`);
    }
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error('zip：這是 ZIP64，本讀取器不處理');
    }
    const nameBytes = buf.subarray(p + 46, p + 46 + nameLen);
    // 沒設 UTF-8 旗標的檔名（docx 內部的 `word/document.xml` 那種）只接受純 ASCII，
    // 否則就是 CP437 或 GBK 之類我們不猜的東西。
    if (!(flags & 0x0800) && nameBytes.some(b => b >= 0x80)) {
      throw new Error('zip：檔名既不是 UTF-8（general purpose flag bit 11 未設）也不是純 ASCII，本讀取器不處理其他編碼');
    }
    const name = nameBytes.toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue;

    if (buf.readUInt32LE(localOffset) !== SIG_LOCAL) {
      throw new Error(`zip：${name} 的 local header 簽章不對（offset ${localOffset}）`);
    }
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw);
    else throw new Error(`zip：${name} 用了不支援的壓縮方式 ${method}`);

    if (data.length !== uncompressedSize) {
      throw new Error(`zip：${name} 解壓後長度 ${data.length}，central directory 說是 ${uncompressedSize}`);
    }
    out.set(name, data);
  }
  return out;
}

/**
 * EOCD 在檔尾，前面可能跟著一段長度不定的註解，所以要從尾端往前掃簽章。
 * 註解最長 65535 位元組，掃描範圍就是那麼多加上 EOCD 本身的 22 位元組。
 */
function findEndOfCentralDirectory(buf: Buffer): number {
  const floor = Math.max(0, buf.length - 22 - 0xffff);
  for (let p = buf.length - 22; p >= floor; p--) {
    if (buf.readUInt32LE(p) === SIG_EOCD) return p;
  }
  throw new Error('zip：找不到 end of central directory，這不是 zip 或檔案不完整');
}
