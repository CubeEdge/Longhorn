export interface WordEntry {
    word: string;
    phonetic?: string;
    meaning: string;
    meaningZh: string;
    partOfSpeech?: string;
    examples: Array<{
        sentence: string;
        translation: string;
    }>;
    image?: string;
    level?: string;
}

// 德语词汇库
export const germanWords: { [key: string]: WordEntry[] } = {
    'A1': [
        // A1 Level (基础)
        {
            word: 'Hallo',
            phonetic: '[haˈloː]',
            meaning: 'Informelle Begrüßung',
            meaningZh: '你好 (非正式)',
            partOfSpeech: 'Interj.',
            examples: [
                { sentence: 'Hallo, wie geht es dir?', translation: '你好，你好吗？' },
                { sentence: 'Sag hallo zu deinem Vater!', translation: '代我向你父亲问好！' }
            ],
            image: '👋',
            level: 'A1'
        },
        {
            word: 'Tschüss',
            phonetic: '[tʃyːs]',
            meaning: 'Informelle Verabschiedung',
            meaningZh: '再见 (非正式)',
            partOfSpeech: 'Interj.',
            examples: [
                { sentence: 'Tschüss, bis morgen!', translation: '再见，明天见！' },
                { sentence: 'Ich muss gehen, tschüss!', translation: '我得走了，拜拜！' }
            ],
            image: '👋',
            level: 'A1'
        },
        {
            word: 'Ja',
            phonetic: '[jaː]',
            meaning: 'Zustimmung',
            meaningZh: '是，对',
            partOfSpeech: 'Partikel',
            examples: [
                { sentence: 'Ja, das stimmt.', translation: '是的，那是对的。' },
                { sentence: 'Ja, bitte.', translation: '是的，请。' }
            ],
            image: '✅',
            level: 'A1'
        },
        {
            word: 'Nein',
            phonetic: '[naɪ̯n]',
            meaning: 'Ablehnung',
            meaningZh: '不，不是',
            partOfSpeech: 'Partikel',
            examples: [
                { sentence: 'Nein, danke.', translation: '不，谢谢。' },
                { sentence: 'Das ist nein.', translation: '那是不行的。' }
            ],
            image: '❌',
            level: 'A1'
        },
        {
            word: 'Bitte',
            phonetic: '[ˈbɪtə]',
            meaning: 'Höfliche Aufforderung',
            meaningZh: '请，不客气',
            partOfSpeech: 'Partikel',
            examples: [
                { sentence: 'Eine Tasse Kaffee, bitte.', translation: '请给我一杯咖啡。' },
                { sentence: 'Bitte schön!', translation: '不客气！' }
            ],
            image: '🙏',
            level: 'A1'
        },
        {
            word: 'Danke',
            phonetic: '[ˈdaŋkə]',
            meaning: 'Ausdruck der Dankbarkeit',
            meaningZh: '谢谢',
            partOfSpeech: 'Partikel',
            examples: [
                { sentence: 'Danke für deine Hilfe.', translation: '谢谢你的帮助。' },
                { sentence: 'Vielen Dank!', translation: '非常感谢！' }
            ],
            image: '💐',
            level: 'A1'
        },
        {
            word: 'Entschuldigung',
            phonetic: '[ɛntˈʃʊldɪɡʊŋ]',
            meaning: 'Bitte um Verzeihung',
            meaningZh: '对不起，抱歉',
            partOfSpeech: 'Nomen',
            examples: [
                { sentence: 'Entschuldigung, wo ist der Bahnhof?', translation: '请问，火车站哪里？' },
                { sentence: 'Entschuldigung für die Verspätung.', translation: '抱歉迟到了。' }
            ],
            image: '🙇',
            level: 'A1'
        },
        {
            word: 'Name',
            phonetic: '[ˈnaːmə]',
            meaning: 'Bezeichnung einer Person',
            meaningZh: '名字',
            partOfSpeech: 'der, -n',
            examples: [
                { sentence: 'Mein Name ist Anna.', translation: '我的名字是安娜。' },
                { sentence: 'Wie ist Ihr Name?', translation: '您叫什么名字？' }
            ],
            image: '🏷️',
            level: 'A1'
        },
        {
            word: 'Kaffee',
            phonetic: '[ˈkafe]',
            meaning: 'Heißes Getränk',
            meaningZh: '咖啡',
            partOfSpeech: 'der, -s',
            examples: [
                { sentence: 'Ich trinke gerne Kaffee.', translation: '我喜欢喝咖啡。' },
                { sentence: 'Ein Kaffee mit Milch, bitte.', translation: '请给我一杯加牛奶的咖啡。' }
            ],
            image: '☕',
            level: 'A1'
        },
        {
            word: 'Wasser',
            phonetic: '[ˈvasɐ]',
            meaning: 'Flüssigkeit',
            meaningZh: '水',
            partOfSpeech: 'das, -',
            examples: [
                { sentence: 'Haben Sie Mineralwasser?', translation: '您有矿泉水吗？' },
                { sentence: 'Ich möchte ein Glas Wasser.', translation: '我想喝一杯水。' }
            ],
            image: '💧',
            level: 'A1'
        }
    ],
    'A2': [
        // A2 Level (初级)
        {
            word: 'Einkaufen',
            phonetic: '[ˈaɪ̯nˌkaʊ̯fn̩]',
            meaning: 'Waren kaufen',
            meaningZh: '购物',
            partOfSpeech: 'Verb',
            examples: [
                { sentence: 'Wir gehen am Samstag einkaufen.', translation: '我们周六去购物。' },
                { sentence: 'Ich muss noch Lebensmittel einkaufen.', translation: '我还得买些杂货。' }
            ],
            image: '🛒',
            level: 'A2'
        },
        {
            word: 'Urlaub',
            phonetic: '[ˈuːɐ̯laʊ̯p]',
            meaning: 'Freie Tage von der Arbeit',
            meaningZh: '假期，休假',
            partOfSpeech: 'der, -e',
            examples: [
                { sentence: 'Wann hast du Urlaub?', translation: '你什么时候休假？' },
                { sentence: 'Wir fahren in den Urlaub nach Spanien.', translation: '我们去西班牙度假。' }
            ],
            image: '🏖️',
            level: 'A2'
        },
        {
            word: 'Wetter',
            phonetic: '[ˈvɛtɐ]',
            meaning: 'Zustand der Atmosphäre',
            meaningZh: '天气',
            partOfSpeech: 'das',
            examples: [
                { sentence: 'Das Wetter ist heute shön.', translation: '今天天气很好。' },
                { sentence: 'Hoffentlich bleibt das Wetter gut.', translation: '希望天气保持晴朗。' }
            ],
            image: '☀️',
            level: 'A2'
        },
        {
            word: 'Kochen',
            phonetic: '[ˈkɔχn̩]',
            meaning: 'Essen zubereiten',
            meaningZh: '烹饪，做饭',
            partOfSpeech: 'Verb',
            examples: [
                { sentence: 'Ich koche gerne Italienisch.', translation: '我喜欢做意大利菜。' },
                { sentence: 'Kannst du gut kochen?', translation: '你擅长做饭吗？' }
            ],
            image: '👨‍🍳',
            level: 'A2'
        },
        {
            word: 'Wohnung',
            phonetic: '[ˈvoːnʊŋ]',
            meaning: 'Räume zum Wohnen',
            meaningZh: '公寓，住房',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Unsere Wohnung hat drei Zimmer.', translation: '我们的公寓有三个房间。' },
                { sentence: 'Die Wohnung ist sehr teuer.', translation: '这套公寓很贵。' }
            ],
            image: '🏢',
            level: 'A2'
        },
        {
            word: 'Fahrrad',
            phonetic: '[ˈfaːɐ̯ˌʁaːt]',
            meaning: 'Zweirädriges Fahrzeug',
            meaningZh: '自行车',
            partOfSpeech: 'das, -räder',
            examples: [
                { sentence: 'Ich fahre mit dem Fahrrad zur Arbeit.', translation: '我不骑自行车去上班。' },
                { sentence: 'Mein Fahrrad ist kaputt.', translation: '我的自行车坏了。' }
            ],
            image: '🚲',
            level: 'A2'
        },
        {
            word: 'Termin',
            phonetic: '[tɛʁˈmiːn]',
            meaning: 'Verabredung zu einer bestimmten Zeit',
            meaningZh: '预约，约会',
            partOfSpeech: 'der, -e',
            examples: [
                { sentence: 'Ich habe einen Termin beim Arzt.', translation: '我有医生预约。' },
                { sentence: 'Können wir den Termin verschieben?', translation: '我们可以推迟预约吗？' }
            ],
            image: '📅',
            level: 'A2'
        },
        {
            word: 'Rechnung',
            phonetic: '[ˈʁɛçnʊŋ]',
            meaning: 'Schriftliche Forderung',
            meaningZh: '账单，发票',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Die Rechnung, bitte.', translation: '请结账。' },
                { sentence: 'Haben Sie die Rechnung bezahlt?', translation: '您付账了吗？' }
            ],
            image: '🧾',
            level: 'A2'
        },
        {
            word: 'Geschenk',
            phonetic: '[ɡəˈʃɛŋk]',
            meaning: 'Etwas, das man jemandem schenkt',
            meaningZh: '礼物',
            partOfSpeech: 'das, -e',
            examples: [
                { sentence: 'Das ist ein Geschenk für dich.', translation: '这是给你的礼物。' },
                { sentence: 'Vielen Dank für das schöne Geschenk.', translation: '非常感谢这精美的礼物。' }
            ],
            image: '🎁',
            level: 'A2'
        },
        {
            word: 'Einladung',
            phonetic: '[ˈaɪ̯nˌlaːdʊŋ]',
            meaning: 'Aufforderung zu kommen',
            meaningZh: '邀请',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Danke für die Einladung.', translation: '谢谢你的邀请。' },
                { sentence: 'Ich habe eine Einladung zur Hochzeit.', translation: '我收到了婚礼请柬。' }
            ],
            image: '💌',
            level: 'A2'
        }
    ],
    'B1': [
        // B1 Level (中级)
        {
            word: 'Erfahrung',
            phonetic: '[ɛɐ̯ˈfaːʁʊŋ]',
            meaning: 'Kenntnis aus der Praxis',
            meaningZh: '经验',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Er hat viel Erfahrung in diesem Beruf.', translation: '他在这个职业上有很多经验。' },
                { sentence: 'Das war eine interessante Erfahrung.', translation: '那是一次有趣的经历。' }
            ],
            image: '🧠',
            level: 'B1'
        },
        {
            word: 'Entscheidung',
            phonetic: '[ɛntˈʃaɪ̯dʊŋ]',
            meaning: 'Wahl zwischen Möglichkeiten',
            meaningZh: '决定',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Das war eine schwere Entscheidung.', translation: '这是一个艰难的决定。' },
                { sentence: 'Hast du schon eine Entscheidung getroffen?', translation: '你已经做决定了吗？' }
            ],
            image: '⚖️',
            level: 'B1'
        },
        {
            word: 'Verantwortung',
            phonetic: '[fɛɐ̯ˈʔantvɔʁtʊŋ]',
            meaning: 'Pflicht, für etwas einzustehen',
            meaningZh: '责任',
            partOfSpeech: 'die',
            examples: [
                { sentence: 'Er trägt viel Verantwortung.', translation: '他承担很多责任。' },
                { sentence: 'Eltern haben Verantwortung für ihre Kinder.', translation: '父母对孩子有责任。' }
            ],
            image: '🛡️',
            level: 'B1'
        },
        {
            word: 'Umwelt',
            phonetic: '[ˈʊmvɛlt]',
            meaning: 'Die natürliche Umgebung',
            meaningZh: '环境',
            partOfSpeech: 'die',
            examples: [
                { sentence: 'Wir müssen die Umwelt schützen.', translation: '我们必须保护环境。' },
                { sentence: 'Umweltfreundliche Autos sind wichtig.', translation: '环保汽车很重要。' }
            ],
            image: '🌳',
            level: 'B1'
        },
        {
            word: 'Gesellschaft',
            phonetic: '[ɡəˈzɛlʃaft]',
            meaning: 'Gesamtheit der Menschen',
            meaningZh: '社会',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Die Gesellschaft ändert sich schnell.', translation: '社会变化很快。' },
                { sentence: 'Er ist ein wichtiges Mitglied der Gesellschaft.', translation: '他是社会的重要成员。' }
            ],
            image: '👥',
            level: 'B1'
        },
        {
            word: 'Zukunft',
            phonetic: '[ˈt͡suːkʊnft]',
            meaning: 'Die kommende Zeit',
            meaningZh: '未来',
            partOfSpeech: 'die',
            examples: [
                { sentence: 'Wer weiß, was die Zukunft bringt?', translation: '谁知道未来会带来什么？' },
                { sentence: 'Wir planen für die Zukunft.', translation: '我们在为未来做计划。' }
            ],
            image: '🚀',
            level: 'B1'
        },
        {
            word: 'Erfolg',
            phonetic: '[ɛɐ̯ˈfɔlk]',
            meaning: 'Gelingen, positives Ergebnis',
            meaningZh: '成功',
            partOfSpeech: 'der, -e',
            examples: [
                { sentence: 'Ich wünsche dir viel Erfolg!', translation: '祝你成功！' },
                { sentence: 'Das Projekt war ein großer Erfolg.', translation: '这个项目非常成功。' }
            ],
            image: '🏆',
            level: 'B1'
        },
        {
            word: 'Beziehung',
            phonetic: '[bəˈt͡siːʊŋ]',
            meaning: 'Verhältnis zwischen Menschen',
            meaningZh: '关系',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Sie haben eine gute Beziehung.', translation: '他们关系很好。' },
                { sentence: 'Internationale Beziehungen sind komplex.', translation: '国际关系很复杂。' }
            ],
            image: '💞',
            level: 'B1'
        },
        {
            word: 'Bildung',
            phonetic: '[ˈbɪldʊŋ]',
            meaning: 'Schulung, Wissen',
            meaningZh: '教育',
            partOfSpeech: 'die',
            examples: [
                { sentence: 'Bildung ist der Schlüssel zum Erfolg.', translation: '教育是成功的关键。' },
                { sentence: 'Er legt viel Wert auf Bildung.', translation: '他非常重视教育。' }
            ],
            image: '🎓',
            level: 'B1'
        },
        {
            word: 'Kultur',
            phonetic: '[kʊlˈtuːɐ̯]',
            meaning: 'Kunst, Bräuche einer Gesellschaft',
            meaningZh: '文化',
            partOfSpeech: 'die, -en',
            examples: [
                { sentence: 'Ich interessiere mich für fremde Kulturen.', translation: '我对外国文化感兴趣。' },
                { sentence: 'Die deutsche Kultur ist sehr vielfältig.', translation: '德国文化非常多样化。' }
            ],
            image: '🎨',
            level: 'B1'
        }
    ]
};

