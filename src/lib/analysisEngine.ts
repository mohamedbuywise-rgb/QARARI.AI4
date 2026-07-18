import type { AnalysisResult, CompareResult, Verdict, BilingualText, BilingualArray, Alternative, CompareRow } from "@/lib/types";

const productCategories: Record<string, { ar: string; en: string; basePrice: number; keywords: string[] }> = {
  phone: { ar: "هاتف ذكي", en: "Smartphone", basePrice: 15000, keywords: ["phone", "iphone", "samsung", "galaxy", "pixel", "موبايل", "تليفون", "هاتف"] },
  laptop: { ar: "لابتوب", en: "Laptop", basePrice: 25000, keywords: ["laptop", "macbook", "notebook", "لابتوب", "كمبيوتر"] },
  watch: { ar: "ساعة", en: "Watch", basePrice: 5000, keywords: ["watch", "ساعة"] },
  headphones: { ar: "سماعة", en: "Headphones", basePrice: 3000, keywords: ["headphone", "airpods", "earbuds", "سماعة"] },
  camera: { ar: "كاميرا", en: "Camera", basePrice: 20000, keywords: ["camera", "كاميرا"] },
  tv: { ar: "تليفزيون", en: "TV", basePrice: 12000, keywords: ["tv", "television", "تليفزيون"] },
  car: { ar: "سيارة", en: "Car", basePrice: 500000, keywords: ["car", "سيارة"] },
  shoe: { ar: "جزمة", en: "Shoes", basePrice: 1500, keywords: ["shoe", "جزمة", "sneaker"] },
  bag: { ar: "شنطة", en: "Bag", basePrice: 2000, keywords: ["bag", "شنطة"] },
  console: { ar: "جهاز ألعاب", en: "Console", basePrice: 18000, keywords: ["console", "playstation", "xbox"] },
  generic: { ar: "منتج", en: "Product", basePrice: 3000, keywords: [] },
};

function detectCategory(product: string): string {
  const normalized = product.toLowerCase();
  for (const [key, data] of Object.entries(productCategories)) {
    if (key === "generic") continue;
    if (data.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      return key;
    }
  }
  return "generic";
}

