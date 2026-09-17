import { validExample,type AdaptiveLesson } from "./adaptive";
const archiveSource={title:"美国国家档案馆 · Analyze a Written Document",url:"https://www.archives.gov/education/lessons/worksheets/analyze-a-written-document-intermediate"};
export const conceptLesson:AdaptiveLesson={version:2,id:"concept-light-year",title:"光年到底是时间，还是距离？",category:"概念辨析",hook:"名字里有“年”，却不能用来描述生日之间的时间。",minutes:5,
 objective:"根据一句话描述的是路程还是时长，判断它是不是在说光年。",
 mainQuestion:"光年到底是时间，还是距离？",
 plan:{objective:"先按“描述路程还是时长”把例子分开，再看名称为什么容易误导，最后换一句话自己判断。",modules:[
  {id:"sort",title:"把两个量分开",approachType:"concept",purpose:"先建立边界，才谈得上解释名称。",contributes:"它给出判断标准：这句话在描述路程还是时长。"},
  {id:"apply",title:"换一句话自己判断",approachType:"concept",purpose:"在新的句子上试用刚才的边界。",contributes:"它检验你能否不看名称、只看描述来判断。"}
 ]},
 steps:[
  {id:"classify",module:"sort",title:"不要只看名称，看它在描述什么",type:"classify",instruction:"下面每句话在描述什么？按“距离”或“时间”分类。",categories:[{id:"distance",label:"距离"},{id:"time",label:"时间"}],items:[
   {text:"光在一年里走过的路程",categoryId:"distance",feedback:"“走过的路程”是距离，这就是一光年。"},
   {text:"从今年生日到明年生日的时长",categoryId:"time",feedback:"这里描述经过多久，是时间。"},
   {text:"这颗恒星离我们 4 光年",categoryId:"distance",feedback:"“离我们多远”问的是相隔的路程。"}
  ]},
  {id:"naming",module:"sort",title:"名称里藏着测量方法",type:"explain",paragraphs:["光年指光在真空中走一年所经过的距离。“一年”告诉我们测量了多久，最终得到的量是路程。","所以它带着时间这个词，却不是时间单位。"],
   supply:[{id:"why-year",label:"为什么非要用“年”来量距离？",kind:"term",helpsWith:"说明名称里的“年”是测量方法的痕迹，不是量纲。",backLabel:"知道了，回到判断",
    body:[{id:"why-year-explain",title:"因为光速是一个固定值",type:"explain",paragraphs:["光速固定，所以“光走了多久”和“走了多远”可以互相换算。","天文学里距离太大，用米或千米不便书写，于是直接用光的行程来命名。"]}]}]},
  {id:"apply",module:"apply",title:"换一句话看看",type:"choice",question:"“这颗恒星距离我们 4 光年”中的 4 光年表示什么？",options:[{label:"它距离我们的路程",correct:true,feedback:"对，光年在这里描述距离。"},{label:"它的年龄",correct:false,feedback:"句子描述的是距离。光年不是年龄单位。"},{label:"光走了 4 年的那段时间",correct:false,feedback:"光确实走了 4 年，但这句话问的是相隔多远，4 光年是那段路程的长度。"}],hint:"先看这句话问的是相隔多远，还是存在多久。"},
  {id:"wrap",module:"apply",title:"把最初的疑问收个尾",type:"synthesis",answer:"光年是距离单位，不是时间单位：它指光在真空中走一年所经过的路程。“年”只说明用什么方法测量，不改变它量的是路程这个事实。",conditions:"只在把“年”理解为光的行程时成立；换成别的天体尺度或宇宙膨胀情境，距离的表述需要另外讨论。",openQuestions:["知道距离是 4 光年，怎样估出光走了多久？","如果宇宙在膨胀，远处的“距离”还容易定义吗？"]}
 ],boundary:"本例只辨析单位与名称；不讨论遥远星系中的宇宙膨胀效应，也不涉及视星等与光度距离的区别。",followups:["知道距离后，怎样估计光传播的时间？"],sources:[{title:"NASA · What Is a Light-Year?",url:"https://spaceplace.nasa.gov/light-year/en/"}]};