// 日语词汇库
export const japaneseWords: { [key: string]: WordEntry[] } = {
    'N5': [
        // N5 Level (入门)
        {
            word: '私',
            phonetic: 'わたし / watashi',
            meaning: '一人称',
            meaningZh: '我',
            partOfSpeech: '代名詞',
            examples: [
                { sentence: '私は学生です。', translation: '我是学生。' },
                { sentence: 'これは私の本です。', translation: '这是我的书。' }
            ],
            image: '🙋',
            level: 'N5'
        },
        {
            word: '先生',
            phonetic: 'せんせい / sensei',
            meaning: '教師、指導者',
            meaningZh: '老师，先生',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '田中先生は日本語を教えます。', translation: '田中老师教日语。' },
                { sentence: '先生、質問があります。', translation: '老师，我有个问题。' }
            ],
            image: '👨‍🏫',
            level: 'N5'
        },
        {
            word: '学生',
            phonetic: 'がくせい / gakusei',
            meaning: '学校で学ぶ人',
            meaningZh: '学生',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '彼は大学生です。', translation: '他是大学生。' },
                { sentence: '留学生が多いです。', translation: '留学生很多。' }
            ],
            image: '🎓',
            level: 'N5'
        },
        {
            word: '学校',
            phonetic: 'がっこう / gakkou',
            meaning: '教育を行う場所',
            meaningZh: '学校',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '明日学校へ行きます。', translation: '明天去学校。' },
                { sentence: '学校はどこですか。', translation: '学校在哪里？' }
            ],
            image: '🏫',
            level: 'N5'
        },
        {
            word: '本',
            phonetic: 'ほん / hon',
            meaning: '書籍',
            meaningZh: '书',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '本を読みます。', translation: '读书。' },
                { sentence: 'この本は面白いです。', translation: '这本书很有趣。' }
            ],
            image: '📖',
            level: 'N5'
        },
        {
            word: '水',
            phonetic: 'みず / mizu',
            meaning: '液体',
            meaningZh: '水',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '水をください。', translation: '请给我水。' },
                { sentence: '冷たい水が飲みたい。', translation: '想喝冷水。' }
            ],
            image: '🥤',
            level: 'N5'
        },
        {
            word: '食べる',
            phonetic: 'たべる / taberu',
            meaning: '食事をする',
            meaningZh: '吃',
            partOfSpeech: '動詞',
            examples: [
                { sentence: 'ご飯を食べます。', translation: '吃饭。' },
                { sentence: '魚を食べるのが好きです。', translation: '我喜欢吃鱼。' }
            ],
            image: '🍚',
            level: 'N5'
        },
        {
            word: '見る',
            phonetic: 'みる / miru',
            meaning: '目でとらえる',
            meaningZh: '看',
            partOfSpeech: '動詞',
            examples: [
                { sentence: '映画を見ます。', translation: '看电影。' },
                { sentence: 'テレビを見ています。', translation: '正在看电视。' }
            ],
            image: '👀',
            level: 'N5'
        },
        {
            word: '大きい',
            phonetic: 'おおきい / ookii',
            meaning: 'サイズが大',
            meaningZh: '大的',
            partOfSpeech: '形容詞',
            examples: [
                { sentence: '大きな家ですね。', translation: '真是个大房子啊。' },
                { sentence: '象は大きいです。', translation: '大象很大。' }
            ],
            image: '🐘',
            level: 'N5'
        },
        {
            word: '好き',
            phonetic: 'すき / suki',
            meaning: '好むこと',
            meaningZh: '喜欢',
            partOfSpeech: '形容動詞',
            examples: [
                { sentence: '猫が好きです。', translation: '我喜欢猫。' },
                { sentence: 'あなたが好きです。', translation: '我喜欢你。' }
            ],
            image: '❤️',
            level: 'N5'
        }
    ],
    'N4': [
        // N4 Level (初级)
        {
            word: '利用',
            phonetic: 'りよう / riyou',
            meaning: '使うこと',
            meaningZh: '利用，使用',
            partOfSpeech: '名詞/動詞',
            examples: [
                { sentence: '図書館を利用します。', translation: '利用图书馆。' },
                { sentence: 'バスを利用して行きます。', translation: '乘公交车去。' }
            ],
            image: '🛠️',
            level: 'N4'
        },
        {
            word: '場合',
            phonetic: 'ばあい / baai',
            meaning: 'ケース、状況',
            meaningZh: '场合，情况',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '雨の場合は中止です。', translation: '下雨的话就取消。' },
                { sentence: '緊急の場合', translation: '紧急情况' }
            ],
            image: '🚩',
            level: 'N4'
        },
        {
            word: '予定',
            phonetic: 'よてい / yotei',
            meaning: '計画、スケジュール',
            meaningZh: '预定，计划',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '明日の予定は何ですか。', translation: '明天的安排是什么？' },
                { sentence: '旅行の予定を立てます。', translation: '制定旅行计划。' }
            ],
            image: '📅',
            level: 'N4'
        },
        {
            word: '興味',
            phonetic: 'きょうみ / kyoumi',
            meaning: '関心',
            meaningZh: '兴趣',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '日本文化に興味があります。', translation: '对日本文化感兴趣。' },
                { sentence: '政治には興味がない。', translation: '对政治没兴趣。' }
            ],
            image: '🤔',
            level: 'N4'
        },
        {
            word: '最近',
            phonetic: 'さいきん / saikin',
            meaning: '少し前、近頃',
            meaningZh: '最近',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '最近忙しいです。', translation: '最近很忙。' },
                { sentence: '最近どうですか。', translation: '最近怎么样？' }
            ],
            image: '⌚',
            level: 'N4'
        },
        {
            word: '説明',
            phonetic: 'せつめい / setsumei',
            meaning: '詳しく教えること',
            meaningZh: '说明，解释',
            partOfSpeech: '名詞/動詞',
            examples: [
                { sentence: '理由を説明してください。', translation: '请解释理由。' },
                { sentence: '説明書を読みます。', translation: '读说明书。' }
            ],
            image: '📝',
            level: 'N4'
        },
        {
            word: '準備',
            phonetic: 'じゅんび / junbi',
            meaning: '用意すること',
            meaningZh: '准备',
            partOfSpeech: '名詞/動詞',
            examples: [
                { sentence: '試験の準備をします。', translation: '准备考试。' },
                { sentence: '準備完了です。', translation: '准备完毕。' }
            ],
            image: '🎒',
            level: 'N4'
        },
        {
            word: '続ける',
            phonetic: 'つづける / tsuzukeru',
            meaning: '継続する',
            meaningZh: '继续',
            partOfSpeech: '動詞',
            examples: [
                { sentence: '勉強を続けてください。', translation: '请继续学习。' },
                { sentence: '仕事を続けます。', translation: '继续工作。' }
            ],
            image: '🔄',
            level: 'N4'
        },
        {
            word: '必要',
            phonetic: 'ひつよう / hitsuyou',
            meaning: 'なくてはならない',
            meaningZh: '必要',
            partOfSpeech: '形容動詞',
            examples: [
                { sentence: 'お金が必要です。', translation: '需要钱。' },
                { sentence: 'パスポートが必要です。', translation: '需要护照。' }
            ],
            image: '⚠️',
            level: 'N4'
        },
        {
            word: '世界',
            phonetic: 'せかい / sekai',
            meaning: '地球上のすべての地域',
            meaningZh: '世界',
            partOfSpeech: '名詞',
            examples: [
                { sentence: '世界中を旅行したい。', translation: '想环游世界。' },
                { sentence: '世界は広いです。', translation: '世界很大。' }
            ],
            image: '🌍',
            level: 'N4'
        }
    ],
    'N3': [
        // N3 Level (中级)
        {
            word: '当然',
            phonetic: 'とうぜん / touzen',
            meaning: '当たり前',
            meaningZh: '当然，理所当然',
            partOfSpeech: '副詞/形容動詞',
            examples: [
                { sentence: '彼が合格するのは当然だ。', translation: '他合格是理所当然的。' },
                { sentence: '当然のことをしただけです。', translation: '只是做了该做的事。' }
            ],
            image: '👌',
            level: 'N3'
        },
        {
            word: '効果',
            phonetic: 'こうか / kouka',
            meaning: '効き目',
            meaningZh: '效果',
            partOfSpeech: '名詞',
            examples: [
                { sentence: 'この薬は効果がある。', translation: '这药有效果。' },
                { sentence: '宣伝効果が高い。', translation: '宣传效果很好。' }
            ],
            image: '💊',
            level: 'N3'
        },
        {
            word: '実際',
            phonetic: 'じっさい / jissai',
            meaning: '現実',
            meaningZh: '实际',
            partOfSpeech: '名詞/副詞',
            examples: [
                { sentence: '実際はもっと難しい。', translation: '实际上更难。' },
                { sentence: '実際に見ました。', translation: '实际看到了。' }
            ],
            image: '👓',
            level: 'N3'
        },
        {
            word: '関係',
            phonetic: 'かんけい / kankei',
            meaning: '関わり',
            meaningZh: '关系',
            partOfSpeech: '名詞',
            examples: [
                { sentence: 'いい関係を築く。', translation: '建立良好关系。' },
                { sentence: '私には関係ありません。', translation: '跟我没关系。' }
            ],
            image: '🔗',
            level: 'N3'
        },
        {
            word: '表現',
            phonetic: 'ひょうげん / hyougen',
            meaning: '表すこと',
            meaningZh: '表现，表达',
            partOfSpeech: '名詞/動詞',
            examples: [
                { sentence: '自分の気持ちを表現する。', translation: '表达自己的心情。' },
                { sentence: '豊かな表現力。', translation: '丰富的表现力。' }
            ],
            image: '🎭',
            level: 'N3'
        },
        {
            word: '完全',
            phonetic: 'かんぜん / kanzen',
            meaning: '欠けたところがない',
            meaningZh: '完全，完美',
            partOfSpeech: '名詞/形容動詞',
            examples: [
                { sentence: '準備は完全だ。', translation: '准备万全。' },
                { sentence: '完全に理解しました。', translation: '完全理解了。' }
            ],
            image: '💯',
            level: 'N3'
        },
        {
            word: '期待',
            phonetic: 'きたい / kitai',
            meaning: '当てにして待つこと',
            meaningZh: '期待',
            partOfSpeech: '名詞/動詞',
            examples: [
                { sentence: '活躍を期待しています。', translation: '期待你的活跃表现。' },
                { sentence: '期待外れでした。', translation: '出乎意料（失望）。' }
            ],
            image: '🤩',
            level: 'N3'
        },
        {
            word: '解決',
            phonetic: 'かいけつ / kaiketsu',
            meaning: '問題を処理すること',
            meaningZh: '解决',
            partOfSpeech: '名詞/動詞',
            examples: [
                { sentence: '問題が解決しました。', translation: '问题解决了。' },
                { sentence: '解決策を探す。', translation: '寻找解决方案。' }
            ],
            image: '🧩',
            level: 'N3'
        },
        {
            word: '一般的',
            phonetic: 'いっぱんてき / ippanteki',
            meaning: '広く行き渡っているさま',
            meaningZh: '一般的，普遍的',
            partOfSpeech: '形容動詞',
            examples: [
                { sentence: 'それは一般的な考えです。', translation: '那是普遍的想法。' },
                { sentence: '一般的に言えば', translation: '一般来说' }
            ],
            image: '🌐',
            level: 'N3'
        },
        {
            word: '重要',
            phonetic: 'じゅうよう / juuyou',
            meaning: '大切であること',
            meaningZh: '重要',
            partOfSpeech: '形容動詞',
            examples: [
                { sentence: '重要な会議があります。', translation: '有个重要的会议。' },
                { sentence: '健康は重要です。', translation: '健康很重要。' }
            ],
            image: '❗',
            level: 'N3'
        }
    ]
};

