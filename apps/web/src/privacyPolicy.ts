// Walk We privacy policy (Thailand PDPA). Written from what the code actually
// does; when a data flow changes (new storage key, new outside service, error
// reporting switched on), update this file and the effective date.
//
// On the device (localStorage, keys ww_*): own phone number, emergency
// contacts, saved and recent places, the walk in progress, settings.
// Cache Storage: app files, route photos, map tiles for offline use.
// Leaves the device: place search text + start point rounded to ~1 km
// (Photon), start point rounded to ~1 km + time (Open-Meteo), map tile
// requests (OpenFreeMap). Error reporting is off (VITE_ERROR_TRACKING_URL empty).

export interface PolicySection {
  title: string;
  body?: string;
  items?: string[];
}
export interface Policy {
  title: string;
  updated: string;
  intro: string;
  sections: PolicySection[];
}

export const PRIVACY_POLICY: Record<'th' | 'en', Policy> = {
  th: {
    title: 'นโยบาย\u200bความเป็นส่วนตัว',
    updated: 'มีผลตั้งแต่ 15 ตุลาคม 2569',
    intro:
      'Walk We ไม่มีระบบสมัครสมาชิกและไม่มีฐานข้อมูลผู้ใช้ ข้อมูลส่วนตัวของคุณเก็บไว้ในมือถือของคุณเองเท่านั้น หน้านี้บอกตามจริงว่าแอปเก็บอะไร ส่งอะไรออกไปบ้าง และคุณจัดการข้อมูลได้ยังไง ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)',
    sections: [
      {
        title: 'ข้อมูลที่เก็บไว้ในเครื่องของคุณเท่านั้น',
        body: 'ข้อมูลเหล่านี้อยู่ในเบราว์เซอร์บนมือถือของคุณ เราไม่ได้รับ ไม่ได้เห็น และไม่ได้เก็บไว้ที่เซิร์ฟเวอร์ใด',
        items: [
          'เบอร์โทรของคุณ (ถ้าคุณกรอก) ใช้ใส่ในข้อความ SOS ให้ผู้ติดต่อโทรกลับได้',
          'ผู้ติดต่อฉุกเฉิน ชื่อและเบอร์ไม่เกิน 5 คน ใช้ตอนกด SOS',
          'สถานที่ที่บันทึก (บ้าน ที่ทำงาน) และสถานที่ที่ค้นหาล่าสุด',
          'การเดินทางที่กำลังนำทางอยู่ เพื่อให้เปิดแอปกลับมาเดินต่อได้ ไม่เก็บประวัติการเดินย้อนหลัง',
          'การตั้งค่า เช่น ภาษา ธีม ปัจจัยที่เลือกตอนกลางคืน และว่าคุณดูหน้าแนะนำไปแล้วหรือยัง',
          'ไฟล์แอป รูปนำทาง และแผนที่ ที่เก็บไว้ให้ใช้ต่อได้ตอนไม่มีเน็ต',
        ],
      },
      {
        title: 'ตำแหน่งของคุณ',
        items: [
          'แอปขอตำแหน่ง GPS เมื่อคุณกด "ใช้ตำแหน่งปัจจุบัน" หรือระหว่างนำทาง และเฉพาะเมื่อคุณอนุญาตเท่านั้น',
          'ตำแหน่งที่แม่นยำใช้คำนวณเส้นทางในเครื่องของคุณ ไม่ได้ส่งให้เรา',
          'ตำแหน่งจะออกจากเครื่องเฉพาะตอนที่คุณกด SOS หรือแชร์ตำแหน่งเอง ผ่านแอป SMS หรือ LINE ของคุณ ไปถึงคนที่คุณเลือกเท่านั้น',
        ],
      },
      {
        title: 'ข้อมูลที่ส่งไปยังบริการภายนอก',
        body: 'เพื่อให้ค้นหาสถานที่ ดูแผนที่ และคำนวณเงาได้ แอปต้องเรียกบริการเหล่านี้ ทุกบริการจะเห็น IP address ของคุณตามปกติของการใช้เว็บ แต่ไม่ได้รับชื่อ เบอร์โทร หรือผู้ติดต่อของคุณ',
        items: [
          'Photon (komoot) สำหรับค้นหาสถานที่: ได้รับคำที่คุณพิมพ์ค้นหา และจุดเริ่มต้นแบบคร่าว ๆ (ปัดเป็นประมาณ 1 กม.)',
          'Open-Meteo สำหรับข้อมูลเมฆ: ได้รับจุดเริ่มต้นแบบคร่าว ๆ (ประมาณ 1 กม.) และเวลาที่คุณจะเดิน',
          'OpenFreeMap สำหรับแผนที่: ได้รับคำขอไฟล์แผนที่ของบริเวณที่คุณกำลังดู',
          'เซิร์ฟเวอร์ที่ให้บริการเว็บนี้อาจบันทึก IP และหน้าที่เปิดไว้ชั่วคราวตามปกติของเว็บทั่วไป',
        ],
      },
      {
        title: 'สิ่งที่เราไม่ทำ',
        items: [
          'ไม่มีบัญชีผู้ใช้ ไม่ขอชื่อ อีเมล หรือบัตรประชาชน',
          'ไม่ใช้คุกกี้ติดตาม ไม่มีโฆษณา ไม่มีเครื่องมือวิเคราะห์พฤติกรรม',
          'ไม่ขายหรือแบ่งปันข้อมูลของคุณให้ใคร',
          'ไม่ได้รับข้อความ SOS ที่คุณส่ง ข้อความนั้นส่งตรงจากแอป SMS หรือ LINE ของคุณ',
        ],
      },
      {
        title: 'สิทธิ์ของคุณและการลบข้อมูล',
        body: 'เพราะข้อมูลส่วนตัวอยู่ในเครื่องคุณเท่านั้น คุณดู แก้ไข หรือลบได้เองทุกเมื่อ: แก้เบอร์และผู้ติดต่อได้ในหน้าผู้ติดต่อฉุกเฉิน ลบทุกอย่างได้ด้วยปุ่มด้านล่าง หรือล้างข้อมูลเว็บไซต์ในการตั้งค่าเบราว์เซอร์ เราไม่มีสำเนาข้อมูลของคุณให้ขอดูหรือขอลบเพิ่มเติม',
      },
      {
        title: 'การเปลี่ยนแปลงนโยบาย',
        body: 'ถ้าแอปเริ่มเก็บหรือส่งข้อมูลต่างจากนี้ เราจะแก้หน้านี้และวันที่มีผลก่อนเปลี่ยน',
      },
    ],
  },
  en: {
    title: 'Privacy policy',
    updated: 'Effective 15 October 2026',
    intro:
      'Walk We has no sign-up and no user database. Your personal data stays on your own phone. This page says plainly what the app keeps, what it sends out, and how you control it, under Thailand’s Personal Data Protection Act B.E. 2562 (PDPA).',
    sections: [
      {
        title: 'Kept on your phone only',
        body: 'This data lives in the browser on your phone. We don’t receive it, see it or store it on any server.',
        items: [
          'Your phone number (if you enter it), added to SOS messages so contacts can call you back',
          'Emergency contacts: up to 5 names and numbers, used when you press SOS',
          'Saved places (home, work) and recent searches',
          'The walk in progress, so you can reopen the app and carry on. No walk history is kept',
          'Settings such as language, theme, the night-time factors you picked, and whether you’ve seen the intro',
          'App files, step photos and map tiles saved for offline use',
        ],
      },
      {
        title: 'Your location',
        items: [
          'The app asks for GPS when you tap “Use current location” or during navigation, and only if you allow it',
          'Your exact position is used to work out routes on your phone and is not sent to us',
          'Your location leaves the phone only when you press SOS or share it yourself, through your own SMS or LINE app, to people you choose',
        ],
      },
      {
        title: 'Sent to outside services',
        body: 'To search places, show maps and work out shade, the app calls these services. Like any website they see your IP address, but they never get your name, phone number or contacts.',
        items: [
          'Photon (komoot), place search: the text you type and a rough start point (rounded to about 1 km)',
          'Open-Meteo, cloud cover: a rough start point (about 1 km) and the time you plan to walk',
          'OpenFreeMap, maps: requests for the map tiles of the area you are viewing',
          'The server hosting this site may briefly log IP addresses and pages opened, as websites normally do',
        ],
      },
      {
        title: 'What we don’t do',
        items: [
          'No accounts; we never ask for your name, email or ID',
          'No tracking cookies, no ads, no behaviour analytics',
          'We don’t sell or share your data with anyone',
          'We don’t receive your SOS messages; they go straight from your SMS or LINE app',
        ],
      },
      {
        title: 'Your rights and deleting data',
        body: 'Because your personal data is only on your phone, you can see, change or delete it at any time: edit your number and contacts on the emergency contacts page, wipe everything with the button below, or clear site data in your browser settings. We hold no copy of your data to request or delete.',
      },
      {
        title: 'Changes to this policy',
        body: 'If the app starts keeping or sending data differently, we will update this page and its effective date before the change.',
      },
    ],
  },
};
