/**
 * 簡訊通道的實地檢驗 —— 手動執行，不進 CI。
 *
 *   npx tsx scripts/sms-smoke.ts 13800138000
 *
 * 為什麼需要這支：`src/sms.ts` 的簽名邏輯被 `test/smsSender.test.ts` 逐條釘住，
 * 但那些測試釘的是「規範化字串長什麼樣」，不是「阿里雲收不收」。兩者之間隔著
 * 一個沒有人驗過的假設。這支腳本就是去撞那個假設 —— 帶著真金鑰發一則真簡訊。
 *
 * 它刻意走 `sendVerificationCode()` 這個正式入口，而不是自己組一份請求：
 * 一份「自己組請求的測試」只能證明那份測試是對的，證明不了正式站跑的那條路。
 *
 * ⚠️ 這會發出一則真實簡訊並產生費用（一則約 ¥0.045）。
 * ⚠️ 金鑰只從環境變數讀，永遠不印出 Secret。
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { sendVerificationCode, buildAliyunSmsRequest, resolveSmsProvider } from '../src/sms';

dotenv.config();

/**
 * 阿里雲錯誤碼的對照表。
 *
 * 這張表是這支腳本真正的價值所在。阿里雲回的是 `isv.SMS_TEMPLATE_ILLEGAL`
 * 這種字串，而運維要知道的是「這是我該去控制台改，還是該叫工程師改程式」——
 * 那是兩個完全不同的人、不同的一天。分錯了就會有人往錯的方向查半天。
 */
const ERROR_GUIDE: Record<string, { meaning: string; owner: '你' | '程式'; fix: string }> = {
  SignatureDoesNotMatch: {
    meaning: '簽名對不上',
    owner: '程式',
    fix: '簽名演算法錯了，或 AccessKeySecret 貼錯（結尾多了空白或引號也算）。先確認 Secret 沒貼錯，還是不行就是 src/sms.ts 要修 —— 把這整段輸出貼給我。',
  },
  'InvalidAccessKeyId.NotFound': {
    meaning: 'AccessKey ID 不存在',
    owner: '你',
    fix: '這把金鑰在阿里雲查無此號 —— 多半是已經被刪掉了。到 RAM 建一把新的，換掉 .env 的前兩行。',
  },
  'InvalidAccessKeyId.Inactive': {
    meaning: 'AccessKey 已停用',
    owner: '你',
    fix: '金鑰存在但被停用了。去 RAM 把它啟用，或改用另一把。',
  },
  'Forbidden.RAM': {
    meaning: '金鑰有效，但沒有發簡訊的權限',
    owner: '你',
    fix: '這把金鑰所屬的 RAM 使用者少了 AliyunDysmsFullAccess。注意要授權給「金鑰的主人」，授權給別的使用者不算。',
  },
  'isv.SMS_SIGNATURE_ILLEGAL': {
    meaning: '簽名不合法或未通過審核',
    owner: '你',
    fix: 'ALI_SMS_SIGN_NAME 要跟控制台「签名管理」裡審核通過的那個中文字串**一字不差**。',
  },
  'isv.SMS_TEMPLATE_ILLEGAL': {
    meaning: '範本不合法或未通過審核',
    owner: '你',
    fix: 'ALI_SMS_TEMPLATE_CODE 打錯，或該範本還在審核中／已被駁回。去「模板管理」確認狀態是「审核通过」。',
  },
  'isv.TEMPLATE_MISSING_PARAMETERS': {
    meaning: '範本要的變數，我們沒給',
    owner: '你',
    fix: '程式送的是 {"code":"123456"}。範本裡的變數名必須恰好是 ${code} —— 寫成 ${captcha} 或 ${verifyCode} 都會落在這裡。去控制台看範本內容。',
  },
  'isv.MOBILE_NUMBER_ILLEGAL': {
    meaning: '手機號格式不合法',
    owner: '你',
    fix: '國內簡訊只收中國大陸號碼（11 碼、1 開頭）。台港澳號碼要另外開通國際簡訊。',
  },
  'isv.OUT_OF_SERVICE': {
    meaning: '業務停機',
    owner: '你',
    fix: '簡訊服務被停用，通常是欠費。去控制台看帳戶餘額。',
  },
  'isv.AMOUNT_NOT_ENOUGH': {
    meaning: '餘額不足',
    owner: '你',
    fix: '帳戶沒錢了，儲值後再試。',
  },
  'isv.BUSINESS_LIMIT_CONTROL': {
    meaning: '觸發阿里雲的流控',
    owner: '你',
    fix: '同一號碼發太密（阿里雲預設：1 分鐘 1 則、1 小時 5 則、1 天 10 則）。等一下再試，或換一支號碼。這代表簽名與範本其實都是對的。',
  },
  'isv.DAY_LIMIT_CONTROL': {
    meaning: '當日發送量達上限',
    owner: '你',
    fix: '同上，等隔天或換號碼。簽名與範本是對的。',
  },
  'InvalidTimeStamp.Expired': {
    meaning: '請求時間戳過期',
    owner: '你',
    fix: '這台機器的系統時間跟實際時間差超過 15 分鐘。校時之後再跑一次。',
  },
  SignatureNonceUsed: {
    meaning: 'Nonce 重複',
    owner: '程式',
    fix: '理論上不該發生（每次都用 randomUUID）。真的看到請貼給我。',
  },
};