// 英语词汇库
export const englishWords: { [key: string]: WordEntry[] } = {
    'advanced': [
        // Advanced Words (GRE/High-level)
        {
            word: 'Serendipity',
            phonetic: '/ˌserənˈdɪpɪti/',
            meaning: 'Finding value by luck',
            meaningZh: '意外发现美好事物的运气',
            partOfSpeech: 'n.',
            examples: [
                { sentence: 'Finding this café was pure serendipity.', translation: '发现这家咖啡馆纯属机缘巧合。' },
                { sentence: 'A moment of serendipity changed his life.', translation: '一次偶然的机缘改变了他的人生。' }
            ],
            image: '✨',
            level: 'Advanced'
        },
        {
            word: 'Ephemeral',
            phonetic: '/ɪˈfemərəl/',
            meaning: 'Lasting a very short time',
            meaningZh: '短暂的',
            partOfSpeech: 'adj.',
            examples: [
                { sentence: 'Fame is often ephemeral.', translation: '名声往往是短暂的。' },
                { sentence: 'Enjoy the ephemeral beauty of flowers.', translation: '享受花朵短暂的美丽。' }
            ],
            image: '🌸',
            level: 'Advanced'
        },
        {
            word: 'Ubiquitous',
            phonetic: '/juːˈbɪkwɪtəs/',
            meaning: 'Found everywhere',
            meaningZh: '无处不在的',
            partOfSpeech: 'adj.',
            examples: [
                { sentence: 'Smartphones are ubiquitous now.', translation: '智能手机现在无处不在。' },
                { sentence: 'Coffee shops are ubiquitous in the city.', translation: '城市里咖啡店随处可见。' }
            ],
            image: '🌍',
            level: 'Advanced'
        },
        {
            word: 'Eloquent',
            phonetic: '/ˈeləkwənt/',
            meaning: 'Fluent speaking',
            meaningZh: '雄辩的',
            partOfSpeech: 'adj.',
            examples: [
                { sentence: 'She gave an eloquent speech.', translation: '她发表了雄辩的演讲。' },
                { sentence: 'His eyes were eloquent.', translation: '他的眼神会说话。' }
            ],
            image: '🎤',
            level: 'Advanced'
        },
        {
            word: 'Resilient',
            phonetic: '/rɪˈzɪliənt/',
            meaning: 'Able to recover quickly',
            meaningZh: '有韧性的',
            partOfSpeech: 'adj.',
            examples: [
                { sentence: 'Kids are resilient.', translation: '孩子们适应力很强。' },
                { sentence: 'A resilient economy.', translation: '韧性强的经济。' }
            ],
            image: '💪',
            level: 'Advanced'
        },
        {
            word: 'Pragmatic',
            phonetic: '/præɡˈmætɪk/',
            meaning: 'Practical',
            meaningZh: '务实的',
            partOfSpeech: 'adj.',
            examples: [
                { sentence: 'A pragmatic approach to problems.', translation: '解决问题的务实方法。' },
                { sentence: 'He is a pragmatic leader.', translation: '他是位务实的领导者。' }
            ],
            image: '🎯',
            level: 'Advanced'
        },
        {
            word: 'Meticulous',
            phonetic: '/məˈtɪkjələs/',
            meaning: 'Very careful and precise',
            meaningZh: '一丝不苟的',
            partOfSpeech: 'adj.',
            examples: [
                { sentence: 'He is meticulous about details.', translation: '他对细节一丝不苟。' },
                { sentence: 'Meticulous planning is key.', translation: '周密的计划是关键。' }
            ],
            image: '🔍',
            level: 'Advanced'
        },
        {
            word: 'Altruistic',
            phonetic: '/ˌæl.truˈɪs.tɪk/',
            meaning: 'Selfless concern for others',
            meaningZh: '利他的，无私的',
            partOfSpeech: 'adj.',
            examples: [
                { sentence: 'It was an entirely altruistic act.', translation: '这完全是无私的举动。' },
                { sentence: 'He has altruistic motives.', translation: '他的动机是利他的。' }
            ],
            image: '🤝',
            level: 'Advanced'
        },
        {
            word: 'Enigma',
            phonetic: '/ɪˈnɪɡ.mə/',
            meaning: 'A person or thing that is mysterious',
            meaningZh: '谜，谜一样的人或事',
            partOfSpeech: 'n.',
            examples: [
                { sentence: 'He is an enigma to his friends.', translation: '对他朋友来说，他是个谜。' },
                { sentence: 'The origin of the coin remains an enigma.', translation: '这枚硬币的来历仍是个谜。' }
            ],
            image: '❓',
            level: 'Advanced'
        },
        {
            word: 'Cacophony',
            phonetic: '/kəˈkɒf.ə.ni/',
            meaning: 'A harsh, discordant mixture of sounds',
            meaningZh: '刺耳的嘈杂声',
            partOfSpeech: 'n.',
            examples: [
                { sentence: 'A cacophony of deafening alarm bells.', translation: '刺耳的警报声响成一片。' },
                { sentence: 'The city street was a cacophony of noise.', translation: '城市街道上噪音嘈杂。' }
            ],
            image: '📢',
            level: 'Advanced'
        }
    ]
};

