"""Generate Leviticus 22-26 commentaries and insert into DB."""
import sqlite3, json, uuid, os, pathlib
from datetime import datetime, timezone

DB_PATH = "believers_sword_commentaries.db"
PROGRESS_JSON = "commentary_generation_progress.json"
LOG_FILE = "commentary_generation_log.jsonl"
GENERATED_DIR = pathlib.Path("generated")

COLLECTION_ID = 1
COLLECTION_NAME = "Believers Sword Commentaries"
BATCH_ID = str(uuid.uuid4())

NOW = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

COMMENTARIES = [
    {
        "book_id": 3,
        "book": "Leviticus",
        "chapter": 22,
        "title": "Holy Offerings and Unblemished Sacrifices: Reverence at the Altar",
        "summary": "Leviticus 22 guards the holiness of the sacrificial system by regulating who may eat the sacred portions and requiring that all animals offered to God be without defect—pointing to the unblemished Lamb of God who takes away the sin of the world.",
        "content": "Leviticus 22 continues the extended discussion of holiness begun in chapter 17, now narrowing to two specific concerns: the protection of the holy food portions set aside for priests, and the requirement that every animal offered to the LORD be physically perfect. Together these twin concerns paint a picture of a God who is worthy of the very best and who will not accept a diminished or dishonest offering.\n\n**Who May Eat the Holy Offerings (vv. 1–16)**\nThe sacred portions allocated to priests—grain offerings, sin offerings, guilt offerings, wave offerings—are guarded by strict access rules. A priest who is ritually unclean (due to skin disease, bodily discharge, contact with the dead, or contact with an unclean animal) may not eat until he has bathed and the sun has set. The holiness of the food reflects the holiness of the God to whom it was offered, and consuming it in an unclean state would profane it.\n\nThe rules extend to the priest's household. His permanently-owned slaves may eat the holy portions, but a priest's daughter who has married a non-priest loses access. If she returns to her father's house as a widow or divorcee without children, she may eat again. The logic is one of household membership: the holy portions belong to the priestly household, and membership determines access.\n\nVerse 15 warns that the priests must not allow the holy gifts to be profaned by permitting unauthorized people to eat them. Holiness must be actively maintained, not passively assumed.\n\n**Requirements for Acceptable Sacrifices (vv. 17–33)**\nThe second section establishes that no animal offered to the LORD may have a blemish (mum). This applies whether the offering comes from an Israelite or from a resident foreigner—the standard is universal. The list of disqualifying defects is detailed: blindness, injury, mutilation, boil, scab, or discharge.\n\nA few nuanced exceptions follow:\n- An ox or sheep \"that has a limb too long or too short\" may be offered as a freewill offering but not for a vow offering (v. 23). The freewill offering, given from spontaneous generosity rather than religious obligation, permitted slightly more latitude.\n- Castrated animals are excluded (v. 24).\n- A newborn animal must remain with its mother for seven days before it may be sacrificed (v. 27)—a natural and humane provision.\n- A cow or ewe and its young must not be slaughtered on the same day (v. 28)—echoing the principle of Deuteronomy 22:6–7.\n\nThe chapter closes with its refrain: \"I am the LORD who sanctifies you\" (v. 32). God is the source of holiness; the commands do not generate holiness but respond to and preserve it.\n\n**Theological Significance**\nThe requirement that every sacrifice be without blemish is one of the Old Testament's clearest pointers to Christ. When Peter writes that believers are redeemed \"with the precious blood of Christ, like that of a lamb without blemish or spot\" (1 Peter 1:19), he is drawing directly from this passage. The Mosaic system required unblemished animals as shadows of the reality: the Son of God, who was perfectly without sin (2 Corinthians 5:21; Hebrews 4:15), offering Himself as the ultimate sacrifice. Every blemished animal rejected at the altar was a preached sermon: only a perfect offering will do.",
        "chapter_overview": "Leviticus 22 regulates access to the holy priestly food portions and requires all sacrificial animals to be without physical defect. The twin emphases—purity of those who handle holy things, and perfection of what is offered—anticipate Christ as both the unblemished sacrifice and the sinless High Priest.",
        "original_language_notes": [
            {
                "term": "mum",
                "language": "Hebrew",
                "verse": "20",
                "words_used": "blemish / defect",
                "meaning": "A physical defect disqualifying an animal from sacrifice. Used in both Leviticus 21 (for priests) and 22 (for animals), deliberately linking the purity of the offerer and the offering. The same concept applies typologically to Christ in 1 Peter 1:19."
            },
            {
                "term": "qorban",
                "language": "Hebrew",
                "verse": "18",
                "words_used": "offering / that which is brought near",
                "meaning": "From the root qarav, 'to draw near.' A sacrifice is literally 'that which draws near'—the animal or gift brought into proximity with God. The offering mediates access to God's presence."
            },
            {
                "term": "nedavah",
                "language": "Hebrew",
                "verse": "23",
                "words_used": "freewill offering",
                "meaning": "A voluntary, spontaneous offering motivated by gratitude or love rather than legal obligation. The freewill offering received slightly more latitude in animal selection, reflecting its nature as a gift of the heart rather than a fulfillment of a vow."
            },
            {
                "term": "hillel",
                "language": "Hebrew",
                "verse": "32",
                "words_used": "profane / dishonor",
                "meaning": "To make common, pierce, or defile what is holy. The opposite of qadash (to sanctify). The chapter ends with God asserting that He will not be profaned—He is the LORD who sanctifies Israel."
            }
        ],
        "moral_lessons": [
            "Offerings to God must represent our best, not our leftovers—a blemished gift dishonors the One it is meant to honor.",
            "Holiness is contagious in the right direction: handling holy things requires preparation and purity.",
            "The consistent standard for sacrifice—animal must be without defect—anticipates the only sacrifice that truly atones: Christ, without sin.",
            "Access to God's presence is a privilege that must not be taken for granted or treated carelessly."
        ],
        "application": "Leviticus 22 challenges the tendency to give God our remainders—the time left after everything else, the money left after all expenses, the energy left after personal pursuits. The unblemished sacrifice principle is not abolished in Christ; it is fulfilled in Him and reflected back to us in Romans 12:1—offering our bodies as 'living sacrifices, holy and acceptable to God.' The standard for what we bring to God has not lowered; Christ has raised it by fulfilling the ultimate requirement and now calls us to whole-hearted devotion.",
        "prayer": "Father, You accepted nothing less than perfection for the atonement of our sins, and You provided that perfection in Your Son. Forgive us for the blemished offerings we bring—half-hearted worship, distracted prayer, partial obedience. By Your Spirit, transform us into worshippers who offer You our best. Thank You for the Lamb without blemish who qualified where we could not. Amen.",
        "key_points": [
            "Holy food portions may be eaten only by ritually clean priests and qualifying household members.",
            "Every sacrificial animal must be physically unblemished—the LORD will not accept a second-rate offering.",
            "The unblemished sacrifice requirement is the OT foundation for understanding Christ as the spotless Lamb (1 Peter 1:19).",
            "Freewill offerings allowed slightly more latitude than vow offerings, reflecting the different character of spontaneous generosity.",
            "God is the sanctifier: 'I am the LORD who sanctifies you' (v. 32)—holiness is received, not manufactured."
        ],
        "study_questions": [
            "Why does the holiness of the food portions depend on the ritual state of the one consuming them?",
            "What is the theological significance of requiring unblemished animals for sacrifice?",
            "How does 1 Peter 1:19 interpret the Leviticus 22 requirement in light of Christ?",
            "What is the difference between a vow offering and a freewill offering, and what does this difference reveal about the nature of each?",
            "How does Romans 12:1 apply the 'unblemished sacrifice' principle to Christian living?"
        ],
        "tags": ["sacrifice", "holiness", "blemish", "Christ", "typology", "priestly portions", "worship"],
        "sources": ["Leviticus 22 (ESV)", "1 Peter 1:19", "Hebrews 4:15", "Romans 12:1", "2 Corinthians 5:21"]
    },
    {
        "book_id": 3,
        "book": "Leviticus",
        "chapter": 23,
        "title": "The Appointed Feasts: God's Calendar of Redemption",
        "summary": "Leviticus 23 presents the seven appointed feasts of the LORD—Sabbath, Passover, Unleavened Bread, Firstfruits, Weeks, Trumpets, Day of Atonement, and Booths—as a divine calendar that rehearses Israel's redemption and pre-figures the full sweep of Christ's saving work.",
        "content": "Leviticus 23 is one of the most theologically rich chapters in all the Old Testament. It presents seven 'appointed feasts' (mo'adim—'appointed times' or 'sacred assemblies') as God's own calendar, describing them not as Israel's feasts but as 'the LORD's appointed feasts' (v. 2). They are not merely annual holidays but rehearsals of redemptive history—enacted prophecy pointing forward to the Messiah.\n\n**The Weekly Sabbath (v. 3)**\nBefore listing the annual feasts, the LORD anchors the calendar in the weekly Sabbath. Six days of work and one day of rest mirrors creation (Genesis 2:2–3). The Sabbath is holy convocation—a sacred assembly—even in one's own home. It provides the rhythmic pulse within which all other appointed times are set.\n\n**Passover and Unleavened Bread (vv. 4–8)**\nPassover (Pesach) on the 14th of the first month (Nisan) commemorates the night God passed over the blood-marked homes of Israel in Egypt (Exodus 12). The following seven days are the Feast of Unleavened Bread—no leaven in the home, a week-long remembrance of Israel's hasty departure and the putting away of sin. These are the foundational feasts upon which Israel's identity rests.\n\nNew Testament fulfillment: Christ is our Passover lamb, sacrificed on the 14th of Nisan (1 Corinthians 5:7). He rose during the Feast of Unleavened Bread, the day after the Sabbath—the very day of Firstfruits.\n\n**Firstfruits (vv. 9–14)**\nOn the day after the Sabbath during Unleavened Bread, Israel was to wave a sheaf of the first grain harvest before the LORD. The firstfruits sheaf was not the whole harvest but its pledge—the guarantee that the rest would follow. No harvest could be eaten until the firstfruits were waved.\n\nNew Testament fulfillment: Paul explicitly calls Christ 'the firstfruits of those who have fallen asleep' (1 Corinthians 15:20, 23). His resurrection is the firstfruits guarantee that all who belong to Him will also be raised. He rose on exactly this feast day.\n\n**Weeks / Pentecost (vv. 15–22)**\nFifty days after Firstfruits (hence the Greek name Pentecost), Israel celebrated the end of the grain harvest with wave offerings of two loaves of leavened bread—the only leavened offering in the sacrificial system. The inclusion of leaven, scholars suggest, represents the incorporation of sinful humanity (leaven = sin elsewhere) into God's redeemed community.\n\nThe chapter pauses here to repeat the command to leave grain at the field edges for the poor and the sojourner (v. 22)—a startling insertion in a list of feast days, reminding Israel that proper worship is inseparable from care for the vulnerable.\n\nNew Testament fulfillment: The Holy Spirit was poured out on the Day of Pentecost (Acts 2), exactly 50 days after Christ's resurrection on Firstfruits. The church—composed of sinners from every nation—is the leavened loaves, redeemed and waved before God.\n\n**Trumpets (vv. 23–25)**\nThe first day of the seventh month (Tishri) was marked by trumpet blasts and a day of rest. The precise meaning is not explained in Leviticus, though it has traditionally been associated with divine remembrance and the gathering of God's people. In Jewish tradition this became Rosh Hashanah (New Year).\n\nNew Testament possible fulfillment: Many see this as pointing to the rapture/resurrection trumpet of 1 Thessalonians 4:16–17 and 1 Corinthians 15:52.\n\n**Day of Atonement (vv. 26–32)**\nThe 10th of Tishri is Yom Kippur—the most solemn day of the year. The people are to 'afflict themselves' (fast and humble their souls) and do no work. Anyone who fails to afflict himself is cut off from the people. The Day of Atonement is the annual cleansing of the sanctuary and the covering of all Israel's sins, described in detail in Leviticus 16.\n\nNew Testament fulfillment: Hebrews 9 interprets Christ's death as the ultimate Yom Kippur. He entered not a tent made with hands but heaven itself, with His own blood, to secure an eternal redemption.\n\n**Booths / Tabernacles (vv. 33–44)**\nThe 15th through 21st of Tishri was the Feast of Booths (Sukkot), with a solemn assembly on the 22nd. For seven days Israel lived in temporary shelters, remembering the wilderness wanderings. It was also a harvest festival—a time of great joy at the culmination of the agricultural year.\n\nNew Testament possible fulfillment: The coming Messianic Kingdom, when God will 'tabernacle' with His people (Revelation 21:3), may be the ultimate fulfillment of Booths. John 1:14—'the Word became flesh and dwelt [tabernacled] among us'—may also echo this feast.\n\n**The Calendar as Prophecy**\nThe remarkable thing about these seven feasts is that the first four (Passover, Unleavened Bread, Firstfruits, Pentecost) were all fulfilled by Christ in exact chronological sequence at His first coming. The final three (Trumpets, Atonement, Booths) remain unfulfilled—pointing to what is yet to come at His return. The calendar is not merely a liturgical schedule but a prophetic outline of redemptive history.",
        "chapter_overview": "Leviticus 23 presents seven divinely appointed feasts—Sabbath, Passover, Unleavened Bread, Firstfruits, Weeks, Trumpets, Atonement, and Booths—as God's own calendar. The first four were fulfilled in precise chronological sequence by Christ at His first coming; the final three point toward His return and the consummation of all things.",
        "original_language_notes": [
            {
                "term": "mo'adim",
                "language": "Hebrew",
                "verse": "2",
                "words_used": "appointed feasts / appointed times",
                "meaning": "From the root ya'ad, 'to appoint or meet.' The feasts are literally 'appointments'—times God set in advance to meet with His people and enact the drama of redemption. The same word is used for the Tent of Meeting (ohel mo'ed)."
            },
            {
                "term": "pesach",
                "language": "Hebrew",
                "verse": "5",
                "words_used": "Passover",
                "meaning": "From pasach, 'to pass over, to spare.' The name recalls the night the angel of death passed over blood-marked homes in Egypt. Paul uses this typology in 1 Corinthians 5:7: 'Christ our Passover has been sacrificed.'"
            },
            {
                "term": "omer",
                "language": "Hebrew",
                "verse": "10",
                "words_used": "sheaf (of grain)",
                "meaning": "A bundle or sheaf of grain—the first portion of the harvest waved before the LORD as a pledge of the full harvest to come. Paul calls the resurrected Christ the 'firstfruits' (aparche in Greek), drawing on this exact imagery."
            },
            {
                "term": "inah nefesh",
                "language": "Hebrew",
                "verse": "27",
                "words_used": "afflict yourselves / humble your souls",
                "meaning": "Literally 'to humble/afflict the soul (nefesh).' The idiom for fasting and self-humiliation on the Day of Atonement. It encompasses not just food abstention but the whole posture of broken, penitent waiting before God."
            }
        ],
        "moral_lessons": [
            "God ordains sacred rhythms of rest, remembrance, and celebration—Israel's year was shaped by worship, not merely work.",
            "The feasts teach that redemption is not a one-time memory but an annually renewed experience of God's saving acts.",
            "Care for the poor (v. 22) belongs within the calendar of worship—right liturgy and right ethics are inseparable.",
            "The fulfillment of the spring feasts in Christ builds confidence that the unfulfilled fall feasts will be equally precisely fulfilled."
        ],
        "application": "The appointed feasts teach every generation of God's people that time itself is holy—not just Sundays or special services, but all of life ordered around remembrance of what God has done. Christians observe the substance the feasts foreshadowed: the Lord's Supper rehearses Passover; baptism enacts the crossing of the Red Sea; the gift of the Spirit fulfills Pentecost. Reading Leviticus 23 with New Testament eyes transforms these feasts from ancient ceremonies into living theology, and fills the believer with confidence that the God who kept His calendar at Christ's first coming will complete it at His return.",
        "prayer": "LORD of all time and seasons, Your calendar is perfect and Your purposes will not fail. Thank You for Christ, our Passover, our Firstfruits, the One whose resurrection guarantees ours. Thank You for the Spirit poured out at Pentecost. We eagerly await the fulfillment of what remains—the trumpet call, the final atonement of all things, and the eternal Tabernacles when You will dwell with us forever. Come, Lord Jesus. Amen.",
        "key_points": [
            "The seven feasts are 'the LORD's appointed times'—divine appointments in the calendar of redemptive history.",
            "The first four spring feasts were fulfilled by Christ in exact chronological sequence at His first coming.",
            "The Day of Atonement is the theological heart of the calendar—the annual covering of sin pointing to Christ's final sacrifice (Hebrews 9).",
            "Care for the poor is embedded in the feast calendar (v. 22)—worship and justice are inseparable.",
            "The three fall feasts remain prophetic—pointing toward Christ's return and the consummation of redemption."
        ],
        "study_questions": [
            "How do the seven appointed feasts function as 'enacted prophecy'—telling the story of redemption through ritual?",
            "In what ways did Christ fulfill the first four feasts in exact sequence? How does this historical correspondence strengthen Christian faith?",
            "Why is the Feast of Weeks (Pentecost) described with leavened loaves—unlike all other grain offerings?",
            "Why does the passage interrupt the feast calendar to insert the command about leaving grain for the poor (v. 22)?",
            "What does the Feast of Booths reveal about the nature of the coming Kingdom and God's ultimate purpose for dwelling with His people?"
        ],
        "tags": ["feasts", "Passover", "Pentecost", "Atonement", "Tabernacles", "typology", "Christ", "calendar", "prophecy"],
        "sources": ["Leviticus 23 (ESV)", "1 Corinthians 5:7", "1 Corinthians 15:20-23", "Acts 2", "Hebrews 9", "John 1:14", "Revelation 21:3"]
    },
    {
        "book_id": 3,
        "book": "Leviticus",
        "chapter": 24,
        "title": "The Lampstand, the Showbread, and the Sanctity of God's Name",
        "summary": "Leviticus 24 moves from sacred time to sacred space and sacred speech: instructions for the lampstand and showbread that maintain God's presence in the tabernacle, followed by an incident of blasphemy that establishes the inviolable sanctity of the divine name and the principle of proportionate justice.",
        "content": "Leviticus 24 brings together two apparently unrelated topics—the tabernacle furnishings and a legal judgment—but they share a common thread: the holiness of God's name and the seriousness of profaning what is holy.\n\n**The Lamp and the Bread (vv. 1–9)**\nThe first section returns to themes from Exodus 25–27, providing ongoing maintenance instructions for two central tabernacle furnishings:\n\n*The Lampstand (vv. 1–4):* Pure olive oil, beaten rather than pressed, must be provided by the people to keep the seven-branched menorah burning continually before the LORD. Aaron is responsible to tend it from evening to morning. The menorah is not merely a light source but a symbol of God's presence—the light of the divine presence in the midst of Israel. Its unbroken burning represents the unbroken nature of God's covenant presence among His people.\n\n*The Showbread (vv. 5–9):* Each Sabbath, Aaron is to set out twelve loaves of bread in two rows of six on the pure gold table before the LORD—one loaf for each of the twelve tribes. Each loaf is made with two-tenths of an ephah of fine flour. Fresh incense is placed on each row. On the following Sabbath, the priests eat the bread in the holy place; Aaron and his sons receive it as a 'most holy' portion. The showbread (literally 'bread of the Presence' or 'face-bread') represents Israel's perpetual offering before God and God's perpetual provision for His people. The weekly renewal on the Sabbath ties Israel's feeding to God's covenant rhythm.\n\nThe two furnishings together—light and bread—evoke themes later developed in the New Testament. Jesus declares Himself 'the light of the world' (John 8:12) and 'the bread of life' (John 6:35). He is the reality toward which the menorah and showbread pointed.\n\n**The Blasphemy Incident and Its Aftermath (vv. 10–23)**\nA jarring narrative interrupts: the son of an Israelite woman and an Egyptian man gets into a fight with an Israelite man and 'blasphemes the Name and curses' (v. 11). Moses brings him to the LORD for judgment. The verdict is stunning in its clarity: the blasphemer must be stoned to death. The principle is universal—whether Israelite or foreigner, 'whoever blasphemes the name of the LORD shall be put to death' (v. 16).\n\nThe principle of equal application is then extended into the lex talionis: fracture for fracture, eye for eye, tooth for tooth. The well-known phrase has often been misread as a license for vengeance, but its original function was exactly the opposite—it was a *limit* on punishment, ensuring that punishment is proportionate to the offense and equal before the law regardless of social status. The foreigner is treated identically to the native Israelite: one standard for all.\n\nMoses executes the judgment as commanded, and the chapter ends with a formulaic note: 'The people of Israel did as the LORD commanded Moses.'\n\n**The Theology of the Name**\nWhy is blasphemy of the divine name a capital offense? Because the name of God is not merely a label—it is a revelation of His character, His identity, and His covenant relationship with Israel. In the ancient world, a name carried the essence of its bearer. To blaspheme the Name is not to insult a word but to assault the character of the living God who has graciously revealed Himself. The severity of the penalty reflects the immense dignity of the One whose name has been attacked.\n\nThis connects directly to the Third Commandment: 'You shall not take the name of the LORD your God in vain' (Exodus 20:7). The Hebrew for 'in vain' is la-shav—for emptiness, for worthlessness. Using God's name without weight, without reverence, or in cursing is to treat as worthless the most precious revelation in creation.",
        "chapter_overview": "Leviticus 24 combines maintenance instructions for the tabernacle lampstand and showbread with a case law about blasphemy. Together, these establish the theology of God's ongoing presence among His people (light and bread) and the inviolable sanctity of His name, enforced through proportionate, impartial justice.",
        "original_language_notes": [
            {
                "term": "ha-Shem",
                "language": "Hebrew",
                "verse": "11",
                "words_used": "the Name",
                "meaning": "The divine name YHWH was so sacred that later Jewish practice substituted 'ha-Shem' ('the Name') in speech. Verse 11's blasphemer 'blasphemed the Name'—attacking the covenant identity and character of the LORD Himself."
            },
            {
                "term": "lechem ha-panim",
                "language": "Hebrew",
                "verse": "5",
                "words_used": "bread of the Presence / showbread",
                "meaning": "Literally 'bread of faces/presence.' The loaves were set before the face of God—a perpetual, visible gift representing Israel's dependence on God and His provision for them. Jesus echoes this as 'the bread of life' in John 6."
            },
            {
                "term": "menorah",
                "language": "Hebrew",
                "verse": "4",
                "words_used": "lampstand",
                "meaning": "The seven-branched golden lampstand, beaten from a single piece of gold (Exodus 25:31). Its unbroken flame symbolized God's continuous, faithful presence with Israel. The seven lamps later appear in Revelation 1 as the seven churches—those who bear God's light in the world."
            },
            {
                "term": "ayin tachat ayin",
                "language": "Hebrew",
                "verse": "20",
                "words_used": "eye for eye",
                "meaning": "The lex talionis—proportionate justice. The phrase establishes a ceiling on punishment, not a floor. Its purpose is equal justice under the law regardless of social standing, not a mandate for personal revenge. Jesus reinterprets this in Matthew 5:38–39, moving from judicial principle to personal ethics."
            }
        ],
        "moral_lessons": [
            "The things of God—His name, His presence, His word—are to be handled with reverence, not carelessness.",
            "The same standard applies to everyone: impartial justice reflects the impartial character of God.",
            "God's presence is not automatic or self-sustaining from the human side—it requires ongoing maintenance, offering, and attention.",
            "The lex talionis is not a charter for vengeance but a limit on it—justice means proportionate, equal response."
        ],
        "application": "The principle behind the lampstand and showbread still applies: maintaining the light of God's presence in the church requires ongoing effort, offering, and Sabbath-rhythmed renewal. The sobering incident with the blasphemer warns against casual or contemptuous use of God's name—whether in speech, in liturgy, or in life. The Third Commandment is still in force. And Jesus' radical expansion of the lex talionis (Matthew 5:38–42) does not abolish proportionate justice in civil society; it calls individuals to a higher personal ethic of grace.",
        "prayer": "Holy Father, Your name is great and Your presence is our life. Forgive us for careless speech and half-hearted worship. Keep the light burning in our hearts and communities—the light of Your Word, Your Spirit, and Your Son, who declared Himself the light of the world and the bread of life. May we handle holy things with holy reverence. Amen.",
        "key_points": [
            "The menorah must burn continually—God's presence in the tabernacle is perpetual, not occasional.",
            "The twelve loaves of showbread represent Israel's perpetual offering before God and God's provision for all twelve tribes.",
            "Blasphemy of the divine name is a capital offense because the name reveals God's character and covenant identity.",
            "The lex talionis establishes proportionate, impartial justice—a ceiling on punishment, not a mandate for vengeance.",
            "Jesus identifies Himself as the fulfillment of both the lampstand ('light of the world') and the showbread ('bread of life')."
        ],
        "study_questions": [
            "What does the perpetual burning of the menorah communicate about God's relationship with Israel?",
            "Why is the showbread renewed weekly on the Sabbath? What is the theological significance of that timing?",
            "Why is blasphemy treated as a capital crime in Israel? What does this reveal about the nature of God's name?",
            "How does the lex talionis function as a limit on punishment rather than a license for it? How does Jesus build on this principle in Matthew 5?",
            "In what ways do the lampstand and showbread point forward to Christ?"
        ],
        "tags": ["lampstand", "showbread", "blasphemy", "divine name", "lex talionis", "justice", "presence", "Christ"],
        "sources": ["Leviticus 24 (ESV)", "John 6:35", "John 8:12", "Exodus 25:31", "Matthew 5:38-39", "Revelation 1:12-13"]
    },
    {
        "book_id": 3,
        "book": "Leviticus",
        "chapter": 25,
        "title": "Sabbath Year and Jubilee: God's Economics of Grace",
        "summary": "Leviticus 25 establishes the sabbatical year and the Year of Jubilee as God's radical economic calendar—rest for the land, liberation for debt-slaves, and the return of family land—grounding Israel's social order in the theological reality that the earth belongs to the LORD and all Israelites are His servants.",
        "content": "Leviticus 25 is one of the most socially revolutionary chapters in the entire Bible. It establishes two interrelated institutions—the Sabbatical Year (every seventh year) and the Jubilee (every fiftieth year)—that restructure Israel's economic life around theological principles rather than market forces. At the heart of the chapter is a simple, world-inverting declaration: 'the land is mine' (v. 23). If the land belongs to God, then Israelites are not owners but stewards; and if the people belong to God (v. 55), then permanent human slavery is impossible.\n\n**The Sabbatical Year (vv. 1–7)**\nEvery seventh year, the land is to lie fallow. No sowing, pruning, or commercial harvesting. What grows by itself may be eaten by the owner, servants, hired workers, resident aliens, and even livestock and wild animals—but there is no commercial crop. The land 'rests' (shabbat) as a Sabbath to the LORD.\n\nThis is not simply good ecology (though it is that—soil needs periodic rest). It is a profound theological statement: Israel does not own the land; they are tenants. The land's rest is an acted-out acknowledgment that the LORD is the ultimate owner.\n\n**The Jubilee Year (vv. 8–55)**\nAfter seven sabbatical cycles (49 years), the 50th year is proclaimed by a trumpet blast on Yom Kippur: the Jubilee year. Three transformations occur:\n\n*1. Liberty throughout the land (vv. 8–17):* All sold land reverts to its original tribal family. Economic transactions from the previous Jubilee cycle are calculated accordingly—you are effectively buying years of use, not permanent title.\n\n*2. Trust in God's provision (vv. 18–22):* The natural anxiety is: what will we eat in the seventh year (when we cannot plant) and the following eighth year (when the new crop is not yet harvested)? God's answer: 'I will command my blessing on you in the sixth year, so that it will produce a crop sufficient for three years' (v. 21). The Jubilee requires radical trust in divine provision.\n\n*3. Redemption of persons (vv. 23–55):* If an Israelite falls into poverty and must sell himself or his land, both may be redeemed by a kinsman-redeemer (go'el)—a relative who pays the redemption price. If no redeemer is available, the Jubilee liberates both the person and the land at the 50th year. Importantly, Israelites may not be treated as permanent slaves—they are 'servants of the LORD' and may not be enslaved by one another permanently.\n\nThe institution of the kinsman-redeemer (go'el) is one of the Old Testament's richest theological concepts. Boaz functions as Ruth's go'el in the book of Ruth. More significantly, the concept becomes a central metaphor for God Himself—Isaiah 41:14, 43:14, 44:6 all call God the go'el of Israel. And supremely, Christ functions as our go'el: He pays our redemption price, restores our forfeited inheritance, and liberates us from bondage.\n\n**Jubilee and the Kingdom**\nJesus' inaugural sermon at Nazareth (Luke 4:18–19) quotes Isaiah 61—a passage that itself draws on Jubilee language. 'The Spirit of the Lord is upon me… to proclaim liberty to captives… to proclaim the year of the Lord's favor.' Jesus announces that Jubilee has arrived in Him—the ultimate liberation of those enslaved to sin and the restoration of the inheritance forfeited at the Fall.",
        "chapter_overview": "Leviticus 25 establishes the Sabbatical Year and Jubilee Year as God's economic calendar—built on the theological foundation that land and people belong to God, not to human masters. The kinsman-redeemer institution anticipates Christ as our go'el who pays our redemption price and restores our inheritance.",
        "original_language_notes": [
            {
                "term": "yovel",
                "language": "Hebrew",
                "verse": "10",
                "words_used": "Jubilee",
                "meaning": "Possibly derived from the ram's horn (yoveil) blown to proclaim the Jubilee, or from a root meaning 'to be carried along.' The Jubilee is the year of liberation, return, and restoration—proclaimed by the blowing of the shofar on Yom Kippur."
            },
            {
                "term": "go'el",
                "language": "Hebrew",
                "verse": "25",
                "words_used": "kinsman-redeemer / avenger",
                "meaning": "The close relative with the right and obligation to redeem a family member's land or person. From ga'al, 'to redeem, restore, avenge.' God is Israel's go'el (Isaiah 44:6); Christ is our go'el—paying the redemption price to restore what was lost."
            },
            {
                "term": "deror",
                "language": "Hebrew",
                "verse": "10",
                "words_used": "liberty / freedom",
                "meaning": "A specific term for the proclamation of release, especially in Jubilee contexts. Isaiah 61:1 uses this same word for the freedom the Servant of the LORD will proclaim—the passage Jesus quotes in Luke 4:18 to announce His ministry as Jubilee fulfillment."
            },
            {
                "term": "shabbat shabbaton",
                "language": "Hebrew",
                "verse": "4",
                "words_used": "sabbath of solemn rest",
                "meaning": "A doubled emphatic—'a Sabbath of Sabbaths'—indicating the intensified rest of the sabbatical year for the land. The same phrase is used for the Day of Atonement (Lev. 16:31). The most sacred rest is applied to the land itself."
            }
        ],
        "moral_lessons": [
            "Ultimate ownership belongs to God—human beings are stewards, not absolute owners of land, money, or people.",
            "Economic systems must include mechanisms for the restoration of the vulnerable; cyclical debt and slavery cannot be God's permanent design for His image-bearers.",
            "Trust in God's provision must be practical, not just theoretical—the Jubilee required actual financial risk based on divine promise.",
            "The concept of the kinsman-redeemer reveals that God's justice is not impersonal but deeply relational—someone near to us pays our debt."
        ],
        "application": "Leviticus 25 is not directly applicable as civil law for modern nations, but its theological principles are timeless. The earth belongs to the LORD (Psalm 24:1); human beings are stewards. The liberation announced in Jubilee is fulfilled in Christ—He has proclaimed the year of the LORD's favor (Luke 4:18–19), liberating those enslaved to sin and restoring the forfeited inheritance. The church is called to embody Jubilee ethics: generous care for the poor, advocacy for those trapped in cycles of poverty, and the proclamation of the ultimate liberation that only Christ provides.",
        "prayer": "LORD God, the earth is Yours and everything in it. Forgive us for grasping what we cannot own and for failing to care for those whose resources have been stripped away. Thank You for Christ, our kinsman-redeemer, who paid the full price for our liberation. Grant us Jubilee hearts—generous, liberating, restorative—and hasten the day when Your Kingdom comes in its fullness and all things are made new. Amen.",
        "key_points": [
            "The Sabbatical Year (every 7th) rests the land as an acknowledgment that it belongs to God, not Israel.",
            "The Jubilee Year (every 50th) returns sold land to original families and liberates Israelite debt-servants.",
            "The kinsman-redeemer (go'el) is Israel's mechanism for personal redemption—anticipating Christ as our divine go'el.",
            "The Jubilee is grounded in one principle: 'the land is mine' (v. 23) and 'the people of Israel are my servants' (v. 55).",
            "Jesus' inaugural sermon at Nazareth (Luke 4:18–19) announces Himself as the fulfillment of Jubilee—the ultimate year of the LORD's favor."
        ],
        "study_questions": [
            "How does the theological principle 'the land is mine' (v. 23) undermine both absolute ownership and permanent slavery?",
            "What anxieties would the Sabbatical and Jubilee years create, and how does God address them? What does this require of Israel?",
            "How does the institution of the kinsman-redeemer (go'el) function theologically? In what ways does Christ fulfill this role?",
            "How does Jesus' use of Isaiah 61 in Luke 4:18–19 connect His ministry to Jubilee themes?",
            "What aspects of Jubilee ethics should inform how Christians think about economics, poverty, and wealth today?"
        ],
        "tags": ["Jubilee", "sabbatical year", "redemption", "kinsman-redeemer", "go'el", "liberty", "economics", "Christ", "stewardship"],
        "sources": ["Leviticus 25 (ESV)", "Luke 4:18-19", "Isaiah 61:1-2", "Isaiah 44:6", "Ruth 4", "Psalm 24:1"]
    },
    {
        "book_id": 3,
        "book": "Leviticus",
        "chapter": 26,
        "title": "Covenant Blessings and Curses: The Stakes of the Covenant",
        "summary": "Leviticus 26 presents the covenant's two trajectories in stark relief—lavish blessing for obedience and escalating judgment for persistent rebellion—framed by God's covenant promise to remember and restore even the most wayward Israel, pointing forward to the gospel of grace.",
        "content": "Leviticus 26 is the great covenant warning chapter—a counterpart to Deuteronomy 28 and one of the Bible's most powerful presentations of the reality that covenant relationship with God is not automatic or unconditional. It stands as the climax of the Leviticus legislation, summarizing the stakes with terrifying clarity and astonishing mercy.\n\n**The Foundation (vv. 1–2)**\nBefore listing blessings and curses, the chapter restates the two most fundamental demands: no idols, no graven images; keep the Sabbaths; reverence the sanctuary. These three commands (related to the first and fourth commandments) are the heart of the covenant relationship—they define what it means to have the LORD as your God.\n\n**The Blessings of Obedience (vv. 3–13)**\nIf Israel walks in God's statutes and keeps His commands, the result will be:\n- Rain in its season and abundant harvests—the land itself will cooperate with Israel's faithfulness.\n- Peace in the land—no predators, no sword, lying down in safety.\n- Victory over enemies—five will chase a hundred, a hundred will chase ten thousand.\n- Fruitfulness and multiplication.\n- God walking among them and being their God—the covenant formula fulfilled: 'I will walk among you and will be your God, and you shall be my people' (v. 12).\n\nThe blessing is not merely material—it is relational. The highest promise is God's presence. The land of milk and honey is wonderful, but what makes Israel truly blessed is that the LORD Himself walks among them.\n\n**The Escalating Curses (vv. 14–39)**\nIf Israel refuses to obey, the consequences are presented in five escalating 'waves,' each introduced by the phrase 'if you will not listen to me' and 'if despite this you will not listen.' The pattern is critical: the curses are not immediate destruction but a graduated series of corrective disciplines, each more severe than the last:\n\n1. *First wave (vv. 14–17):* Terror, disease, crop failure, defeat by enemies.\n2. *Second wave (vv. 18–20):* Sevenfold punishment, iron sky (no rain), bronze earth (barren soil).\n3. *Third wave (vv. 21–22):* Wild animals that bereave Israel of children and destroy livestock.\n4. *Fourth wave (vv. 23–26):* Sword, pestilence, famine—ten women baking bread in a single oven (a sign of desperate scarcity).\n5. *Fifth wave (vv. 27–39):* Siege, cannibalism of children, destruction of high places, scattered among the nations, pursued by the sound of a blowing leaf.\n\nThe escalating structure reveals that the curses are not punitive vengeance but corrective discipline. God says 'seven times' because He is not trying to destroy Israel but to bring them back. The increase of punishment corresponds to the increase of stubborn rebellion.\n\n**The Promise of Restoration (vv. 40–46)**\nThis is the chapter's stunning reversal. After the terror of the fifth wave, the chapter turns: if the exiled Israel confesses their iniquity and the iniquity of their fathers, if they humble their uncircumcised hearts and accept their punishment, God will remember His covenant with Jacob, Isaac, and Abraham—and with the land. He will not utterly destroy them or break His covenant with them.\n\nThis passage is the theological basis for the prophets' message of hope. Isaiah, Jeremiah, Ezekiel, and the post-exilic books all draw on the restoration promise of Leviticus 26. Even in the exile—the most extreme application of the fifth-wave curse—the door of restoration remains open because the covenant is grounded in God's faithfulness, not Israel's performance.\n\nThe chapter ends with the covenant formula: these are the statutes that God made with Israel at Sinai. The Mosaic covenant is not the final word—it reveals the problem (Israel cannot keep it) and points to the solution: the new covenant in which God will circumcise hearts (Deuteronomy 30:6) and write His law within (Jeremiah 31:33).",
        "chapter_overview": "Leviticus 26 presents the covenant's dual outcome: magnificent blessing for obedience (culminating in God's presence) and five escalating waves of discipline for rebellion. But the chapter's most surprising element is its restoration promise—even in exile, God will remember His covenant. This sets the theological stage for the prophets and for the new covenant in Christ.",
        "original_language_notes": [
            {
                "term": "chukotim",
                "language": "Hebrew",
                "verse": "3",
                "words_used": "statutes",
                "meaning": "From chaqaq, 'to inscribe, engrave.' The statutes are literally 'engraved' ordinances—permanent, binding, not optional. The chapter opens with the requirement to walk in these inscribed ways."
            },
            {
                "term": "hithalekti",
                "language": "Hebrew",
                "verse": "12",
                "words_used": "I will walk among you",
                "meaning": "From halak (to walk) in the hitpael reflexive stem—'I will walk back and forth among you.' The same verb is used for God walking in Eden (Genesis 3:8). The covenant blessing restores the garden intimacy lost at the Fall."
            },
            {
                "term": "arlu lev",
                "language": "Hebrew",
                "verse": "41",
                "words_used": "uncircumcised heart",
                "meaning": "The heart not yet cut away from its rebellion and self-sufficiency. The image picks up the covenant sign of circumcision and applies it to the inner life. The cure is not physical but spiritual—Deuteronomy 30:6 promises that God Himself will circumcise the heart; Paul picks this up in Romans 2:29 and Colossians 2:11."
            },
            {
                "term": "zacharti",
                "language": "Hebrew",
                "verse": "42",
                "words_used": "I will remember",
                "meaning": "From zachar, 'to remember'—but in Hebrew, divine remembering is not merely cognitive recall; it is covenantal action. When God 'remembers,' He acts in accordance with the relationship. 'I will remember my covenant' means 'I will act faithfully according to my covenant commitment.'"
            }
        ],
        "moral_lessons": [
            "The blessings and curses of Leviticus 26 reveal that obedience and disobedience have real consequences—moral cause and effect is built into God's governance of the world.",
            "God's discipline is graduated and corrective, not immediately destructive—the escalation pattern reveals a God who pursues relationship, not judgment.",
            "The highest blessing is not prosperity but God's presence: 'I will walk among you and will be your God.'",
            "Even the worst failure cannot eliminate God's covenant memory—the door of repentance and restoration always remains open."
        ],
        "application": "Leviticus 26 presents the covenant's stakes in stark terms, but its last word is grace. This pattern—obedience leads to blessing, disobedience to discipline, repentance to restoration—runs through all of Scripture and through every believer's life. The new covenant in Christ means we face no condemnation (Romans 8:1), but the principle of sowing and reaping remains (Galatians 6:7). God disciplines those He loves (Hebrews 12:5–11). And when we confess and return, He is faithful and just to forgive (1 John 1:9). The story of Leviticus 26 is the story of every prodigal—and every prodigal's Father.",
        "prayer": "LORD, You are faithful even when we are faithless. Thank You for the graduated patience of Your discipline—that You pursue us with correction before destruction, and that even in exile Your face does not turn away permanently. Thank You that in Christ, the full weight of covenant curse has fallen on Him so that covenant blessing might be ours. Restore us, renew our hearts, and walk among us again. Amen.",
        "key_points": [
            "The covenant blessings culminate not in prosperity but in God's presence walking among His people.",
            "The curses are graduated across five waves, each preceded by an opportunity for repentance—they are corrective, not merely punitive.",
            "Leviticus 26:40–46 is the restoration promise that grounds the prophets' hope in exile—God will remember His covenant.",
            "The 'uncircumcised heart' (v. 41) is the underlying problem; God promises circumcision of the heart as the ultimate cure (Deuteronomy 30:6).",
            "Christ bears the full weight of the covenant curses (Galatians 3:13) so that Leviticus 26's blessings may be received by faith."
        ],
        "study_questions": [
            "What is the significance of the five escalating waves of discipline? What does the graduated structure reveal about God's character and purpose?",
            "Why does the passage say 'I will walk among you' (v. 12) is the climax of the blessings? What does this reveal about God's ultimate goal?",
            "How does the restoration promise in vv. 40–46 function as the theological foundation for the prophets' message of hope in exile?",
            "What does 'uncircumcised heart' mean, and how does Deuteronomy 30:6 and the new covenant address this problem?",
            "How does Galatians 3:13 interpret Christ's death in light of the covenant curses of Leviticus 26 and Deuteronomy 28?"
        ],
        "tags": ["covenant", "blessings", "curses", "obedience", "discipline", "restoration", "exile", "presence", "grace"],
        "sources": ["Leviticus 26 (ESV)", "Deuteronomy 28", "Deuteronomy 30:6", "Jeremiah 31:33", "Galatians 3:13", "Romans 8:1", "Hebrews 12:5-11"]
    }
]