export const evidenceLesson:AdaptiveLesson={version:2,id:"evidence-investigation",title:"两份史料说反了，历史学家会相信谁？",category:"历史与证据",hook:"先读材料，再决定它究竟能告诉我们什么。有时候，最好的判断是暂时保留。",minutes:8,objective:"区分材料直接支持的事实、相互冲突的陈述和仍然不知道的部分。",approach:{type:"evidence",reason:"历史阅读需要评估材料的范围，而非先猜一个标准答案。因此从史料对照开始，允许“信息不足”，再提出下一步调查方向。"},steps:[
 {id:"investigate",type:"investigate",title:"先问：这些材料能证明什么？",context:"以下为虚构史料练习。两位作者记录同一天的节庆。打开背景，再判断下面的陈述。",materials:[{title:"材料 A · 商人笔记",text:"“今天街上几乎没有人。”",context:"上午 7 时，码头街。作者记录自家商铺附近的行人，未观察中心广场。"},{title:"材料 B · 庆典记录",text:"“人群挤满了广场。”",context:"晚上 8 时，中心广场。作者记录庆典现场人数，没有说明参与者的态度。"}],claims:[{text:"两份材料描述的是不同时间、不同地点。",verdict:"supported",feedback:"材料背景分别指向上午码头街和晚间中心广场，因此不同场景可以同时成立。"},{text:"两位作者在同一时刻观察了同一个地点。",verdict:"contradicted",feedback:"已给出的时间与地点直接反驳这句话。这与“尚未知道”不同。"},{text:"现场所有人都热烈支持庆典的组织者。",verdict:"uncertain",feedback:"“人在场”不等于“持某种态度”。现有材料没有提供足够证据，也不能反过来断言所有人都反对。"}],reflectionPrompt:"如果要了解参与者的态度，你会寻找什么新材料？为什么？"},
 {id:"scope",type:"explain",title:"证据有范围，判断也应该有范围",paragraphs:["先检查作者在什么时间、地点，观察了什么对象。两段描述不一样，不一定互相矛盾。","身份与目的提示我们该追问什么，但不能自动判定真假。应比较具体陈述及其依据。","“信息不足”不是没有思考。知道尚未证明什么，才能提出更有用的下一步问题。"]},
 {id:"next-inquiry",type:"reflect",title:"把结论写得更诚实一点",prompt:"把“全城热烈支持这场庆典”改写为一条不超出当前材料的陈述，并说出你还想知道什么。",rubric:["只陈述目前材料实际记录的范围","区分观察到的人群与推断的态度","指出至少一个需要新证据的问题"],example:"一份记录称晚间中心广场聚集了很多人。仅据这份材料，不能判断全城居民的态度；我想找不同参与者的记述，了解他们为何到场。"}
 ],boundary:"这些材料完全虚构，仅用于方法练习。真实研究还需核对年代、版本、语言和背景。“信息不足”只针对当前材料，并不宣称真相永远无法知道。",followups:["回忆录里很生动的细节，一定可靠吗？","怎样把一个历史判断变成可核对的问题？"],sources:[archiveSource]};
export const procedureLesson:AdaptiveLesson={version:2,id:"investigation-method",title:"看到一句历史结论，怎样把它查明白？",category:"调查与方法",hook:"看一遍别人如何拆解判断，再亲手把一个大结论变成能调查的小问题。",minutes:7,objective:"将宽泛的历史断言拆成具体陈述，提出匹配的证据需求。",approach:{type:"procedure",reason:"这里的目标是完成一种操作。先展示完整思考步骤，再给新任务和可逐条请求的提示，最后对照步骤，而不先做猜答案测验。"},steps:[
 {id:"worked",type:"worked_example",title:"看一次示范，然后自己做一次",task:"虚构练习：有人说“某城庆典广场挤满了人，所以全城居民都支持组织者”。怎样查这句话？",walkthrough:[{title:"分开观察和推断",detail:"“广场有很多人”描述现场；“全城居民都支持”推断更大人群的态度。这是两件需要不同证据的事。"},{title:"明确范围与词义",detail:"是哪一天、哪个广场？“全城”包括没有到场的人吗？“支持”是主动表达，还是仅仅到场？"},{title:"寻找能区分解释的材料",detail:"找原始记录及其作者背景，再找不同参与者或未到场者的记述。每份材料都需核对，而非挑选支持自己的一段。"}],practicePrompt:"新虚构任务：“一张会场满座的照片，证明当地每个人都赞同这场演讲。”请把这句话拆开，并提出一个可调查的问题。",hints:["照片直接展示了什么？它没有展示什么？","试着把“当地每个人”和“赞同”分别检查一次。","把问题写成：要了解哪一群人在什么时刻的何种态度，我还需要什么材料？"],rubric:["区分满座这个观察与赞同这个解释","指出照片中人群与全体居民的范围差异","提出针对态度的额外证据需求"],example:"照片显示画面里的座位似乎坐满了人，但仅凭这一点无法知道他们是否赞同，更不能代表全体居民。我想调查现场不同听众对演讲的反应，寻找他们的记述，并核对照片的拍摄时间和背景。"},
 {id:"limits",type:"explain",title:"带走一套动作，也记住它的限制",paragraphs:["一个可重复的小动作是：拆开陈述 → 明确范围 → 寻找匹配证据。遇到复杂问题，可以先练这三步。","提出调查问题还不是完成调查。即使找到了更多材料，也要检查其来源与局限；有些问题暂时无法得出确定答案。"]}
 ],boundary:"场景完全虚构。这个方法只提供阅读与调查的起点，不能替代史料专业训练，也不保证每个问题都有足够材料。",followups:["不同材料互相矛盾时，如何继续调查？"],sources:[archiveSource]};