// 中文成语库
export const chineseIdioms: { [key: string]: WordEntry[] } = {
    'idioms': [
        // Idioms (成语)
        {
            word: '画龙点睛',
            phonetic: 'huà lóng diǎn jīng',
            meaning: 'Making a key point',
            meaningZh: '画龙点睛',
            examples: [
                { sentence: '这句话真是画龙点睛。', translation: 'This sentence is the finishing touch.' },
                { sentence: '起到画龙点睛的作用。', translation: 'Act as the finishing touch.' }
            ],
            image: '🐉',
            level: 'Advanced'
        },
        {
            word: '胸有成竹',
            phonetic: 'xiōng yǒu chéng zhú',
            meaning: 'Confident preparation',
            meaningZh: '胸有成竹',
            examples: [
                { sentence: '他对此胸有成竹。', translation: 'He is confident about this.' },
                { sentence: '做事要胸有成竹。', translation: 'Be prepared before acting.' }
            ],
            image: '🎋',
            level: 'Advanced'
        },
        {
            word: '锲而不舍',
            phonetic: 'qiè ér bù shě',
            meaning: 'Perseverance',
            meaningZh: '锲而不舍',
            examples: [
                { sentence: '他锲而不舍地努力。', translation: 'He works with perseverance.' },
                { sentence: '锲而不舍的精神。', translation: 'Spirit of perseverance.' }
            ],
            image: '⛏️',
            level: 'Advanced'
        },
        {
            word: '见微知著',
            phonetic: 'jiàn wēi zhī zhù',
            meaning: 'Knowing the whole by a part',
            meaningZh: '见微知著',
            examples: [
                { sentence: '智者能见微知著。', translation: 'Wise men see the big picture from small clues.' },
                { sentence: '我们要学会见微知著。', translation: 'We must learn to see trends from details.' }
            ],
            image: '🔬',
            level: 'Advanced'
        },
        {
            word: '厚积薄发',
            phonetic: 'hòu jī bó fā',
            meaning: 'Accumulate richness and spend it sparingly; rise abruptly based on accumulated strength',
            meaningZh: '厚积薄发',
            examples: [
                { sentence: '这是厚积薄发的结果。', translation: 'This is the result of long accumulation.' },
                { sentence: '只有厚积薄发才能成功。', translation: 'Only with deep accumulation can one succeed.' }
            ],
            image: '🌋',
            level: 'Advanced'
        },
        {
            word: '卧薪尝胆',
            phonetic: 'wò xīn cháng dǎn',
            meaning: 'Endure hardships to accomplish some ambition',
            meaningZh: '卧薪尝胆',
            examples: [
                { sentence: '我们要有卧薪尝胆的决心。', translation: 'We need the determination to endure hardships for success.' },
                { sentence: '越王勾践卧薪尝胆。', translation: 'King Goujian endured hardships to plan revenge.' }
            ],
            image: '🗡️',
            level: 'Advanced'
        },
        {
            word: '高瞻远瞩',
            phonetic: 'gāo zhān yuǎn zhǔ',
            meaning: 'Stand high and see far; show great foresight',
            meaningZh: '高瞻远瞩',
            examples: [
                { sentence: '这是一个高瞻远瞩的战略。', translation: 'This is a far-sighted strategy.' },
                { sentence: '领导者需要高瞻远瞩。', translation: 'Leaders need to be far-sighted.' }
            ],
            image: '🔭',
            level: 'Advanced'
        },
        {
            word: '破釜沉舟',
            phonetic: 'pò fǔ chén zhōu',
            meaning: 'Burn one\'s boats; grim determination',
            meaningZh: '破釜沉舟',
            examples: [
                { sentence: '他决心破釜沉舟，背水一战。', translation: 'He decided to burn his boats and fight to the end.' },
                { sentence: '需要破釜沉舟的勇气。', translation: 'Need the courage of burning boats.' }
            ],
            image: '🔥',
            level: 'Advanced'
        },
        {
            word: '海纳百川',
            phonetic: 'hǎi nà bǎi chuān',
            meaning: 'Be tolerant to diversity',
            meaningZh: '海纳百川',
            examples: [
                { sentence: '海纳百川，有容乃大。', translation: 'The sea refuses no river; tolerance brings greatness.' },
                { sentence: '要有海纳百川的胸怀。', translation: 'Be broad-minded like the sea.' }
            ],
            image: '🌊',
            level: 'Advanced'
        },
        {
            word: '天道酬勤',
            phonetic: 'tiān dào chóu qín',
            meaning: 'God rewards the diligent',
            meaningZh: '天道酬勤',
            examples: [
                { sentence: '我相信天道酬勤。', translation: 'I believe God rewards the diligent.' },
                { sentence: '天道酬勤，付出终有回报。', translation: 'Hard work pays off.' }
            ],
            image: '💪',
            level: 'Advanced'
        }
    ]
};