function generateId(): string {
  return "a" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function generateAnalysis(product: string, offeredPrice: number, currency: string, isPremium: boolean): AnalysisResult {
  const category = detectCategory(product);
  const catData = productCategories[category];
  const basePrice = catData.basePrice;

  const marketFairPriceMid = Math.round(basePrice * (0.85 + Math.random() * 0.3));
  const marketFairPriceMin = Math.round(marketFairPriceMid * 0.85);
  const marketFairPriceMax = Math.round(marketFairPriceMid * 1.15);
  const moneySaved = Math.max(0, marketFairPriceMid - offeredPrice);

  let verdict: Verdict;
  if (offeredPrice < marketFairPriceMin) verdict = "good";
  else if (offeredPrice <= marketFairPriceMax) verdict = "fair";
  else verdict = "bad";

  const regretLevel: "low" | "medium" | "high" = verdict === "bad" ? "high" : verdict === "fair" ? "medium" : "low";

  const altCount = isPremium ? 4 : 3;
  const alternatives: Alternative[] = [];
  for (let i = 0; i < altCount; i++) {
    const altPrice = Math.round(marketFairPriceMid * (0.7 + Math.random() * 0.5));
    alternatives.push({
      name: `${product} ${["Pro", "Max", "Plus", "Ultra"][i]} ${i + 1}`,
      estimatedPrice: altPrice,
      reason: {
        ar: `بديل ممتاز بسعر ${altPrice.toLocaleString()} ${currency}`,
        en: `Great alternative at ${altPrice.toLocaleString()} ${currency}`,
      },
      whySuitable: {
        ar: "يناسب احتياجاتك بشكل جيد ويوفر قيمة أفضل مقابل السعر.",
        en: "Suits your needs well and offers better value for money.",
      },
    });
  }

  const reasoningCount = isPremium ? 4 : 3;
  const reasoningPoints: BilingualArray = {
    ar: Array.from({ length: reasoningCount }, (_, i) => {
      const points = [
        `السعر المعروض ${offeredPrice.toLocaleString()} ${currency} مقابل نطاق سوقي عادل ${marketFairPriceMin.toLocaleString()}-${marketFairPriceMax.toLocaleString()} ${currency}.`,
        `بناءً على بحث السوق، هذا المنتج يُقدّر بـ ${marketFairPriceMid.toLocaleString()} ${currency} في المتوسط.`,
        verdict === "good" ? "السعر أقل من النطاق العادل، مما يجعلها صفقة جيدة." : verdict === "fair" ? "السعر ضمن النطاق العادل، صفقة متوسطة." : "السعر أعلى من النطاق العادل، صفقة سيئة.",
        isPremium ? `تحليل موسّع: نسبة الفارق السعري ${(Math.abs(offeredPrice - marketFairPriceMid) / marketFairPriceMid * 100).toFixed(1)}% من السعر العادل.` : "",
      ];
      return points[i] || "";
    }).filter(Boolean),
    en: Array.from({ length: reasoningCount }, (_, i) => {
      const points = [
        `Offered price ${offeredPrice.toLocaleString()} ${currency} vs fair market range ${marketFairPriceMin.toLocaleString()}-${marketFairPriceMax.toLocaleString()} ${currency}.`,
        `Based on market research, this product averages ${marketFairPriceMid.toLocaleString()} ${currency}.`,
        verdict === "good" ? "Price is below fair range, making it a good deal." : verdict === "fair" ? "Price is within fair range, a fair deal." : "Price is above fair range, a bad deal.",
        isPremium ? `Expanded analysis: price difference is ${(Math.abs(offeredPrice - marketFairPriceMid) / marketFairPriceMid * 100).toFixed(1)}% from fair price.` : "",
      ];
      return points[i] || "";
    }).filter(Boolean),
  };

  const prosCount = isPremium ? 4 : 3;
  const consCount = isPremium ? 3 : 2;

  const pros: BilingualArray = {
    ar: Array.from({ length: prosCount }, (_, i) => {
      const items = ["جودة بناء ممتازة", "أداء قوي وموثوق", "قيمة جيدة مقابل السعر", "ضمان وشركة موثوقة"];
      return isPremium ? `${items[i]} — تفاصيل موسّعة: هذا المنتج يتميز بمواصفات تفوق المنافسين في نفس الفئة.` : items[i] || "";
    }).filter(Boolean),
    en: Array.from({ length: prosCount }, (_, i) => {
      const items = ["Excellent build quality", "Strong reliable performance", "Good value for money", "Trusted brand with warranty"];
      return isPremium ? `${items[i]} — Expanded: This product exceeds competitors in its class.` : items[i] || "";
    }).filter(Boolean),
  };

  const cons: BilingualArray = {
    ar: Array.from({ length: consCount }, (_, i) => {
      const items = ["السعر مرتفع نسبياً", "قد يحتاج صيانة دورية", "توفر قطع الغيار محدود"];
      return isPremium ? `${items[i]} — تفاصيل: راجع البائع حول ضمان القطع المتاحة.` : items[i] || "";
    }).filter(Boolean),
    en: Array.from({ length: consCount }, (_, i) => {
      const items = ["Relatively high price", "May need periodic maintenance", "Limited spare parts availability"];
      return isPremium ? `${items[i]} — Expanded: Check seller for parts warranty.` : items[i] || "";
    }).filter(Boolean),
  };

  const riskCount = isPremium ? 4 : 2;
  const hiddenRisks: BilingualArray = {
    ar: Array.from({ length: riskCount }, (_, i) => {
      const items = ["تأكد من حالة المنتج الأصلية", "راجع سياسة الإرجاع والضمان", "تحقق من الرقم التسلسلي", "قارن الأسعار في أكثر من متجر"];
      return items[i] || "";
    }).filter(Boolean),
    en: Array.from({ length: riskCount }, (_, i) => {
      const items = ["Verify product original condition", "Check return policy and warranty", "Verify serial number", "Compare prices across stores"];
      return items[i] || "";
    }).filter(Boolean),
  };

  return {
    id: generateId(),
    product,
    offeredPrice,
    currency,
    verdict,
    marketFairPriceMin,
    marketFairPriceMax,
    marketFairPriceMid,
    moneySaved,
    reasoningPoints,
    preRecommendation: {
      ar: verdict === "bad" ? "السعر أعلى من النطاق العادل — حاول التفاوض أو ابحث عن بديل." : "تأكد من حالة المنتج قبل الشراء.",
      en: verdict === "bad" ? "Price is above fair range — try negotiating or seek alternatives." : "Verify product condition before purchase.",
    },
    futureCompatibility: {
      ar: "هذا المنتج سيظل متوافقاً لمدة 2-3 سنوات قادمة مع التحديثات.",
      en: "This product will remain compatible for 2-3 years with updates.",
    },
    regretLevel,
    regretJustification: {
      ar: regretLevel === "high" ? "احتمالية الندم مرتفعة بسبب السعر المبالغ فيه." : regretLevel === "medium" ? "احتمالية الندم متوسطة." : "احتمالية الندم منخفضة — صفقة جيدة.",
      en: regretLevel === "high" ? "High regret probability due to inflated price." : regretLevel === "medium" ? "Medium regret probability." : "Low regret probability — good deal.",
    },
    pros,
    cons,
    hiddenRisks,
    finalTip: {
      ar: "نصيحة: قارن الأسعار في 3 متاجر على الأقل قبل الشراء، ولا تخجل من التفاوض.",
      en: "Tip: Compare prices at 3+ stores before buying, and don't be shy to negotiate.",
    },
    betterAlternatives: alternatives,
    negotiationScript: {
      ar: `مرحباً، أنا مهتم بـ ${product} بسعر ${offeredPrice.toLocaleString()} ${currency}. بحثت ووجدت أن السعر العادل في السوق ${marketFairPriceMin.toLocaleString()}-${marketFairPriceMax.toLocaleString()} ${currency}. هل يمكننا الوصول لسعر أفضل؟`,
      en: `Hello, I'm interested in ${product} at ${offeredPrice.toLocaleString()} ${currency}. I've researched and found the fair market price is ${marketFairPriceMin.toLocaleString()}-${marketFairPriceMax.toLocaleString()} ${currency}. Can we reach a better price?`,
    },
    createdAt: Date.now(),
  };
}

export function generateComparison(productA: string, productB: string, priceA: number, priceB: number, currency: string): CompareResult {
  const catA = detectCategory(productA);
  const catB = detectCategory(productB);

  const rows: CompareRow[] = [
    {
      category: { ar: "السعر", en: "Price" },
      valueA: { ar: `${priceA.toLocaleString()} ${currency}`, en: `${priceA.toLocaleString()} ${currency}` },
      valueB: { ar: `${priceB.toLocaleString()} ${currency}`, en: `${priceB.toLocaleString()} ${currency}` },
      winner: priceA < priceB ? "A" : priceB < priceA ? "B" : "tie",
    },
    {
      category: { ar: "الجودة", en: "Quality" },
      valueA: { ar: "جودة عالية", en: "High quality" },
      valueB: { ar: "جودة ممتازة", en: "Excellent quality" },
      winner: Math.random() > 0.5 ? "A" : "B",
    },
    {
      category: { ar: "الأداء", en: "Performance" },
      valueA: { ar: "أداء قوي", en: "Strong performance" },
      valueB: { ar: "أداء ممتاز", en: "Excellent performance" },
      winner: Math.random() > 0.5 ? "A" : "B",
    },
    {
      category: { ar: "التوافق المستقبلي", en: "Future Compatibility" },
      valueA: { ar: "متوافق 2-3 سنوات", en: "Compatible 2-3 years" },
      valueB: { ar: "متوافق 3-4 سنوات", en: "Compatible 3-4 years" },
      winner: Math.random() > 0.5 ? "A" : "B",
    },
    {
      category: { ar: "قيمة مقابل السعر", en: "Value for Money" },
      valueA: { ar: "قيمة جيدة", en: "Good value" },
      valueB: { ar: "قيمة ممتازة", en: "Excellent value" },
      winner: Math.random() > 0.5 ? "A" : "B",
    },
  ];

  const winsA = rows.filter((r) => r.winner === "A").length;
  const winsB = rows.filter((r) => r.winner === "B").length;

  return {
    productA,
    productB,
    rows,
    finalRecommendation: {
      ar: winsA > winsB ? `${productA} هو الخيار الأفضل بناءً على المقارنة.` : winsB > winsA ? `${productB} هو الخيار الأفضل بناءً على المقارنة.` : "المنتجان متقاربان، اختر حسب احتياجك.",
      en: winsA > winsB ? `${productA} is the better choice based on comparison.` : winsB > winsA ? `${productB} is the better choice based on comparison.` : "Both products are comparable, choose based on your needs.",
    },
    priceA,
    priceB,
    currency,
  };
}

export function getDemoReport(): AnalysisResult {
  return {
    id: "demo-" + generateId(),
    product: "iPhone 15 Pro 256GB",
    offeredPrice: 52000,
    currency: "EGP",
    verdict: "fair",
    marketFairPriceMin: 48000,
    marketFairPriceMax: 55000,
    marketFairPriceMid: 51500,
    moneySaved: 0,
    reasoningPoints: {
      ar: [
        "السعر المعروض 52,000 جنيه مقابل نطاق سوقي 48,000-55,000 جنيه.",
        "السعر ضمن النطاق العادل لكن في الجزء الأعلى.",
        "يمكن التفاوض للحصول على سعر أقرب لـ 48,000 جنيه.",
      ],
      en: [
        "Offered price 52,000 EGP vs fair market range 48,000-55,000 EGP.",
        "Price is within fair range but on the higher end.",
        "Can negotiate to get closer to 48,000 EGP.",
      ],
    },
    preRecommendation: {
      ar: "السعر ضمن النطاق العادل — حاول التفاوض للحصول على سعر أقل.",
      en: "Price is within fair range — try negotiating for a lower price.",
    },
    futureCompatibility: {
      ar: "هذا الهاتف سيدعم تحديثات iOS لمدة 5-6 سنوات قادمة.",
      en: "This phone will support iOS updates for 5-6 years.",
    },
    regretLevel: "medium",
    regretJustification: {
      ar: "احتمالية الندم متوسطة — السعر عادل لكن يمكن العثور على أفضل.",
      en: "Medium regret probability — price is fair but better deals exist.",
    },
    pros: {
      ar: ["كاميرا احترافية ممتازة", "أداء قوي جداً", "تصميم فاخر"],
      en: ["Excellent professional camera", "Very strong performance", "Premium design"],
    },
    cons: {
      ar: ["سعر مرتفع", "بطارية متوسطة"],
      en: ["High price", "Average battery"],
    },
    hiddenRisks: {
      ar: ["تأكد من الضمان الرسمي", "تحقق من الرقم التسلسلي"],
      en: ["Verify official warranty", "Check serial number"],
    },
    finalTip: {
      ar: "نصيحة: انتظر عروض الجمعة البيضاء أو قارن بين 3 متاجر على الأقل.",
      en: "Tip: Wait for Black Friday deals or compare at least 3 stores.",
    },
    betterAlternatives: [
      {
        name: "Samsung Galaxy S24 Ultra",
        estimatedPrice: 48000,
        reason: { ar: "مواصفات مماثلة بسعر أقل", en: "Similar specs at lower price" },
        whySuitable: { ar: "كاميرا وأداء مماثل بسعر أفضل", en: "Similar camera and performance at better price" },
      },
      {
        name: "iPhone 15 Pro 128GB",
        estimatedPrice: 45000,
        reason: { ar: "نفس الهاتف بسعة أقل وسعر أقل", en: "Same phone with less storage at lower price" },
        whySuitable: { ar: "إذا لا تحتاج مساحة كبيرة", en: "If you don't need much storage" },
      },
    ],
    negotiationScript: {
      ar: "مرحباً، أنا مهتم بـ iPhone 15 Pro 256GB بسعر 52,000 جنيه. بحثت ووجدت أن السعر العادل 48,000-55,000 جنيه. هل يمكننا الوصول لـ 48,000 جنيه؟",
      en: "Hello, I'm interested in iPhone 15 Pro 256GB at 52,000 EGP. I found the fair price is 48,000-55,000 EGP. Can we reach 48,000 EGP?",
    },
    createdAt: Date.now(),
  };
}