function mask(v: string | undefined): string {
  if (!v) return '（未設定）';
  if (v.length <= 8) return `${v.slice(0, 2)}…（共 ${v.length} 字元）`;
  return `${v.slice(0, 8)}…（共 ${v.length} 字元）`;
}

/**
 * 設定檢查。回傳 false 代表連發都不用發 —— 先把設定補齊比較快。
 */
function checkConfig(): boolean {
  console.log('── 設定檢查 ──\n');

  let provider: string;
  try {
    provider = resolveSmsProvider();
  } catch (err: any) {
    console.log(`✗ SMS_PROVIDER 認不得：${err.message}\n`);
    return false;
  }
  console.log(`  SMS_PROVIDER              : ${provider}`);

  if (provider === 'console') {
    console.log('\n⚠ 目前是 console 模式，驗證碼只會印在終端機上，不會有任何簡訊送出。');
    console.log('  要測真實通道，請把 .env 裡的 SMS_PROVIDER 改成 aliyun（或整行刪掉，預設就是 aliyun）。\n');
    return false;
  }

  const id = process.env.ALI_SMS_ACCESS_KEY_ID;
  const secret = process.env.ALI_SMS_ACCESS_KEY_SECRET;
  const sign = process.env.ALI_SMS_SIGN_NAME;
  const tpl = process.env.ALI_SMS_TEMPLATE_CODE;

  // ID 只印前 8 碼、Secret 只印長度 —— 這份輸出是會被貼進聊天室的。
  console.log(`  ALI_SMS_ACCESS_KEY_ID     : ${mask(id)}`);
  console.log(`  ALI_SMS_ACCESS_KEY_SECRET : ${secret ? `（已設定，共 ${secret.length} 字元）` : '（未設定）'}`);
  console.log(`  ALI_SMS_SIGN_NAME         : ${sign ?? '（未設定）'}`);
  console.log(`  ALI_SMS_TEMPLATE_CODE     : ${tpl ?? '（未設定）'}`);

  const missing = [
    ['ALI_SMS_ACCESS_KEY_ID', id],
    ['ALI_SMS_ACCESS_KEY_SECRET', secret],
    ['ALI_SMS_SIGN_NAME', sign],
    ['ALI_SMS_TEMPLATE_CODE', tpl],
  ].filter(([, v]) => !v).map(([k]) => k as string);

  if (missing.length > 0) {
    console.log(`\n✗ 缺少：${missing.join(', ')}`);
    console.log('  這四項沒設齊，通道不會開 —— 正式站上家長一個都登不進來。\n');
    return false;
  }

  // 格式上一眼可見的錯，先在這裡攔掉，省一趟往返。
  const warnings: string[] = [];
  if (id && !/^LTAI[A-Za-z0-9]+$/.test(id)) warnings.push('AccessKey ID 通常是 LTAI 開頭，這個不像 —— 檢查有沒有貼到別的東西。');
  if (secret && secret.length !== 30) warnings.push(`AccessKey Secret 通常恰好 30 字元，這個是 ${secret.length} —— 前後可能多了空白或引號。`);
  if (tpl && !/^SMS_\d+$/.test(tpl)) warnings.push('範本 CODE 的長相通常是 SMS_ 加一串數字，這個不像。');
  for (const w of warnings) console.log(`\n⚠ ${w}`);

  console.log();
  return true;
}

/**
 * 失敗時再打一次原始請求，把完整回應撈出來。
 *
 * 只在失敗時做：`sendVerificationCode` 為了不讓驗證碼流進日誌，回報的訊息是
 * 截斷過的，而失敗當下最需要的 RequestId 剛好在被截掉的那一段裡。
 * 失敗的請求不會送出簡訊，所以這一趟不產生費用、也不會重複發送。
 */