// 获取可用等级
export const getAvailableLevels = (language: 'zh' | 'en' | 'de' | 'ja'): string[] => {
    switch (language) {
        case 'de': return ['A1', 'A2', 'B1'];
        case 'ja': return ['N5', 'N4', 'N3'];
        case 'en': return ['advanced'];
        case 'zh': return ['idioms'];
        default: return [];
    }
};

// 获取随机词汇
export const getRandomWord = (language: 'zh' | 'en' | 'de' | 'ja', level?: string): WordEntry => {
    let wordList: WordEntry[] = [];

    // Select correct dictionary based on language
    if (language === 'de') {
        const targetLevel = level && germanWords[level] ? level : 'A1';
        wordList = germanWords[targetLevel];
    } else if (language === 'ja') {
        const targetLevel = level && japaneseWords[level] ? level : 'N5';
        wordList = japaneseWords[targetLevel];
    } else if (language === 'en') {
        wordList = englishWords['advanced'];
    } else {
        wordList = chineseIdioms['idioms'];
    }

    // Safety fallback
    if (!wordList || wordList.length === 0) {
        // Fallback to German A1 to avoid crash
        wordList = germanWords['A1'];
    }

    const randomIndex = Math.floor(Math.random() * wordList.length);
    return wordList[randomIndex];
};

// 获取语言的发音代码
export const getSpeechLang = (language: 'zh' | 'en' | 'de' | 'ja'): string => {
    const langs = {
        de: 'de-DE',
        ja: 'ja-JP',
        en: 'en-US',
        zh: 'zh-CN'
    };
    return langs[language];
};
