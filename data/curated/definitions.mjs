import { readFileSync } from "node:fs";
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL("../facts/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
const countries = read("countries"),
  elements = read("elements"),
  constellations = read("constellations");
const definitions = [];
const geoSource = "https://github.com/mledoze/countries";
const chemSource = "https://github.com/Bowserinator/Periodic-Table-JSON";
const decode = (list) =>
  (Array.isArray(list) ? list : list.split("|")).map((item) =>
    typeof item === "string"
      ? (() => {
          const [answer, ...aliases] = item.split("~");
          return { answer, aliases };
        })()
      : item,
  );
function add(text, list, topic, source, note = "") {
  definitions.push({ text, answers: decode(list), topic, source, note });
}
const countryAnswer = (c) => ({
  answer: c.name.common,
  aliases: [
    c.name.official,
    ...(c.altSpellings ?? []).filter((x) => x.length > 2),
  ],
});
const geo = (text, predicate) =>
  add(
    text,
    countries.filter(predicate).map(countryAnswer),
    "geography",
    geoSource,
    "UN member states only. Country facts follow the cited dataset.",
  );
const currencyWord = (word) => (c) =>
  Object.values(c.currencies ?? {}).some((x) =>
    new RegExp("\\b" + word + "\\b", "i").test(x.name),
  );
for (const [name, code] of [
  ["Italy", "ITA"],
  ["Romania", "ROU"],
  ["Austria", "AUT"],
  ["Switzerland", "CHE"],
  ["Poland", "POL"],
  ["Tanzania", "TZA"],
  ["China", "CHN"],
  ["Thailand", "THA"],
  ["South Africa", "ZAF"],
  ["Argentina", "ARG"],
  ["DR Congo", "COD"],
]) {
  const borders = countries.find((c) => c.cca3 === code).borders;
  geo(`Name a UN member country sharing a land border with ${name}`, (c) =>
    borders.includes(c.cca3),
  );
}
geo(
  "Name a UN member country with an area greater than one million square kilometres",
  (c) => c.area > 1e6,
);
geo(
  "Name a UN member country with an area smaller than ten thousand square kilometres",
  (c) => c.area < 1e4,
);
for (const word of [
  "euro",
  "dollar",
  "franc",
  "peso",
  "rupee",
  "dinar",
  "shilling",
])
  geo(
    `Name a UN member country whose official currency name includes ${word}`,
    currencyWord(word),
  );
for (const initial of ["B", "S", "M"])
  geo(
    `Name a UN member country with a capital city beginning with ${initial}`,
    (c) => c.capital?.some((x) => x.startsWith(initial)),
  );
for (const [label, predicate] of [
  ["Europe", (c) => c.region === "Europe"],
  ["Africa", (c) => c.region === "Africa"],
  ["Asia", (c) => c.region === "Asia"],
  ["South America", (c) => c.subregion === "South America"],
  ["Oceania", (c) => c.region === "Oceania"],
]) {
  add(
    `Name a capital city of a UN member country in ${label}`,
    countries.filter(predicate).flatMap((c) => c.capital ?? []),
    "geography",
    geoSource,
    "UN member countries only. Regional grouping follows the source dataset; listed capitals are accepted.",
  );
}
geo(
  "Name a UN member country with at least five other UN member land neighbours",
  (c) =>
    (c.borders ?? []).filter((code) => countries.some((x) => x.cca3 === code))
      .length >= 5,
);
for (const [name, code] of [
  ["Portuguese", "por"],
  ["Arabic", "ara"],
  ["French", "fra"],
])
  geo(
    `Name a UN member country listing ${name} among its official languages`,
    (c) => code in (c.languages ?? {}),
  );
if (definitions.length !== 32) throw Error("Expected 32 geography questions");
const chemistry = (text, predicate) =>
  add(
    text,
    elements
      .filter(predicate)
      .map((e) => ({
        answer: e.name,
        aliases: [
          e.symbol,
          ...(e.name === "Aluminium"
            ? ["Aluminum"]
            : e.name === "Sulfur"
              ? ["Sulphur"]
              : []),
        ],
      })),
    "science",
    chemSource,
    "Recognised elements 1–118. Group and period numbers use the IUPAC 1–18 convention.",
  );
chemistry(
  "Name a chemical element with a two-letter symbol",
  (e) => e.symbol.length === 2,
);
chemistry(
  "Name a chemical element that is a gas at standard room conditions",
  (e) => e.phase === "Gas",
);
chemistry(
  "Name a chemical element classified as a metalloid in this periodic table",
  (e) => e.category === "metalloid",
);
chemistry(
  "Name a chemical element classified as a transition metal in this periodic table",
  (e) => e.category === "transition metal",
);
chemistry("Name an alkali metal", (e) => e.group === 1 && e.number !== 1);
chemistry("Name an alkaline earth metal", (e) => e.group === 2);
chemistry("Name a lanthanide element", (e) => e.category === "lanthanide");
chemistry("Name an actinide element", (e) => e.category === "actinide");
chemistry("Name a halogen element in group 17", (e) => e.group === 17);
chemistry("Name a noble gas element in group 18", (e) => e.group === 18);
chemistry(
  "Name one of the first twenty chemical elements by atomic number",
  (e) => e.number <= 20,
);
chemistry(
  "Name a transuranium element with atomic number greater than 92",
  (e) => e.number > 92,
);
for (const period of [3, 4, 5, 6])
  chemistry(
    `Name a chemical element in period ${period} of the periodic table`,
    (e) => e.period === period,
  );
for (const group of [13, 14, 16])
  chemistry(
    `Name a chemical element in group ${group} of the periodic table`,
    (e) => e.group === group,
  );
chemistry("Name any of the 118 recognised chemical elements", () => true);
chemistry("Name a chemical element whose English name ends in ium", (e) =>
  /ium$/i.test(e.name),
);
chemistry("Name a chemical element whose symbol begins with C", (e) =>
  e.symbol.startsWith("C"),
);
chemistry("Name a chemical element whose symbol begins with S", (e) =>
  e.symbol.startsWith("S"),
);
chemistry(
  "Name a chemical element whose English name and symbol begin with different letters",
  (e) => e.name[0] !== e.symbol[0],
);
if (definitions.length !== 56) throw Error("Expected 24 chemistry questions");
const units = "https://www.bipm.org/en/measurement-units";
const alphabet = "https://www.nato.int/cps/en/natohq/declassified_136216.htm";
add(
  "Name a letter of the Greek alphabet in English",
  "Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega",
  "language",
  "https://www.britannica.com/topic/Greek-alphabet",
);
add(
  "Name a word in the NATO spelling alphabet",
  "Alfa~Alpha|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Juliett~Juliet|Kilo|Lima|Mike|November|Oscar|Papa|Quebec|Romeo|Sierra|Tango|Uniform|Victor|Whiskey~Whisky|X-ray|Yankee|Zulu",
  "language",
  alphabet,
);
add(
  "Name a letter of the Hebrew alphabet using its English name",
  "Alef~Aleph|Bet~Beth|Gimel|Dalet~Daleth|He|Vav~Waw|Zayin|Het~Chet|Tet~Teth|Yod~Yodh|Kaf~Kaph|Lamed~Lamedh|Mem|Nun|Samekh|Ayin|Pe~Peh|Tsadi~Tsade~Tzadi|Qof~Kof~Qoph|Resh|Shin|Tav~Taw",
  "language",
  "https://www.unicode.org/charts/PDF/U0590.pdf",
);
add(
  "Name a letter used as a standard Roman numeral",
  "I|V|X|L|C|D|M",
  "language",
  "https://www.britannica.com/topic/Roman-numeral",
);
add(
  "Name one of the seven SI base units",
  "Metre~Meter|Kilogram|Second|Ampere~Amp|Kelvin|Mole|Candela",
  "science",
  units,
);
add(
  "Name one of the seven SI base quantities",
  "Time|Length|Mass|Electric current|Thermodynamic temperature~Temperature|Amount of substance|Luminous intensity",
  "science",
  units,
);
add(
  "Name an SI prefix that means a quantity greater than one",
  "Deca~Deka|Hecto|Kilo|Mega|Giga|Tera|Peta|Exa|Zetta|Yotta|Ronna|Quetta",
  "science",
  units,
);
add(
  "Name an SI prefix that means a quantity smaller than one",
  "Deci|Centi|Milli|Micro|Nano|Pico|Femto|Atto|Zepto|Yocto|Ronto|Quecto",
  "science",
  units,
);
add(
  "Name one of the five Platonic solids",
  "Tetrahedron|Cube~Hexahedron|Octahedron|Dodecahedron|Icosahedron",
  "maths",
  "https://mathworld.wolfram.com/PlatonicSolid.html",
);
add(
  "Name one of the thirteen Archimedean solids",
  "Truncated tetrahedron|Cuboctahedron|Truncated cube|Truncated octahedron|Rhombicuboctahedron|Truncated cuboctahedron~Great rhombicuboctahedron|Snub cube|Icosidodecahedron|Truncated dodecahedron|Truncated icosahedron|Rhombicosidodecahedron|Truncated icosidodecahedron~Great rhombicosidodecahedron|Snub dodecahedron",
  "maths",
  "https://mathworld.wolfram.com/ArchimedeanSolid.html",
);
add(
  "Name one of the eight traditional English parts of speech",
  "Noun|Pronoun|Verb|Adjective|Adverb|Preposition|Conjunction|Interjection",
  "language",
  "https://www.britannica.com/topic/part-of-speech",
);
add(
  "Name an English Scrabble letter worth three points",
  "B|C|M|P",
  "games",
  "https://scrabble.hasbro.com/en-us/rules",
);
add(
  "Name an English Scrabble letter worth four points",
  "F|H|V|W|Y",
  "games",
  "https://scrabble.hasbro.com/en-us/rules",
);
add(
  "Name an English Scrabble letter worth one point",
  "A|E|I|L|N|O|R|S|T|U",
  "games",
  "https://scrabble.hasbro.com/en-us/rules",
);
add(
  "Name one of the seven traditional rainbow colours",
  "Red|Orange|Yellow|Green|Blue|Indigo|Violet",
  "art",
  "https://www.metoffice.gov.uk/weather/learn-about/weather/optical-effects/rainbows",
);
add(
  "Name one of the sixteen basic HTML colour keywords",
  "Aqua|Black|Blue|Fuchsia|Gray~Grey|Green|Lime|Maroon|Navy|Olive|Purple|Red|Silver|Teal|White|Yellow",
  "technology",
  "https://www.w3.org/TR/css-color-3/#html4",
);
const derived = [
  ["Radian", "rad"],
  ["Steradian", "sr"],
  ["Hertz", "Hz"],
  ["Newton", "N"],
  ["Pascal", "Pa"],
  ["Joule", "J"],
  ["Watt", "W"],
  ["Coulomb", "C"],
  ["Volt", "V"],
  ["Farad", "F"],
  ["Ohm", "Ω"],
  ["Siemens", "S"],
  ["Weber", "Wb"],
  ["Tesla", "T"],
  ["Henry", "H"],
  ["Degree Celsius", "°C"],
  ["Lumen", "lm"],
  ["Lux", "lx"],
  ["Becquerel", "Bq"],
  ["Gray", "Gy"],
  ["Sievert", "Sv"],
  ["Katal", "kat"],
];
add(
  "Name an SI derived unit with a special name and a one-letter uppercase Latin symbol",
  derived.filter(([, symbol]) => /^[A-Z]$/.test(symbol)).map(([name]) => name),
  "science",
  units,
);
add(
  "Name an SI derived unit with a special name and a two-letter symbol",
  derived
    .filter(([, symbol]) => /^[A-Za-z]{2}$/.test(symbol))
    .map(([name]) => name),
  "science",
  units,
);
add(
  "Name one of the twenty-two SI derived units with special names",
  derived.map(([name]) => name),
  "science",
  units,
);
add(
  "Name one of the seven standard logic gate families",
  "AND|OR|NOT|NAND|NOR|XOR|XNOR",
  "technology",
  "https://www.allaboutcircuits.com/textbook/digital/chpt-3/logic-gate-types/",
  "Use the standard seven Boolean gate families; a buffer is not in this set.",
);
if (definitions.length !== 76)
  throw Error("Expected 20 language, maths and standards questions");
const greek = "https://www.theoi.com/";
add(
  "Name one of the nine Muses in Greek mythology",
  "Calliope|Clio|Erato|Euterpe|Melpomene|Polyhymnia|Terpsichore|Thalia|Urania",
  "culture",
  greek,
);
add(
  "Name a child of Cronus and Rhea in Greek mythology",
  "Hestia|Demeter|Hera|Hades|Poseidon|Zeus",
  "culture",
  greek,
);
add(
  "Name one of the traditional seven hills of Rome",
  "Aventine~Aventine Hill|Caelian~Caelian Hill|Capitoline~Capitoline Hill|Esquiline~Esquiline Hill|Palatine~Palatine Hill|Quirinal~Quirinal Hill|Viminal~Viminal Hill",
  "culture",
  "https://www.britannica.com/place/Seven-Hills-of-Rome",
);
add(
  "Name one of Jane Austen’s six completed novels",
  "Sense and Sensibility|Pride and Prejudice|Mansfield Park|Emma|Northanger Abbey|Persuasion",
  "literature",
  "https://janeaustens.house/jane-austen/novels/",
);
const folio =
  "https://www.folger.edu/explore/shakespeare-in-print/first-folio/";
add(
  "Name a play listed as a tragedy in Shakespeare’s First Folio",
  "Troilus and Cressida|Coriolanus|Titus Andronicus|Romeo and Juliet|Timon of Athens|Julius Caesar|Macbeth|Hamlet|King Lear|Othello|Antony and Cleopatra|Cymbeline",
  "literature",
  folio,
  "Use the 1623 First Folio classification, including Cymbeline.",
);
add(
  "Name a play listed as a history in Shakespeare’s First Folio",
  "King John|Richard II~Richard 2|Henry IV Part 1~Henry 4 Part 1|Henry IV Part 2~Henry 4 Part 2|Henry V~Henry 5|Henry VI Part 1~Henry 6 Part 1|Henry VI Part 2~Henry 6 Part 2|Henry VI Part 3~Henry 6 Part 3|Richard III~Richard 3|Henry VIII~Henry 8",
  "literature",
  folio,
);
add(
  "Name a play listed as a comedy in Shakespeare’s First Folio",
  "The Tempest|The Two Gentlemen of Verona|The Merry Wives of Windsor|Measure for Measure|The Comedy of Errors|Much Ado About Nothing|Love’s Labour’s Lost|A Midsummer Night’s Dream|The Merchant of Venice|As You Like It|The Taming of the Shrew|All’s Well That Ends Well|Twelfth Night|The Winter’s Tale",
  "literature",
  folio,
);
add(
  "Name a Pixar feature film released before 2010",
  "Toy Story|A Bug’s Life|Toy Story 2|Monsters Inc|Finding Nemo|The Incredibles|Cars|Ratatouille|WALL-E|Up",
  "film",
  "https://www.pixar.com/films",
);
add(
  "Name a Disney animated feature from the 1989–1999 Disney Renaissance",
  "The Little Mermaid|The Rescuers Down Under|Beauty and the Beast|Aladdin|The Lion King|Pocahontas|The Hunchback of Notre Dame|Hercules|Mulan|Tarzan",
  "film",
  "https://en.wikipedia.org/wiki/Disney_Renaissance",
);
add(
  "Name a member of the Beatles’ classic four-person lineup",
  "John Lennon~John|Paul McCartney~Paul|George Harrison~George|Ringo Starr~Ringo",
  "music",
  "https://www.thebeatles.com/",
);
add(
  "Name a member of ABBA",
  "Agnetha Fältskog~Agnetha|Björn Ulvaeus~Bjorn|Benny Andersson~Benny|Anni-Frid Lyngstad~Frida~Anni Frid",
  "music",
  "https://abbasite.com/",
);
add(
  "Name an original Spice Girl by her Spice nickname",
  "Scary Spice~Mel B~Melanie Brown|Sporty Spice~Mel C~Melanie Chisholm|Baby Spice~Emma Bunton|Ginger Spice~Geri Halliwell~Geri Horner|Posh Spice~Victoria Beckham~Victoria Adams",
  "music",
  "https://www.britannica.com/topic/Spice-Girls",
);
if (definitions.length !== 88) throw Error("Expected 12 culture questions");
add(
  "Name a nation that won the men’s Rugby World Cup through 2023",
  "New Zealand~All Blacks|Australia~Wallabies|South Africa~Springboks|England",
  "sport",
  "https://www.rugbyworldcup.com/",
);
add(
  "Name a nation that won the Women’s FIFA World Cup through 2023",
  "United States~USA~US|Norway|Germany|Japan|Spain",
  "sport",
  "https://www.fifa.com/en/tournaments/womens/womensworldcup",
);
add(
  "Name a nation that won the men’s UEFA European Championship through 2024",
  "Soviet Union~USSR|Spain|Italy|Germany~West Germany|Czechoslovakia|France|Netherlands~Holland|Denmark|Greece|Portugal",
  "sport",
  "https://www.uefa.com/uefaeuro/history/winners/",
  "Germany and West Germany count together. Historical winning nations are accepted.",
);
add(
  "Name a team in the men’s Six Nations rugby championship",
  "England|France|Ireland|Italy|Scotland|Wales",
  "sport",
  "https://www.sixnationsrugby.com/",
);
add(
  "Name a tennis Grand Slam tournament",
  "Australian Open|French Open~Roland Garros|Wimbledon~The Championships|US Open~United States Open",
  "sport",
  "https://www.itftennis.com/en/itf-tours/grand-slam-tournaments/",
);
add(
  "Name a discipline on the Milano Cortina 2026 Winter Olympic programme",
  "Alpine skiing|Biathlon|Bobsleigh~Bobsled|Cross-country skiing|Curling|Figure skating|Freestyle skiing|Ice hockey|Luge|Nordic combined|Short track speed skating~Short track|Skeleton|Ski jumping|Ski mountaineering~Skimo|Snowboard~Snowboarding|Speed skating",
  "sport",
  "https://www.olympics.com/en/olympic-games/milano-cortina-2026/sports",
);
add(
  "Name an event in the men’s outdoor athletics decathlon",
  "100 metres~100m|Long jump|Shot put|High jump|400 metres~400m|110 metres hurdles~110m hurdles|Discus throw~Discus|Pole vault|Javelin throw~Javelin|1500 metres~1500m",
  "sport",
  "https://worldathletics.org/disciplines/combined-events/decathlon",
);
add(
  "Name an event in the women’s outdoor athletics heptathlon",
  "100 metres hurdles~100m hurdles|High jump|Shot put|200 metres~200m|Long jump|Javelin throw~Javelin|800 metres~800m",
  "sport",
  "https://worldathletics.org/disciplines/combined-events/heptathlon",
);
add(
  "Name a ball colour used in standard snooker",
  "Red|Yellow|Green|Brown|Blue|Pink|Black",
  "sport",
  "https://wpbsa.com/governance/rules-of-snooker-and-billiards/",
);
add(
  "Name one of the six standard chess piece types",
  "King|Queen|Rook~Castle|Bishop|Knight~Horse|Pawn",
  "games",
  "https://handbook.fide.com/chapter/E012023",
);
if (definitions.length !== 98)
  throw Error("Expected 10 sport and game questions");
const nasa = "https://science.nasa.gov/solar-system/";
add(
  "Name one of the eight planets in our Solar System",
  "Mercury|Venus|Earth|Mars|Jupiter|Saturn|Uranus|Neptune",
  "space",
  nasa + "planets/",
);
add(
  "Name one of Jupiter’s four Galilean moons",
  "Io|Europa|Ganymede|Callisto",
  "space",
  nasa + "moons/jupiter-moons/",
);
add(
  "Name one of the five major moons of Uranus",
  "Miranda|Ariel|Umbriel|Titania|Oberon",
  "space",
  nasa + "moons/uranus-moons/",
);
add(
  "Name one of the seven largest moons in our Solar System by diameter",
  "Ganymede|Titan|Callisto|Io|Moon~The Moon~Luna|Europa|Triton",
  "space",
  nasa + "moons/",
);
add(
  "Name one of the twelve traditional Western zodiac signs",
  "Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces",
  "culture",
  "https://www.britannica.com/topic/zodiac",
);
add(
  "Name one of the 88 official IAU constellations",
  constellations,
  "space",
  "https://vizier.cds.unistra.fr/vizier/VizieR/constellations.htx",
);
add(
  "Name an Apollo mission that landed humans on the Moon",
  "Apollo 11~11|Apollo 12~12|Apollo 14~14|Apollo 15~15|Apollo 16~16|Apollo 17~17",
  "space",
  "https://www.nasa.gov/the-apollo-program/",
);
add(
  "Name a NASA Space Shuttle orbiter that flew in space",
  "Columbia|Challenger|Discovery|Atlantis|Endeavour~Endeavor",
  "space",
  "https://www.nasa.gov/space-shuttle/",
  "Enterprise performed atmospheric tests but did not fly in space.",
);
add(
  "Name one of NASA’s original Mercury Seven astronauts",
  "Alan Shepard|Gus Grissom~Virgil Grissom|John Glenn|Scott Carpenter~Malcolm Scott Carpenter|Wally Schirra~Walter Schirra|Gordon Cooper~Leroy Gordon Cooper|Deke Slayton~Donald Slayton",
  "space",
  "https://www.nasa.gov/history/mercury-overview/",
);
add(
  "Name one of the twelve people who walked on the Moon",
  "Neil Armstrong|Buzz Aldrin~Edwin Aldrin|Pete Conrad~Charles Conrad|Alan Bean|Alan Shepard|Edgar Mitchell|David Scott|James Irwin|John Young|Charles Duke~Charlie Duke|Eugene Cernan~Gene Cernan|Harrison Schmitt~Jack Schmitt",
  "space",
  "https://www.nasa.gov/the-apollo-program/",
);
if (definitions.length !== 108)
  throw Error("Expected 10 space and zodiac questions");
add(
  "Name one of the twenty standard protein-forming amino acids",
  "Alanine|Arginine|Asparagine|Aspartic acid~Aspartate|Cysteine|Glutamic acid~Glutamate|Glutamine|Glycine|Histidine|Isoleucine|Leucine|Lysine|Methionine|Phenylalanine|Proline|Serine|Threonine|Tryptophan|Tyrosine|Valine",
  "biology",
  "https://www.genome.gov/genetics-glossary/Amino-Acids",
  "Use the standard twenty, excluding selenocysteine and pyrrolysine.",
);
add(
  "Name one of the five nucleobases used in standard DNA or RNA",
  "Adenine|Cytosine|Guanine|Thymine|Uracil",
  "biology",
  "https://www.genome.gov/genetics-glossary/Base",
);
add(
  "Name a principal taxonomic rank from domain down to species",
  "Domain|Kingdom|Phylum|Class|Order|Family|Genus|Species",
  "biology",
  "https://www.britannica.com/science/taxonomy",
);
add(
  "Name one of the eight common ABO and Rh blood types",
  "A positive~A+|A negative~A-|B positive~B+|B negative~B-|AB positive~AB+|AB negative~AB-|O positive~O+|O negative~O-",
  "biology",
  "https://www.blood.co.uk/why-give-blood/blood-types/",
);
add(
  "Name one of the four living great-ape genera",
  "Homo|Pan|Gorilla|Pongo",
  "animals",
  "https://www.britannica.com/animal/great-ape",
  "Genera, not species. Humans belong to Homo.",
);
add(
  "Name one of the eight living bear species",
  "American black bear|Asian black bear~Asiatic black bear|Brown bear~Grizzly bear|Giant panda~Panda|Polar bear|Sloth bear|Spectacled bear~Andean bear|Sun bear",
  "animals",
  "https://www.bearbiology.org/",
);
add(
  "Name one of the five living species in the genus Panthera",
  "Lion|Tiger|Leopard|Jaguar|Snow leopard",
  "animals",
  "https://www.britannica.com/animal/Panthera",
  "Cheetahs and pumas are not members of Panthera.",
);
add(
  "Name one of Africa’s traditional Big Five game animals",
  "Lion|Leopard|Rhinoceros~Rhino~Black rhinoceros~White rhinoceros|African elephant~Elephant|African buffalo~Cape buffalo~Buffalo",
  "animals",
  "https://www.sanparks.org/",
);
add(
  "Name one of the five commonly taught French mother sauces",
  "Béchamel~Bechamel|Velouté~Veloute|Espagnole|Hollandaise|Tomato sauce~Sauce tomate",
  "food",
  "https://www.escoffier.edu/blog/culinary-arts/the-five-french-mother-sauces/",
);
add(
  "Name one of the six commonly recognised base spirits",
  "Brandy|Gin|Rum|Tequila|Vodka|Whiskey~Whisky",
  "food",
  "https://www.liquor.com/types-of-liquor-5072137",
  "Use the conventional six base-spirit families; liqueurs are not included.",
);
if (definitions.length !== 118)
  throw Error("Expected 118 core authored questions");
// Three additional questions replace three duplicate legacy prompt variants.
add(
  "Name one of the seven Harry Potter novels",
  "Harry Potter and the Philosopher’s Stone~Philosopher’s Stone~Sorcerer’s Stone~Harry Potter and the Sorcerer’s Stone|Harry Potter and the Chamber of Secrets~Chamber of Secrets|Harry Potter and the Prisoner of Azkaban~Prisoner of Azkaban|Harry Potter and the Goblet of Fire~Goblet of Fire|Harry Potter and the Order of the Phoenix~Order of the Phoenix|Harry Potter and the Half-Blood Prince~Half Blood Prince|Harry Potter and the Deathly Hallows~Deathly Hallows",
  "literature",
  "https://www.bloomsbury.com/uk/harry-potter/",
);
add(
  "Name one of Santa’s eight traditional reindeer, excluding Rudolph",
  "Dasher|Dancer|Prancer|Vixen|Comet|Cupid|Donner~Donder~Dunder|Blitzen~Blixem",
  "culture",
  "https://www.britannica.com/story/what-are-the-names-of-santas-reindeer",
);
add(
  "Name one of the six colours on a standard Rubik’s Cube",
  "White|Yellow|Red|Orange|Blue|Green",
  "games",
  "https://www.rubiks.com/",
);
if (definitions.length !== 121) throw Error("Expected 121 authored questions");
export default definitions;