async function diagnose(phone: string, code: string): Promise<void> {
  const { url, form } = buildAliyunSmsRequest({
    phone,
    code,
    accessKeyId: process.env.ALI_SMS_ACCESS_KEY_ID as string,
    accessKeySecret: process.env.ALI_SMS_ACCESS_KEY_SECRET as string,
    signName: process.env.ALI_SMS_SIGN_NAME as string,
    templateCode: process.env.ALI_SMS_TEMPLATE_CODE as string,
  });

  let body: any;
  try {
    const resp = await axios.post(url, form.toString(), {
      timeout: 8000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: () => true,
    });
    body = resp.data;
  } catch (err: any) {
    console.log(`  連線層就失敗了：${err.message}`);
    console.log('  這通常不是簽名問題，是網路 —— 防火牆、DNS、或這台機器出不了外網。\n');
    return;
  }

  const apiCode = String(body?.Code ?? '(無)');
  console.log('── 阿里雲的原始回應 ──\n');
  console.log(`  Code      : ${apiCode}`);
  console.log(`  Message   : ${body?.Message ?? '(無)'}`);
  console.log(`  RequestId : ${body?.RequestId ?? '(無)'}`);
  console.log();

  const guide = ERROR_GUIDE[apiCode];
  if (guide) {
    console.log('── 這是什麼意思 ──\n');
    console.log(`  ${guide.meaning}`);
    console.log(`  該動手的人：${guide.owner}`);
    console.log(`  怎麼修：${guide.fix}\n`);
  } else {
    console.log('── 這個錯誤碼不在對照表裡 ──\n');
    console.log('  把上面整段（含 RequestId）貼給我，或到阿里雲文件查這個 Code。\n');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // 只看設定、不發簡訊。設定打錯的機率遠高於簽名寫錯，先用不花錢的那一半篩掉。
  const checkOnly = args.includes('--check');
  const phone = args.find(a => !a.startsWith('--'));

  console.log('\n════ 阿里雲簡訊通道實地檢驗 ════\n');

  if (checkOnly) {
    const ok = checkConfig();
    console.log(ok
      ? '設定看起來完整。要真的發一則：npx tsx scripts/sms-smoke.ts <手機號>\n'
      : '設定不完整。補齊之後再跑一次。\n');
    process.exit(ok ? 0 : 1);
  }

  if (!phone) {
    console.log('用法：\n');
    console.log('  npx tsx scripts/sms-smoke.ts --check        只檢查設定，不發簡訊、不花錢');
    console.log('  npx tsx scripts/sms-smoke.ts 13800138000    發一則真實簡訊到這支號碼\n');
    console.log('⚠ 第二種會產生費用（一則約 ¥0.045）。請填你自己收得到的號碼。\n');
    process.exit(2);
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    console.log(`⚠ ${phone} 不像中國大陸手機號（11 碼、1 開頭）。`);
    console.log('  國內簡訊只發得到大陸號碼；照樣往下試，但很可能收到 isv.MOBILE_NUMBER_ILLEGAL。\n');
  }

  if (!checkConfig()) {
    console.log('設定不完整，沒有發出任何簡訊。\n');
    process.exit(1);
  }

  // 六位數字，跟正式流程送的是同一種東西（見 server.ts 的 generateSmsCode）。
  const code = String(Math.floor(100000 + Math.random() * 900000));

  console.log('── 發送 ──\n');
  console.log(`  收件號碼 : ${phone}`);
  console.log(`  驗證碼   : ${code}  ← 等下比對簡訊內容，數字要一樣`);
  console.log('\n  呼叫 sendVerificationCode()（正式站用的就是這個函式）…\n');

  const result = await sendVerificationCode(phone, code);

  if (result.ok) {
    console.log('════ 成功 ════\n');
    console.log(`  ${result.detail}\n`);
    console.log('  阿里雲收下了。接著請看手機：\n');
    console.log(`    1. 簡訊有沒有到（一般幾秒內；超過兩分鐘沒到就是通道有問題）`);
    console.log(`    2. 內容裡的數字是不是 ${code}`);
    console.log(`    3. 開頭的簽名是不是【${process.env.ALI_SMS_SIGN_NAME}】\n`);
    console.log('  ⚠ 如果簡訊到了、但數字的位置是空的或印著 ${code} 字樣，');
    console.log('    代表範本的變數名不叫 code —— 那要去控制台改範本。\n');
    console.log('  三項都對 → 簡訊通道確定可用，手機號登入可以上線了。\n');
    return;
  }

  console.log('════ 失敗 ════\n');
  console.log(`  供應商 : ${result.provider}`);
  console.log(`  原因   : ${result.reason}`);
  console.log(`  細節   : ${result.detail}\n`);

  if (result.reason === 'send_failed') {
    await diagnose(phone, code);
  }

  console.log('沒有簡訊送出，也沒有產生費用。\n');
  process.exit(1);
}

main().catch(err => {
  // 這裡會接到的是預期外的例外 —— `sendVerificationCode` 自己承諾永不拋出。
  console.error('\n腳本本身出錯了（不是簡訊通道的問題）：', err);
  process.exit(1);
});
