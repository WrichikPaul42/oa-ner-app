package com.kneeva.triage.ui.i18n

enum class NerLanguage(val code: String, val displayName: String, val region: String) {
    ENGLISH("en", "English", "National"),
    ASSAMESE("as", "অসমীয়া (Assamese)", "Assam & Brahmaputra Valley"),
    BENGALI("bn", "বাংলা (Bengali)", "Tripura & Barak Valley"),
    MANIPURI("mni", "মৈতৈলোন্ (Manipuri)", "Manipur"),
    KHASI("kha", "Ka Ktien Khasi", "Meghalaya"),
    MIZO("lus", "Mizo ṭawng", "Mizoram"),
    HINDI("hi", "हिन्दी (Hindi)", "National / Common")
}

data class LocalizedStrings(
    val appTitle: String,
    val patientDetails: String,
    val dailyLoadPrompt: String,
    val dailyInclinePrompt: String,
    val squattingDifficultyPrompt: String,
    val test1Instruction: String,
    val test2Instruction: String,
    val submitButton: String,
    val preventiveGuidanceHeader: String
)

object NerLocalizationRegistry {

    private val translations = mapOf(
        NerLanguage.ENGLISH to LocalizedStrings(
            appTitle = "Kneeva — Non-Invasive Knee OA Screening",
            patientDetails = "Patient Demographics & Livelihood",
            dailyLoadPrompt = "How much weight (firewood, water containers, headload) do you carry daily?",
            dailyInclinePrompt = "How many hours each day do you walk on steep hills or slopes?",
            squattingDifficultyPrompt = "Do you experience pain when squatting or sitting cross-legged?",
            test1Instruction = "Flat Ground Walk Test: Walk continuously at a normal pace for 60 seconds.",
            test2Instruction = "Incline Walk Test: Walk up a mountain slope, hill, or stairs for 60 seconds.",
            submitButton = "Submit Triage Assessment",
            preventiveGuidanceHeader = "Preventive Care & Joint Protection"
        ),
        NerLanguage.ASSAMESE to LocalizedStrings(
            appTitle = "ক্নীভা — আঁঠুৰ বিষ আৰু সন্ধিবাত নিৰ্ণয়",
            patientDetails = "ৰোগীৰ তথ্য আৰু জীৱিকা",
            dailyLoadPrompt = "আপুনি দৈনিক কিমান ওজন (খৰি, পানী, মূৰৰ বোজা) বহন কৰে?",
            dailyInclinePrompt = "পাহাৰীয়া বা হেলনীয়া বাটত দৈনিক কিমান সময় খোজ কাঢ়ে?",
            squattingPrompt()?,
            squattingDifficultyPrompt = "মজিয়াত উবুৰি হৈ বা আঠু কাঢ়ি বহোঁতে বিষ অনুভৱ হয়নে?",
            test1Instruction = "সমতল খোজ পৰীক্ষা: ৬০ ছেকেণ্ডৰ বাবে নিয়মীয়া গতিত খোজ কাঢ়ক।",
            test2Instruction = "ওখ-চাপৰ খোজ পৰীক্ষা: ৬০ ছেকেণ্ডৰ বাবে পাহাৰ বা চিৰিৰে খোজ কাঢ়ক।",
            submitButton = "পৰীক্ষাৰ ফলাফল প্ৰেৰণ কৰক",
            preventiveGuidanceHeader = "আঁঠু সুৰক্ষা আৰু সাৱধানতা নিৰ্দেশনা"
        ),
        NerLanguage.BENGALI to LocalizedStrings(
            appTitle = "ক্লিভা — অস্টিওআর্থারাইটিস স্ক্রিনিং",
            patientDetails = "রোগীর বিবরণ ও জীবিকা",
            dailyLoadPrompt = "আপনি প্রতিদিন কতটা বোঝা (জল, কাঠ বা মাথার বোঝা) বহন করেন?",
            dailyInclinePrompt = "প্রতিদিন পাহাড়ি বা ঢালু রাস্তায় কতক্ষণ হাঁটাচলা করেন?",
            squattingDifficultyPrompt = "মেঝেতে উবু হয়ে বসতে বা হাঁটু ভাঁজ করতে কি কষ্ট হয়?",
            test1Instruction = "সমতল হাঁটার পরীক্ষা: ৬০ সেকেন্ড স্বাভাবিক গতিতে সোজা হাঁটুন।",
            test2Instruction = "ঢালু হাঁটার পরীক্ষা: ৬০ সেকেন্ড সিঁড়ি বা পাহাড়ের ঢালে উঠুন।",
            submitButton = "ট্রায়াজ মূল্যায়ন জমা দিন",
            preventiveGuidanceHeader = "হাঁটুর যত্ন এবং প্রতিরোধমূলক নির্দেশিকা"
        ),
        NerLanguage.KHASI to LocalizedStrings(
            appTitle = "Kneeva — Ka Jingkhmih Bniah ia ka Khymia Mat-Kjat",
            patientDetails = "Jingtip Shaphang u Nongpang",
            dailyLoadPrompt = "Kano ka jingkhia (diengïap, um, kit khlieh) phi kit man ka sngi?",
            dailyInclinePrompt = "Katai kynta man ka sngi phi iaid ha ki lum ne ki jaka thied?",
            squattingDifficultyPrompt = "Phi sngewpang mo haba phi shong kdor ne dem matkjat?",
            test1Instruction = "Jingiaid Pyntha: Iaid 60 sekhon ha ka jaka madan kaba ryntih.",
            test2Instruction = "Jingkiew Lum: Iaid kiew ha ki mawkyndon ne riat 60 sekhon.",
            submitButton = "Phah ia ka Jinglap",
            preventiveGuidanceHeader = "Ki Jingbthah ia ka Koit ka Khiah ki Mat"
        ),
        NerLanguage.MIZO to LocalizedStrings(
            appTitle = "Kneeva — Khup Ruhseh Endikna",
            patientDetails = "Damlo Chanchin leh Eizawnna",
            dailyLoadPrompt = "Ni tin rit (thing, tui, lu-chawi) eng zat nge i phurh ṭhin?",
            dailyInclinePrompt = "Ni tin chho leh thlang kal nan darkar eng zat nge i hman?",
            squattingDifficultyPrompt = "Ṭhutṭhat emaw ṭhut-tual thlengin i khup a na em?",
            test1Instruction = "Phêl Zawl Kalna: Minute 1 (sec 60) pangngai takin kal rawh.",
            test2Instruction = "Chho Kalna: Minute 1 (sec 60) chho emaw kailawn ah kal rawh.",
            submitButton = "Endikna Thawn Rawh",
            preventiveGuidanceHeader = "Khup Hriselna Vawn Dan"
        ),
        NerLanguage.HINDI to LocalizedStrings(
            appTitle = "क्नीवा — घुटने के ऑस्टियोआर्थराइटिस की प्रारंभिक जांच",
            patientDetails = "मरीज की जानकारी और आजीविका",
            dailyLoadPrompt = "आप रोजाना कितना वजन (लकड़ी, पानी, सिर पर बोझ) उठाते हैं?",
            dailyInclinePrompt = "पहाड़ी ढलानों या सीढ़ियों पर प्रतिदिन कितने घंटे चलते हैं?",
            squattingDifficultyPrompt = "उकड़ू बैठने या पालथी मारकर बैठने में दर्द होता है?",
            test1Instruction = "समतल चाल परीक्षण: 60 सेकंड के लिए सामान्य गति से सीधे चलें।",
            test2Instruction = "ढलान चाल परीक्षण: 60 सेकंड के लिए ढलान या सीढ़ियों पर चलें।",
            submitButton = "जांच परिणाम सर्वर पर भेजें",
            preventiveGuidanceHeader = "घुटने की देखभाल और रोकथाम संबंधी सलाह"
        )
    )

    fun getStrings(lang: NerLanguage): LocalizedStrings {
        return translations[lang] ?: translations[NerLanguage.ENGLISH]!!
    }
}
