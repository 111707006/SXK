import { PRODUCT } from '../productConfig';
import { T1_AGE_RANGE } from '../t1Data';
import { PROFILE_AGE_RANGE_1022, type AgeRange } from './birthDateOptions';

/**
 * 建檔與編輯檔案時生日選得到的範圍：1022 開著是 0–18 歲（issue #82），關著照舊是 T1 的適用範圍。
 * 生日下拉、建檔表單、編輯檔案三處讀同一個，不各自判斷開關。
 */
export const PROFILE_AGE_RANGE: AgeRange = PRODUCT.features.ui1022 ? PROFILE_AGE_RANGE_1022 : T1_AGE_RANGE;
