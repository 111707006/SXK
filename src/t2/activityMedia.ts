/**
 * 示範片與封面（Keep 規格 K05、§6）：17 支，每支一個站內網址、一張封面、片長與 sha256。
 *
 * 由 `scripts/t2-prepare-media.ts` 從下面這個 zip 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且遷移裡的 UPDATE 是從這一份印的（`test/activityMedia.test.ts` 重印比對）。
 *   NEWT2/T2视频_20260923.zip（sha256 a32341e20e23…）
 *
 * 沒上的（規則見 `scripts/t2/activityMedia.ts`）：
 *   T2视频/007.mp4：與 006.mp4 位元組相同（sha256 d53bc85ae3c5…），不上
 *   T2视频/008-不太好.mp4：檔名在編號後面多了「-不太好」（客戶的註記），不上
 *
 * 片子本身**不進 git**：同一支腳本把它們寫到 `media/activities/`（gitignored），部署時另外傳到
 * 正式站主機的 `/var/www/sxk/media/activities/`，由 `server.ts` 的 `/media` 服務（規格 §6.2 甲，
 * 使用者 2026-09-24 定）。日後搬到物件儲存，改的是資料庫裡的網址，不是這一份。
 *
 * 家長端與後台讀的是資料庫，不是這一檔：資料庫那一份由同一支腳本印進遷移
 * `deploy/migrations/2026-09-24-activity-media.sql` 的 UPDATE。
 */

export interface ActivityMedia {
  /** 'A001'。 */
  id: string;
  /** 站內網址 `/media/activities/A001.mp4`。 */
  videoUrl: string;
  /** 封面 `/media/activities/A001.jpg`（960×540）。 */
  posterUrl: string;
  /** 片長（秒）：ffprobe 讀到的四捨五入。 */
  videoSeconds: number;
  /** 片子的 sha256。原封不動上架，所以也是客戶 zip 裡那一支的 sha256。 */
  sha256: string;
}

export const ACTIVITY_MEDIA: ReadonlyArray<ActivityMedia> = [
  {
    "id": "A001",
    "videoUrl": "/media/activities/A001.mp4",
    "posterUrl": "/media/activities/A001.jpg",
    "videoSeconds": 10,
    "sha256": "2ef9c3a2cbb4be5b04dce72ed7d4c7ede5bea5fb9277fda82c2e82798f7ede23"
  },
  {
    "id": "A002",
    "videoUrl": "/media/activities/A002.mp4",
    "posterUrl": "/media/activities/A002.jpg",
    "videoSeconds": 10,
    "sha256": "8bcf0e47ab4a27aba6c5e061ab417aadc66bee090fd5d743651ff3bb813150f0"
  },
  {
    "id": "A003",
    "videoUrl": "/media/activities/A003.mp4",
    "posterUrl": "/media/activities/A003.jpg",
    "videoSeconds": 10,
    "sha256": "7daa90696e20a40554cfe07e9380402d779e23317fb6765fc74d282146a5a539"
  },
  {
    "id": "A004",
    "videoUrl": "/media/activities/A004.mp4",
    "posterUrl": "/media/activities/A004.jpg",
    "videoSeconds": 10,
    "sha256": "609e53b913816e424ad87b2eccc6330a53c239272b3e2066d22559910e535473"
  },
  {
    "id": "A005",
    "videoUrl": "/media/activities/A005.mp4",
    "posterUrl": "/media/activities/A005.jpg",
    "videoSeconds": 10,
    "sha256": "6cf772e0d1f78d33f56760631aa7deec85ebceae6ff0f044d8567863f1b44219"
  },
  {
    "id": "A006",
    "videoUrl": "/media/activities/A006.mp4",
    "posterUrl": "/media/activities/A006.jpg",
    "videoSeconds": 10,
    "sha256": "d53bc85ae3c5bf5bb4cd61e7331b24994b88c7f4debbccc573cca4bb8ef83565"
  },
  {
    "id": "A009",
    "videoUrl": "/media/activities/A009.mp4",
    "posterUrl": "/media/activities/A009.jpg",
    "videoSeconds": 10,
    "sha256": "c6008db07459c88e4526b369c2556057d5266a5b997ecfe8af6f8d2c5c1260a8"
  },
  {
    "id": "A010",
    "videoUrl": "/media/activities/A010.mp4",
    "posterUrl": "/media/activities/A010.jpg",
    "videoSeconds": 5,
    "sha256": "1930e1663fd03cdd3522fa80e30bfa3dada7004aa54a2bdeb46cea0ad8021bb7"
  },
  {
    "id": "A011",
    "videoUrl": "/media/activities/A011.mp4",
    "posterUrl": "/media/activities/A011.jpg",
    "videoSeconds": 10,
    "sha256": "3234ef7913a2d493b24c2211e6478be41698cb010abc0d58d5d1b875ec118054"
  },
  {
    "id": "A012",
    "videoUrl": "/media/activities/A012.mp4",
    "posterUrl": "/media/activities/A012.jpg",
    "videoSeconds": 10,
    "sha256": "c8d89c594f985425ec864a59f4456908230320c6232770a5a840730c8a0c6e76"
  },
  {
    "id": "A013",
    "videoUrl": "/media/activities/A013.mp4",
    "posterUrl": "/media/activities/A013.jpg",
    "videoSeconds": 10,
    "sha256": "891886d89051185d10df4579d2ab1edad6edf51c8e4f402a079597e57fa8745f"
  },
  {
    "id": "A014",
    "videoUrl": "/media/activities/A014.mp4",
    "posterUrl": "/media/activities/A014.jpg",
    "videoSeconds": 10,
    "sha256": "c23bbb0adbeea20e154a6314a37d00348280901ca58dd873c0c3125d10b38d38"
  },
  {
    "id": "A015",
    "videoUrl": "/media/activities/A015.mp4",
    "posterUrl": "/media/activities/A015.jpg",
    "videoSeconds": 10,
    "sha256": "5d3deae5afefe45bb0462ba6c4349ab380ddc2687a6f34d6fd9652268a08fdb4"
  },
  {
    "id": "A016",
    "videoUrl": "/media/activities/A016.mp4",
    "posterUrl": "/media/activities/A016.jpg",
    "videoSeconds": 10,
    "sha256": "ac9ecef28901975561ef64394a3e237e5553b13f6d6ddc2bf7aa0b4699de20f2"
  },
  {
    "id": "A017",
    "videoUrl": "/media/activities/A017.mp4",
    "posterUrl": "/media/activities/A017.jpg",
    "videoSeconds": 10,
    "sha256": "8935325a7404a3e4bc0a1007d5df4f76aa8dd74a2dc7f07437ad68eea1454faa"
  },
  {
    "id": "A018",
    "videoUrl": "/media/activities/A018.mp4",
    "posterUrl": "/media/activities/A018.jpg",
    "videoSeconds": 10,
    "sha256": "2eed1f6081805f466d247483cc677e87be44624464bd3e555d1c8da0ea746232"
  },
  {
    "id": "A019",
    "videoUrl": "/media/activities/A019.mp4",
    "posterUrl": "/media/activities/A019.jpg",
    "videoSeconds": 10,
    "sha256": "35781838499e4747d546d9684df75db05f6ce95c3944e5e25a24bd885efbc56d"
  }
];
