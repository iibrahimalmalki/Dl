// ترجمات بنود لائحة الالتزام الميداني (FRM-OPS-002) — إنجليزي + بنغالي
// English + Bengali translations of the checklist items (used by the printed report and the biker summary).

export const ITEM_EN={
  1:"Motorcycle is clean, free of visible dust or dirt",
  2:"Delivery box is clean outside and fit for use",
  15:"Box condition: paint and body intact, no repaint/replacement needed",
  3:"Box is tidy and clean inside",
  4:"Sweater sticker on the box is new, clean and correctly placed",
  5:"Front and rear lights work perfectly",
  6:"Motorcycle is intact, no major scratches or cracks",
  7:"Approved Sweater uniform is available and complete",
  8:"Uniform is clean, free of tears and dirt",
  9:"Cap + official attire + black shoes are available",
  10:"Full protective gear: vest + leg guard + arm guard + helmet",
  11:"Knows each towel's function by its color (5 colors)",
  12:"Cleaning materials bear the Sweater label — not empty or damaged",
  13:"Applies the correct wash sequence: water → soap → sponge → towel",
  14:"Puts vehicle waste in the bag — no littering around the car",
};

export const ITEM_BN={
  1:"মোটরসাইকেল পরিষ্কার, দৃশ্যমান ধুলা বা ময়লা নেই",
  2:"ডেলিভারি বক্স বাইরে থেকে পরিষ্কার ও কাজের উপযোগী",
  15:"বক্সের অবস্থা: রং ও কাঠামো ঠিক আছে (রিপেইন্ট/পরিবর্তন লাগবে না)",
  3:"বক্সের ভেতর গোছানো ও পরিষ্কার",
  4:"বক্সে Sweater স্টিকার নতুন, পরিষ্কার ও সঠিক জায়গায়",
  5:"সামনের ও পেছনের লাইট ঠিকমতো কাজ করে",
  6:"মোটরসাইকেল অক্ষত, বড় স্ক্র্যাচ বা ফাটল নেই",
  7:"Sweater অনুমোদিত ইউনিফর্ম আছে ও সম্পূর্ণ",
  8:"ইউনিফর্ম পরিষ্কার, ছেঁড়া বা ময়লা নেই",
  9:"ক্যাপ + অফিসিয়াল পোশাক + কালো জুতা আছে",
  10:"সম্পূর্ণ সুরক্ষা সরঞ্জাম: ভেস্ট + লেগ গার্ড + আর্ম গার্ড + হেলমেট",
  11:"রং অনুযায়ী প্রতিটি তোয়ালের কাজ জানে (৫ রং)",
  12:"পরিষ্কারের সামগ্রীতে Sweater লেবেল আছে — খালি বা নষ্ট নয়",
  13:"সঠিক ধোয়ার ক্রম অনুসরণ করে: পানি → সাবান → স্পঞ্জ → তোয়ালে",
  14:"গাড়ির আবর্জনা ব্যাগে রাখে — গাড়ির চারপাশে ফেলে না",
};

export const AXES_EN={motorcycle:"Motorcycle",provider:"Service Provider",materials:"Materials",washing:"Washing"};

// حالات البايكر | Biker statuses  [ar, en, bn]
export const STATUS_BIKER={
  pass:["مطابق","Compliant","ঠিক আছে"],
  half:["جزئي","Partial","আংশিক"],
  fail:["غير مطابق","Non-compliant","ঠিক নেই"],
  excused:["معفى (إمداد)","Exempt (supply)","অব্যাহতি (সরবরাহ)"],
  na:["غير مقيَّم","Not assessed","মূল্যায়ন হয়নি"],
};
// حالات الإمداد/الإدارة | Supply statuses
export const STATUS_MGMT={
  pass:["متوفّر","Available","আছে"],
  half:["بديل جزئي","Partial substitute","আংশিক বিকল্প"],
  fail:["ناقص","Missing","নেই"],
  excused:["معفى (إمداد)","Exempt (supply)","অব্যাহতি"],
  na:["غير مقيَّم","Not assessed","মূল্যায়ন হয়নি"],
};

// الحكم بالبنغالية | Verdict in Bengali
export const EFFECT_BN={
  ok:"ফলাফল ভালো — কোনো আর্থিক প্রভাব নেই।",
  warn:"আনুষ্ঠানিক সতর্কতা + ৭ দিনের উন্নতি পরিকল্পনা।",
  deduct:"নোটিশ + প্রশিক্ষণ পর্যালোচনা + মান খাতে কর্তন।",
  none:"রাউন্ড অসম্পূর্ণ।",
};