def get_or_create_collection(conn):
    c = conn.cursor()
    c.execute("SELECT id FROM commentary_collections WHERE slug='believers-sword-commentaries'")
    row = c.fetchone()
    if row:
        return row[0]
    c.execute("""
        INSERT INTO commentary_collections (name, slug, language_code, description, created_at, updated_at)
        VALUES (?, ?, 'en', 'Believers Sword Bible Commentaries', ?, ?)
    """, (COLLECTION_NAME, 'believers-sword-commentaries', NOW, NOW))
    conn.commit()
    return c.lastrowid


def chapter_exists(conn, collection_id, book_id, chapter):
    c = conn.cursor()
    c.execute("""
        SELECT id, content FROM commentary_entries
        WHERE collection_id=? AND book_id=? AND chapter=? AND language_code='en'
          AND reference_scope='chapter' AND deleted_at IS NULL
    """, (collection_id, book_id, chapter))
    row = c.fetchone()
    if not row:
        return False
    content = row[1] or ""
    return len(content) > 300


def insert_entry(conn, collection_id, entry):
    c = conn.cursor()
    entry_uuid = str(uuid.uuid4())
    c.execute("""
        INSERT INTO commentary_entries (
            uuid, collection_id, author_type, language_code, theological_perspective,
            status, book_id, chapter, verse_start, verse_end, reference_scope,
            title, summary, content, chapter_overview, original_language_notes,
            moral_lessons, application, prayer, key_points, study_questions,
            tags, sources, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        entry_uuid, collection_id, "ai", "en", "evangelical",
        "draft", entry["book_id"], entry["chapter"], "chapter",
        entry["title"], entry["summary"], entry["content"],
        entry["chapter_overview"],
        json.dumps(entry["original_language_notes"]),
        json.dumps(entry["moral_lessons"]),
        entry["application"], entry["prayer"],
        json.dumps(entry["key_points"]),
        json.dumps(entry["study_questions"]),
        json.dumps(entry["tags"]),
        json.dumps(entry["sources"]),
        NOW, NOW
    ))
    conn.commit()
    return entry_uuid


def save_json_backup(entry, entry_uuid):
    book_id_str = str(entry["book_id"]).zfill(2)
    book_slug = entry["book"].lower().replace(" ", "-")
    folder = GENERATED_DIR / f"{book_id_str}-{book_slug}"
    folder.mkdir(parents=True, exist_ok=True)
    chapter_str = str(entry["chapter"]).zfill(2)
    filepath = folder / f"{chapter_str}.json"
    data = {
        "uuid": entry_uuid,
        "collection_name": COLLECTION_NAME,
        "author_type": "ai",
        "language_code": "en",
        "theological_perspective": "evangelical",
        "status": "draft",
        "book_id": entry["book_id"],
        "book": entry["book"],
        "chapter": entry["chapter"],
        "title": entry["title"],
        "summary": entry["summary"],
        "content": entry["content"],
        "chapter_overview": entry["chapter_overview"],
        "original_language_notes": entry["original_language_notes"],
        "moral_lessons": entry["moral_lessons"],
        "application": entry["application"],
        "prayer": entry["prayer"],
        "key_points": entry["key_points"],
        "study_questions": entry["study_questions"],
        "tags": entry["tags"],
        "sources": entry["sources"],
        "created_at": NOW,
        "updated_at": NOW
    }
    # Verify no forbidden keys
    for fk in ["is_ai_generated", "model_name", "prompt_version"]:
        assert fk not in data, f"Forbidden key {fk} found!"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return str(filepath)


def update_progress(conn, next_book_id, next_book, next_chapter,
                    last_book_id, last_book, last_chapter, completed=False):
    c = conn.cursor()
    c.execute("SELECT id FROM commentary_generation_progress LIMIT 1")
    row = c.fetchone()
    data = {
        "next_book_id": next_book_id,
        "next_book": next_book,
        "next_chapter": next_chapter,
        "last_completed_book_id": last_book_id,
        "last_completed_book": last_book,
        "last_completed_chapter": last_chapter,
        "completed": completed,
        "updated_at": NOW
    }
    if row:
        c.execute("""
            UPDATE commentary_generation_progress
            SET next_book_id=?, next_book=?, next_chapter=?,
                last_completed_book_id=?, last_completed_book=?, last_completed_chapter=?,
                completed=?, updated_at=?
            WHERE id=?
        """, (next_book_id, next_book, next_chapter,
              last_book_id, last_book, last_chapter,
              1 if completed else 0, NOW, row[0]))
    else:
        c.execute("""
            INSERT INTO commentary_generation_progress
            (next_book_id, next_book, next_chapter, last_completed_book_id,
             last_completed_book, last_completed_chapter, completed, updated_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (next_book_id, next_book, next_chapter,
              last_book_id, last_book, last_chapter,
              1 if completed else 0, NOW))
    conn.commit()
    with open(PROGRESS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def append_log(batch_id, start_ref, end_ref, generated, skipped, db_inserted, files_written):
    entry = {
        "timestamp": NOW,
        "generation_batch_id": batch_id,
        "start_reference": start_ref,
        "end_reference": end_ref,
        "chapters_generated": generated,
        "chapters_skipped": skipped,
        "db_rows_inserted": db_inserted,
        "files_written": files_written
    }
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def main():
    conn = sqlite3.connect(DB_PATH)
    collection_id = get_or_create_collection(conn)

    generated_count = 0
    skipped_count = 0
    db_inserted = 0
    files_written = []
    last_entry = None

    for entry in COMMENTARIES:
        book_id = entry["book_id"]
        book = entry["book"]
        chapter = entry["chapter"]

        if chapter_exists(conn, collection_id, book_id, chapter):
            print(f"SKIP: {book} {chapter} (already exists)")
            skipped_count += 1
            last_entry = entry
            continue

        entry_uuid = insert_entry(conn, collection_id, entry)
        filepath = save_json_backup(entry, entry_uuid)

        # Verify JSON parses and has no forbidden keys
        with open(filepath, "r", encoding="utf-8") as f:
            parsed = json.load(f)
        for fk in ["is_ai_generated", "model_name", "prompt_version"]:
            assert fk not in parsed, f"Forbidden key {fk} in {filepath}!"

        print(f"GENERATED: {book} {chapter} -> {filepath} (uuid={entry_uuid})")
        generated_count += 1
        db_inserted += 1
        files_written.append(filepath)
        last_entry = entry

    # Determine next progress
    # Leviticus has 27 chapters; after ch 26, next is ch 27
    next_chapter = 27  # Leviticus 27
    next_book_id = 3
    next_book = "Leviticus"
    last_book_id = 3
    last_book = "Leviticus"
    last_chapter = 26

    update_progress(conn, next_book_id, next_book, next_chapter,
                    last_book_id, last_book, last_chapter)

    start_ref = f"Leviticus 22"
    end_ref = f"Leviticus 26"
    append_log(BATCH_ID, start_ref, end_ref, generated_count, skipped_count, db_inserted, files_written)

    conn.close()
    print(f"\nDone. Generated={generated_count}, Skipped={skipped_count}, DB rows={db_inserted}, Files={len(files_written)}")
    print(f"Next: {next_book} {next_chapter}")


if __name__ == "__main__":
    main()
