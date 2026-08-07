/* WordSplit — segmentation engine
 * Breaks a word into prefix(es) + root + suffix(es) using the morpheme
 * database, scores every plausible reading, and returns the best one.
 */
(function () {
  const FORM_MAP = window.WS_FORM_MAP;
  const SORTED = window.WS_SORTED_FORMS;

  /* Words whose real history disagrees with a greedy match, plus common
   * words the scorer would otherwise over-split. Format: "pre-root-suf",
   * with the piece kind implied by position. A leading "=" means "do not
   * split this word at all". */
  const OVERRIDES = {
    understand: "=",
    important: "=",
    interest: "=",
    person: "=",
    reason: "=",
    problem: "=",
    present: "=",
    remain: "=",
    consider: "=",
    country: "=",
    company: "=",
    number: "=",
    member: "=",
    mother: "=",
    father: "=",
    brother: "=",
    another: "=",
    together: "=",
    weather: "=",
    center: "=",
    letter: "=",
    matter: "=",
    water: "=",
    winter: "=",
    summer: "=",
    banana: "=",
    manner: "=",
    corner: "=",
    dinner: "=",
    father_: "=",
    canton: "=",
    parent: "=",
    percent: "=",
    machine: "=",
    minute: "=",
    second: "=",
    system: "=",
    /* Everyday words the search would otherwise pull apart at a coincidence:
     * "cover" is not co + ver (true), "across" is not acr (sharp) + ose.
     * Left whole, or corrected where the real parts are known. */
    abate: "=", sinister: "=", across: "=", acid: "=", alarm: "=", angle: "=", angry: "=", armor: "=",
    article: "=", astonish: "=", average: "=", beverage: "=", body: "=",
    city: "=", comedian: "=", copy: "=", cover: "=", discover: "=",
    recover: "=", uncover: "=", eager: "=", enter: "=", environment: "=",
    estate: "=", evaporate: "=", evening: "=", examine: "=", forever: "=",
    image: "=", imagine: "=", individual: "=", input: "=", output: "=",
    label: "=", level: "=", many: "=", marry: "=", medal: "=", mineral: "=",
    necessary: "=", open: "=", pile: "=", pioneer: "=", quiet: "=",
    regard: "=", salary: "=", savage: "=", season: "=", secure: "=",
    seven: "=", several: "=", stage: "=", star: "=", start: "=", stay: "=",
    steal: "=", steel: "=", steer: "=", sting: "=", storage: "=", story: "=",
    stress: "=", theory: "=", tiny: "=", under: "=", unite: "=", valley: "=",
    very: "=", vowel: "=", apparatus: "=", inside: "=",
    common: "com|mun|",
    council: "co|cili|",
    distance: "dis|sta|ance",
    party: "|part|y",
    bilingual: "bi|lingu|al",
    antagonist: "anti|agon|ist",

    /* A long suffix must not swallow the tail of the root: these teach the
     * model to keep "cret" over "cre"+"tion", "volut" over "vol"+"ute". */
    convolute: "con|volut|",
    convoluted: "con|volut|",
    evolution: "e|volut|ion",
    revolution: "re|volut|ion",
    accretion: "ad|cret|ion",
    discretion: "dis|cret|ion",
    discreet: "dis|cret|",
    secrete: "se|cret|",
    benediction: "bene|dict|ion",
    malediction: "mal|dict|ion",
    interdict: "inter|dict|",
    edict: "e|dict|",
    indict: "in|dict|",
    epigram: "epi|gram|",
    annex: "ad|nex|",
    apotheosis: "apo|the|osis",
    reticent: "re|tac|ent",
    /* neg- "not" fused onto leg/lig "to choose": what is not picked out */
    neglect: "neg|lect|",
    negligent: "neg|lig|ent",
    negligence: "neg|lig|ence",
    negligible: "neg|lig|ible",
    ability: "|abil|ity",
    taciturn: "|tac|",
    laconic: "|lac|ic",
    ephemeral: "epi|hemer|al",
    quixotic: "|quixot|ic",
    maverick: "=",
    cavalier: "=",
    gregarious: "|greg|acious",
    egregious: "e|greg|ious",
    obsequious: "ob|sequ|ious",
    ubiquitous: "|ubiqu|ous",
    innocuous: "in|noc|ous",
    perfunctory: "per|funct|ory",
    intransigent: "in|trans|ent",
    recalcitrant: "re|calc|ant",
    obstreperous: "ob|streper|ous",
    truculent: "|truc|ent",
    pusillanimous: "|pusill+anim|ous",
    magnanimous: "|magn+anim|ous",
    equanimity: "|equ+anim|ity",
    unanimous: "uni|anim|ous",
    circumspect: "circum|spect|",
    perspicacious: "per|spic|acious",
    conspicuous: "con|spic|uous",
    auspicious: "|auspic|ious",
    soporific: "|sopor|fic",
    beneficent: "bene|fic|ent",
    maleficent: "male|fic|ent",
    magnificent: "|magn+fic|ent",
    benevolent: "bene|vol|ent",
    malevolent: "mal|vol|ent",
    misanthrope: "mis|anthrop|",
    philanthropy: "phil|anthrop|y",
    misogynist: "mis|gyn|ist",
    iconoclast: "|icon+clast|",
    demagogue: "dem|agog|",
    pedagogue: "ped|agog|",
    plethora: "=",
    paragon: "para|gon|",
    anomaly: "a|nom|y",
    antipathy: "anti|path|y",
    apathy: "a|path|y",
    empathy: "en|path|y",
    sympathy: "syn|path|y",
    dispassionate: "dis|pass|ate",
    equivocate: "equi|voc|ate",
    prevaricate: "|prevaric|ate",
    obfuscate: "ob|fusc|ate",
    exacerbate: "ex|acerb|ate",
    ameliorate: "|melior|ate",
    corroborate: "cor|robor|ate",
    exculpate: "ex|culp|ate",
    inculpate: "in|culp|ate",
    culpable: "|culp|able",
    exonerate: "ex|oner|ate",
    onerous: "|oner|ous",
    arduous: "=",
    astute: "=",
    candid: "|cand|id",
    incandescent: "in|cand|escent",
    candor: "|cand|or",
    cursory: "|curs|ory",
    precursor: "pre|curs|or",
    discursive: "dis|curs|ive",
    incursion: "in|curs|ion",
    recalcitrance: "re|calc|ance",
    sinecure: "|sine+cur|",
    surreptitious: "sub|rept|itious",
    clandestine: "=",
    furtive: "=",
    ostensible: "|ostens|ible",
    ostentatious: "|ostent|atious",
    tenacious: "|ten|acious",
    pertinacious: "per|tin|acious",
    tenuous: "|tenu|ous",
    tenable: "|ten|able",
    untenable: "un|ten|able",
    abstinent: "abs|tin|ent",
    pertinent: "per|tin|ent",
    retinue: "re|tin|ue",
    contentious: "con|tent|ious",
    portentous: "pro|tent|ous",
    ostracize: "|ostrac|ize",
    proscribe: "pro|scrib|",
    prescribe: "pre|scrib|",
    circumscribe: "circum|scrib|",
    ascribe: "ad|scrib|",
    conscription: "con|script|ion",
    inscrutable: "in|scrut|able",
    scrutinize: "|scrut|ize",
    perspicuous: "per|spic|uous",
    despicable: "de|spic|able",
    specious: "|spec|ious",
    spurious: "=",
    veracity: "|ver|acity",
    voracious: "|vor|acious",
    verbose: "|verb|ose",
    aver: "ad|ver|",
    veritable: "|ver|able",
    verisimilitude: "|ver+simil|tude",
    vociferous: "|voc+fer|ous",
    soliloquy: "sol|loqu|y",
    colloquial: "co|loqu|ial",
    eloquent: "e|loqu|ent",
    grandiloquent: "|grand+loqu|ent",
    magniloquent: "|magn+loqu|ent",
    circumlocution: "circum|locut|ion",
    loquacious: "|loqu|acious",
    garrulous: "=",
    reticence: "re|tac|ence",
    laconically: "|lac|ically",
    prolix: "pro|lix|",
    succinct: "sub|cinct|",
    concise: "con|cis|",
    incisive: "in|cis|ive",
    excise: "ex|cis|",
    trenchant: "=",
    innate: "in|nat|",
    nascent: "|nasc|ent",
    renaissance: "re|nasc|ence",
    naive: "=",
    ingenuous: "in|gen|uous",
    ingenious: "in|gen|ious",
    indigenous: "in|gen|ous",
    progeny: "pro|gen|y",
    engender: "en|gen|",
    genesis: "|gen|esis",
    eugenics: "eu|gen|ics",
    heterogeneous: "hetero|gen|ous",
    homogeneous: "homo|gen|ous",
    generic: "|gen|ic",
    degenerate: "de|gener|ate",
    regenerate: "re|gener|ate",
    primeval: "prim|ev|al",
    medieval: "medi|ev|al",
    longevity: "|long+ev|ity",
    coeval: "co|ev|al",
    ephemera: "epi|hemer|a",
    diurnal: "|diurn|al",
    nocturnal: "|noctur|al",
    perennial: "per|enn|ial",
    annals: "|ann|als",
    annuity: "|ann|uity",
    superannuated: "super|ann|ated",
    temporize: "tempor|ize|",
    extemporaneous: "ex|tempor|aneous",
    contemporary: "con|tempor|ary",
    tempestuous: "=",
    anachronism: "ana|chron|ism",
    chronicle: "|chron|icle",
    synchronous: "syn|chron|ous",
    incipient: "in|cip|ient",
    inception: "in|cept|ion",
    precipitate: "pre|cipit|ate",
    capitulate: "|capit|ulate",
    recapitulate: "re|capit|ulate",
    decapitate: "de|capit|ate",
    caprice: "=",
    capricious: "|capric|ious",
    susceptible: "sus|cept|ible",
    perceptive: "per|cept|ive",
    intercept: "inter|cept|",
    emancipate: "e|man+cip|ate",
    anticipate: "ante|cip|ate",
    participate: "|part+cip|ate",
    recipient: "re|cip|ient",
    reciprocal: "|reciproc|al",
    manuscript: "manu|script|",
    emancipation: "e|man+cip|ation",
    mandate: "|mand|ate",
    remand: "re|mand|",
    countermand: "counter|mand|",
    commend: "com|mend|",
    commendable: "com|mend|able",
    mendacious: "|mendac|ious",
    mendicant: "|mendic|ant",
    amenable: "|amen|able",
    tractable: "|tract|able",
    intractable: "in|tract|able",
    protract: "pro|tract|",
    detract: "de|tract|",
    abstract: "abs|tract|",
    retract: "re|tract|",
    contract: "con|tract|",
    intransigence: "in|trans|ence",
    transient: "trans|i|ent",
    transitory: "trans|it|ory",
    itinerant: "|itiner|ant",
    itinerary: "|itiner|ary",
    ambient: "ambi|i|ent",
    ambivalent: "ambi|val|ent",
    ambiguous: "ambi|ag|ous",
    ambulatory: "|ambul|atory",
    perambulate: "per|ambul|ate",
    somnambulist: "somn|ambul|ist",
    preamble: "pre|ambul|",
    circuitous: "circum|it|ous",
    obituary: "ob|it|uary",
    sedition: "se|it|ion",
    perish: "per|i|ish",
    initiate: "in|it|iate",
    sedentary: "|sed|entary",
    sedulous: "|sedul|ous",
    assiduous: "ad|sid|uous",
    insidious: "in|sid|ious",
    residual: "re|sid|ual",
    subsidiary: "sub|sid|iary",
    dissident: "dis|sid|ent",
    obsession: "ob|sess|ion",
    supersede: "super|sed|",
    sedate: "|sed|ate",
    destitute: "de|stit|ute",
    constituent: "con|stit|uent",
    substantiate: "sub|stant|iate",
    circumstantial: "circum|stant|ial",
    stagnant: "|stagn|ant",
    static: "|sta|ic",
    apostasy: "apo|sta|sy",
    ecstatic: "ex|sta|ic",
    stasis: "|sta|sis",
    steadfast: "=",
    staid: "=",
    stolid: "=",
    aloof: "=",
    austere: "=",
    ascetic: "|ascet|ic",
    acrid: "|acr|id",
    acrimony: "|acr|mony",
    acumen: "|acu|men",
    acuity: "|acu|ity",
    acerbic: "|acerb|ic",
    exacerbation: "ex|acerb|ation",
    abrasive: "ab|ras|ive",
    abrade: "ab|rad|",
    eradicate: "e|radic|ate",
    radical: "|radic|al",
    deracinate: "de|racin|ate",
    ramification: "|ram|fication",
    arboreal: "|arbor|eal",
    sylvan: "=",
    verdant: "|verd|ant",
    florid: "|flor|id",
    efflorescence: "ex|flor|escence",
    fauna: "=",
    flora: "=",
    prodigal: "pro|dig|al",
    prodigious: "pro|dig|ious",
    prodigy: "pro|dig|y",
    profligate: "pro|flig|ate",
    profuse: "pro|fus|",
    profusion: "pro|fus|ion",
    diffuse: "dif|fus|",
    effusive: "ex|fus|ive",
    infusion: "in|fus|ion",
    suffuse: "sub|fus|",
    refute: "re|fut|",
    confute: "con|fut|",
    futile: "|fut|ile",
    fatuous: "|fatu|ous",
    infatuated: "in|fatu|ated",
    inane: "=",
    vapid: "|vap|id",
    insipid: "in|sip|id",
    sapient: "|sap|ient",
    sagacious: "|sag|acious",
    sage: "=",
    savant: "|sav|ant",
    erudite: "e|rud|ite",
    pedantic: "ped|ant|ic",
    esoteric: "|esoter|ic",
    arcane: "=",
    abstruse: "abs|trus|",
    obtuse: "ob|tus|",
    recondite: "re|cond|ite",
    lucid: "|luc|id",
    elucidate: "e|luc|ate",
    pellucid: "per|luc|id",
    translucent: "trans|luc|ent",
    luminous: "|lum|ous",
    illuminate: "in|lum|ate",
    luminary: "|lum|ary",
    lackluster: "=",
    resplendent: "re|splend|ent",
    effulgent: "ex|fulg|ent",
    refulgent: "re|fulg|ent",
    conflagration: "con|flagr|ation",
    inflammatory: "in|flamm|atory",
    ardent: "|ard|ent",
    fervent: "|ferv|ent",
    fervor: "|ferv|or",
    zealous: "|zeal|ous",
    torpid: "|torp|id",
    torpor: "|torp|or",
    lethargic: "|letharg|ic",
    languid: "|langu|id",
    languish: "|langu|ish",
    lassitude: "|lass|tude",
    enervate: "e|nerv|ate",
    innervate: "in|nerv|ate",
    invigorate: "in|vigor|ate",
    vivacious: "|viv|acious",
    convivial: "con|viv|ial",
    vivify: "|viv|fy",
    viable: "|vi|able",
    vestige: "|vestig|",
    investigate: "in|vestig|ate",
    travesty: "trans|vest|y",
    divest: "di|vest|",
    invest: "in|vest|",
    obviate: "ob|via|ate",
    devious: "de|vi|ous",
    deviate: "de|vi|ate",
    trivial: "tri|via|al",
    impervious: "in|per+vi|ous",
    pervade: "per|vad|",
    invade: "in|vad|",
    evade: "e|vad|",
    evasive: "e|vas|ive",
    pervasive: "per|vas|ive",
    wanderlust: "=",
    nomadic: "|nomad|ic",
    peripatetic: "peri|patet|ic",
    sojourn: "sub|journ|",
    adjourn: "ad|journ|",
    diurnally: "|diurn|ally",
    quotidian: "|quotid|ian",
    perfidy: "per|fid|y",
    perfidious: "per|fid|ious",
    diffident: "dif|fid|ent",
    confident: "con|fid|ent",
    affidavit: "ad|fid|avit",
    fidelity: "|fid|ity",
    infidel: "in|fid|el",
    bona_fide: "=",
    credulous: "|cred|ulous",
    incredulous: "in|cred|ulous",
    credence: "|cred|ence",
    credible: "|cred|ible",
    creed: "=",
    dogmatic: "|dog|atic",
    orthodoxy: "ortho|dox|y",
    heterodox: "hetero|dox|",
    paradoxical: "para|dox|ical",
    heresy: "|heres|y",
    heretic: "|heret|ic",
    apostate: "apo|sta|ate",
    sectarian: "sect|arian|",
    partisan: "part|isan|",
    factious: "fact|ious|",
    faction: "fact|ion|",
    fractious: "fract|ious|",
    refractory: "re|fract|ory",
    infraction: "in|fract|ion",
    fragile: "|frag|ile",
    frangible: "|frang|ible",
    infringe: "in|fring|",
    diffraction: "dif|fract|ion",
    schismatic: "|schis|matic",
    dissension: "dis|sens|ion",
    consensus: "con|sens|us",
    sentient: "|sent|ient",
    prescient: "pre|sci|ent",
    omniscient: "omni|sci|ent",
    conscientious: "con|sci|entious",
    prescience: "pre|sci|ence",
    presage: "pre|sag|",
    portend: "pro|tend|",
    harbinger: "=",
    auspice: "|auspic|",
    ominous: "|omin|ous",
    foreboding: "fore|bod|ing",
    premonition: "pre|monit|ion",
    admonish: "ad|mon|ish",
    admonition: "ad|monit|ion",
    monitory: "|monit|ory",
    remonstrate: "re|monstr|ate",
    demonstrable: "de|monstr|able",
    muster: "=",
    mundane: "|mund|ane",
    ecumenical: "|ecumen|ical",
    parochial: "|paroch|ial",
    provincial: "|provinc|ial",
    insular: "|insul|ar",
    insulate: "|insul|ate",
    peninsula: "pen|insul|a",
    cosmopolitan: "cosmo|polit|an",
    metropolis: "meta|polis|",
    megalopolis: "|megal+polis|",
    politic: "|polit|ic",
    impolitic: "in|polit|ic",
    acropolis: "|acro+polis|",
    acrophobia: "|acro|phobia",
    acronym: "|acro|nym",
    anonymous: "an|onym|ous",
    pseudonym: "pseudo|nym|",
    eponymous: "epi|onym|ous",
    misnomer: "mis|nom|er",
    ignominious: "in|nomin|ious",
    renown: "re|nown|",
    nominal: "|nomin|al",
    denomination: "de|nomin|ation",
    autonomy: "auto|nomy|",
    astronomy: "astro|nomy|",
    gastronomy: "gastro|nomy|",
    taxonomy: "taxo|nomy|",
    economical: "eco|nom|ical",
    antinomy: "anti|nomy|",
    anomalous: "a|nom|ous",
    aberrant: "ab|err|ant",
    aberration: "ab|err|ation",
    errant: "|err|ant",
    erratic: "|err|atic",
    erroneous: "|err|eous",
    inerrant: "in|err|ant",
    vagary: "|vag|ary",
    vagrant: "|vag|ant",
    extravagant: "extra|vag|ant",
    divagate: "di|vag|ate",
    digress: "di|gress|",
    egress: "e|gress|",
    ingress: "in|gress|",
    regress: "re|gress|",
    transgress: "trans|gress|",
    congress: "con|gress|",
    aggressive: "ad|gress|ive",
    retrogress: "retro|gress|",
    gradation: "|grad|ation",
    degrade: "de|grad|",
    ingratiate: "in|grat|iate",
    gratuity: "|grat|uity",
    ingrate: "in|grat|",
    congratulate: "con|grat|ulate",
    grievous: "|griev|ous",
    aggrieve: "ad|griev|",
    aggravate: "ad|grav|ate",
    gravitas: "|grav|itas",
    gravity: "|grav|ity",
    levity: "|lev|ity",
    alleviate: "ad|lev|ate",
    leaven: "|lev|en",
    elevate: "e|lev|ate",
    relevant: "re|lev|ant",
    cantilever: "|cant+lev|er",
    buoyant: "=",
    ebullient: "e|bull|ient",
    exuberant: "ex|uber|ant",
    effervescent: "ex|ferv|escent",
    coalesce: "co|alesc|",
    convalesce: "con|val|esce",
    obsolescent: "ob|sol|escent",
    obsolete: "ob|sol|ete",
    adolescent: "ad|ol|escent",
    quiescent: "|quie|escent",
    acquiesce: "ad|quie|esce",
    tranquil: "|tranquil|",
    requiem: "re|quie|em",
    incongruous: "in|congru|ous",
    congruent: "|congru|ent",
    disparate: "dis|par|ate",
    disparity: "dis|par|ity",
    parity: "|par|ity",
    nonpareil: "non|pareil|",
    paramount: "para|mount|",
    preeminent: "pre|min|ent",
    eminent: "e|min|ent",
    imminent: "in|min|ent",
    prominent: "pro|min|ent",
    diminution: "di|min|ution",
    diminutive: "di|min|utive",
    minuscule: "|minus|cule",
    minutiae: "|minut|iae",
    modicum: "|mod|icum",
    immoderate: "in|moder|ate",
    modulate: "|mod|ulate",
    accommodate: "ad|commod|ate",
    commodious: "|commod|ious",
    incommodious: "in|commod|ious",
    remuneration: "re|muner|ation",
    immunity: "in|mun|ity",
    communal: "com|mun|al",
    excommunicate: "ex|commun|ate",
    impunity: "in|pun|ity",
    punitive: "|pun|itive",
    penal: "|pen|al",
    penitent: "|pen|ent",
    repent: "re|pen|",
    penance: "|pen|ance",
    expiate: "ex|pi|ate",
    atone: "=",
    propitiate: "pro|pit|ate",
    propitious: "pro|pit|ious",
    auspiciously: "|auspic|iously",
    placate: "|plac|ate",
    implacable: "in|plac|able",
    complacent: "com|plac|ent",
    complaisant: "com|plais|ant",
    mollify: "|moll|fy",
    emollient: "e|moll|ient",
    assuage: "ad|suav|",
    suave: "|suav|",
    persuade: "per|suad|",
    dissuade: "dis|suad|",
    palliate: "|palli|ate",
    alleviation: "ad|lev|ation",
    ameliorative: "|melior|ative",
    salutary: "|salut|ary",
    salubrious: "|salubr|ious",
    insalubrious: "in|salubr|ious",
    noxious: "|nox|ious",
    obnoxious: "ob|nox|ious",
    pernicious: "per|nic|ious",
    deleterious: "|deleter|ious",
    malignant: "mal|gn|ant",
    malign: "mal|gn|",
    benign: "bene|gn|",
    benignant: "bene|gn|ant",
    malaise: "mal|aise|",
    malapropism: "mal|aprop|ism",
    malfeasance: "mal|feas|ance",
    misfeasance: "mis|feas|ance",
    feasible: "|feas|ible",
    defeasible: "de|feas|ible",
    surfeit: "sur|feit|",
    counterfeit: "counter|feit|",
    proficient: "pro|fic|ient",
    deficient: "de|fic|ient",
    efficacious: "ex|fic|acious",
    efficacy: "ex|fic|acy",
    artifice: "art|fic|",
    arraign: "ad|raign|",
    impugn: "in|pugn|",
    repugnant: "re|pugn|ant",
    pugnacious: "|pugn|acious",
    pugilist: "|pugil|ist",
    belligerent: "belli|ger|ent",
    bellicose: "belli|cose|",
    truce: "=",
    armistice: "arm|stice|",
    interstice: "inter|stice|",
    solstice: "sol|stice|",
    insurgent: "in|surg|ent",
    resurgent: "re|surg|ent",
    insurrection: "in|surrect|ion",
    resurrect: "re|surrect|",
    sedulously: "|sedul|ously",
    subvert: "sub|vert|",
    subversive: "sub|vers|ive",
    inadvertent: "in|ad+vert|ent",
    advert: "ad|vert|",
    avert: "ab|vert|",
    averse: "ab|vers|",
    aversion: "ab|vers|ion",
    covert: "co|vert|",
    overt: "=",
    divert: "di|vert|",
    invert: "in|vert|",
    revert: "re|vert|",
    controversy: "contra|vers|y",
    versatile: "|vers|atile",
    vertigo: "|vert|igo",
    convergence: "con|verg|ence",
    divergent: "di|verg|ent",
    obverse: "ob|vers|",
    perverse: "per|vers|",
    traverse: "trans|vers|",
    universal: "uni|vers|al",
    vortex: "|vort|ex",
    voracity: "|vor|acity",
    devour: "de|vour|",
    carnivorous: "carn|vor|ous",
    herbivorous: "herb|vor|ous",
    omnivorous: "omni|vor|ous",
    insatiable: "in|sat|able",
    satiate: "|sat|ate",
    satiety: "|sat|iety",
    glutton: "|glut|on",
    gluttonous: "|glut|onous",
    rapacious: "|rap|acious",
    rapture: "|rap|ture",
    usurp: "|usurp|",
    arrogate: "ad|rog|ate",
    abrogate: "ab|rog|ate",
    derogatory: "de|rog|atory",
    interrogate: "inter|rog|ate",
    surrogate: "sub|rog|ate",
    prerogative: "pre|rog|ative",
    supersedure: "super|sed|ure",
    interregnum: "inter|regn|um",
    regicide: "reg|cide|",
    regimen: "|reg|imen",
    regalia: "|reg|alia",
    rectitude: "|rect|tude",
    rectify: "|rect|fy",
    directive: "di|rect|ive",
    insurrectionist: "in|surrect|ionist",
    corrigible: "|corrig|ible",
    incorrigible: "in|corrig|ible",
    correlative: "cor|relat|ive",
    corroboration: "cor|robor|ation",
    fortitude: "fort|tude|",
    fortnight: "=",
    forte: "|fort|e",
    effort: "ex|fort|",
    comfort: "com|fort|",
    enforce: "en|forc|",
    reinforce: "re|en+forc|",
    perforce: "per|forc|",
    deforest: "de|forest|",
    tenet: "|ten|et",
    tenure: "|ten|ure",
    tenant: "|ten|ant",
    sustenance: "sus|ten|ance",
    countenance: "con|ten|ance",
    detain: "de|tain|",
    abstain: "abs|tain|",
    retentive: "re|tent|ive",
    attenuate: "ad|tenu|ate",
    extenuate: "ex|tenu|ate",
    tenuously: "|tenu|ously",
    distend: "dis|tend|",
    ostensibly: "|ostens|ibly",
    contentment: "con|tent|ment",
    intent: "in|tent|",
    portentously: "pro|tent|ously"
  };

  const INFLECTIONS = [
    { end: "ies", replace: "y", label: "-ies", note: "plural / 3rd person" },
    { end: "ied", replace: "y", label: "-ied", note: "past tense" },
    { end: "ing", replace: "", label: "-ing", note: "ongoing action" },
    { end: "ed", replace: "", label: "-ed", note: "past tense" },
    { end: "es", replace: "", label: "-es", note: "plural / 3rd person" },
    { end: "s", replace: "", label: "-s", note: "plural / 3rd person" }
  ];

  const VOWELS = "aeiouy";

  function lookup(kind, form) {
    const list = FORM_MAP[kind].get(form);
    return list ? list[0] : null;
  }

  /* All entries that claim this spelling, so the UI can show alternatives. */
  function lookupAll(kind, form) {
    return FORM_MAP[kind].get(form) || [];
  }

  function matchPrefixes(word, depth) {
    /* returns [{ parts:[{form,entry}], rest, consumed }] */
    const results = [{ parts: [], rest: word, consumed: 0 }];
    let frontier = [{ parts: [], rest: word, consumed: 0 }];
    for (let d = 0; d < depth; d++) {
      const next = [];
      frontier.forEach(state => {
        SORTED.prefix.forEach(form => {
          if (state.rest.length - form.length < 3) return;
          if (!state.rest.startsWith(form)) return;
          const entry = lookup("prefix", form);
          const parts = state.parts.concat([{ form, entry }]);
          const st = {
            parts,
            rest: state.rest.slice(form.length),
            consumed: state.consumed + form.length
          };
          next.push(st);
          results.push(st);
        });
      });
      frontier = next;
      if (!frontier.length) break;
    }
    return results;
  }

  function matchSuffixes(word, depth) {
    const results = [{ parts: [], rest: word, consumed: 0 }];
    let frontier = [{ parts: [], rest: word, consumed: 0 }];
    for (let d = 0; d < depth; d++) {
      const next = [];
      frontier.forEach(state => {
        SORTED.suffix.forEach(form => {
          if (state.rest.length - form.length < 2) return;
          if (!state.rest.endsWith(form)) return;
          const entry = lookup("suffix", form);
          const parts = [{ form, entry }].concat(state.parts);
          const st = {
            parts,
            rest: state.rest.slice(0, state.rest.length - form.length),
            consumed: state.consumed + form.length
          };
          next.push(st);
          results.push(st);
        });
      });
      frontier = next;
      if (!frontier.length) break;
    }
    return results;
  }

  /* Score how well `stem` is explained by a known root. */
  function matchRoot(stem) {
    if (!stem || stem.length < 2) return null;

    const exact = lookup("root", stem);
    if (exact) return { form: stem, entry: exact, score: 100, extra: "" };

    let best = null;
    const consider = cand => {
      if (!best || cand.score > best.score) best = cand;
    };

    /* stem is the root plus a linking vowel or a silent -e */
    for (const form of SORTED.root) {
      if (form.length < 2) continue;
      /* a two-letter root only counts when a single linking vowel follows */
      if (form.length === 2 && !(stem.length === 3 && stem.startsWith(form) && VOWELS.includes(stem[2]))) {
        continue;
      }
      if (stem.startsWith(form)) {
        const tail = stem.slice(form.length);
        const entry = lookup("root", form);
        if (!tail) {
          consider({ form, entry, score: 100, extra: "" });
        } else if (tail.length === 1 && VOWELS.includes(tail)) {
          consider({ form, entry, score: 88, extra: tail });
        } else if (tail.length <= 2 && form.length >= 4) {
          consider({ form, entry, score: 72, extra: tail });
        } else if (form.length >= stem.length * 0.6) {
          consider({ form, entry, score: 60, extra: tail });
        }
      }
    }

    /* the root sits at the end of the stem (leading letters are assimilated
     * or belong to an unlisted combining form) */
    for (const form of SORTED.root) {
      if (form.length < 4) continue;
      if (stem.endsWith(form) && stem.length - form.length <= 2) {
        const entry = lookup("root", form);
        consider({
          form,
          entry,
          score: 66,
          lead: stem.slice(0, stem.length - form.length),
          extra: ""
        });
      }
    }

    /* stem dropped a final vowel before a suffix (e.g. "curs" + "ory").
     * `surface` records the letters actually present, so the display never
     * shows a letter the word does not contain. */
    if (stem.length >= 3) {
      for (const v of "aeiou") {
        const entry = lookup("root", stem + v);
        if (entry) {
          consider({ form: stem + v, entry, score: 80, extra: "", elided: v, surface: stem });
        }
      }
    }

    return best && best.score >= 60 ? best : null;
  }

  function scoreCandidate(word, pre, suf, rootMatch) {
    if (!rootMatch) return -1;
    /* A longer root match explains more of the word on its own, so it beats a
     * short root propped up by a greedy suffix ("con+volut" over "con+vol+ute"). */
    let score = rootMatch.score + rootMatch.form.length * 4;
    score += pre.parts.length * 10;
    score += suf.parts.length * 8;
    /* letters the reading cannot account for */
    const leftover = (rootMatch.extra || "").length + (rootMatch.lead || "").length;
    score -= leftover * 12;
    /* prefer readings that use most of the word */
    const covered = pre.consumed + suf.consumed + rootMatch.form.length;
    score -= Math.max(0, word.length - covered) * 4;
    /* a bare one-letter prefix on its own is usually a coincidence */
    if (pre.parts.length && pre.parts[0].form.length === 1 && !suf.parts.length) score -= 12;
    return score;
  }

  /* An override slot names a spelling, not a category: "manu" sits in the
   * prefix slot of "manuscript" but is catalogued as a root. Resolve against
   * the named category first, then anywhere else. */
  function resolveAny(kind, form) {
    const direct = lookup(kind, form);
    if (direct) return direct;
    for (const other of ["prefix", "root", "suffix"]) {
      if (other === kind) continue;
      const entry = lookup(other, form);
      if (entry) return entry;
    }
    return null;
  }

  function fromOverride(word, spec) {
    if (spec === "=") {
      return {
        word,
        parts: [{ kind: "base", text: word, meaning: "", entry: null }],
        confidence: "whole",
        overridden: true
      };
    }
    const [preSpec, rootSpec, sufSpec] = spec.split("|");
    const parts = [];
    const add = (kind, listSpec) => {
      listSpec.split("+").filter(Boolean).forEach(f => {
        const entry = resolveAny(kind, f);
        parts.push({
          kind,
          text: f,
          entry,
          meaning: entry ? entry.meaning : "",
          alternates: entry ? lookupAll(entry.kind, f) : []
        });
      });
    };
    add("prefix", preSpec);
    add("root", rootSpec);
    add("suffix", sufSpec);

    /* Overrides are written with a morpheme's canonical form, but the word
     * carries whichever variant assimilated to its neighbours — "accommodate"
     * is ad- spelled ac-. Walking the word and preferring the variant that is
     * actually there means a piece never shows letters the word does not have. */
    let at = 0;
    parts.forEach(part => {
      /* Same length only: assimilation swaps letters (ad->ac, sub->sur), it
       * never lengthens a piece. Allowing a longer variant would let a root
       * eat the suffix behind it — "lac" + "ic" becoming "laconic" + "ic". */
      const forms = part.entry ? part.entry.variants : [part.text];
      let pick = null;
      forms.forEach(v => {
        if (v.length === part.text.length && word.startsWith(v, at)) pick = v;
      });
      if (pick) {
        part.text = pick;
        at += pick.length;
      } else {
        const found = word.indexOf(part.text, at);
        at = found === -1 ? at + part.text.length : found + part.text.length;
      }
    });

    return { word, parts, confidence: "high", overridden: true };
  }

  /* Every plausible prefix/root/suffix reading of a spelling, each carrying
   * the heuristic score and the feature vector the learner scores against. */
  function segmentations(stemWord) {
    const out = [];
    matchPrefixes(stemWord, 2).forEach(pre => {
      matchSuffixes(pre.rest, 3).forEach(suf => {
        const stem = suf.rest;
        if (stem.length < 2) return;
        const rootMatch = matchRoot(stem);
        const base = scoreCandidate(stemWord, pre, suf, rootMatch);
        if (base <= 0) return;
        const cand = { pre, suf, rootMatch, stem, baseScore: base, score: base };
        cand.features = featuresOf(cand);
        out.push(cand);
      });
    });
    return out;
  }

  /* Sparse feature vector describing a candidate reading. The learner keeps a
   * weight per feature; nothing here depends on any external model. */
  function featuresOf(cand) {
    const f = Object.create(null);
    const add = (k, v) => { f[k] = (f[k] || 0) + v; };
    cand.pre.parts.forEach(p => { if (p.entry) add("P:" + p.entry.id, 1); });
    cand.suf.parts.forEach(p => { if (p.entry) add("S:" + p.entry.id, 1); });
    if (cand.rootMatch && cand.rootMatch.entry) add("R:" + cand.rootMatch.entry.id, 1);
    add("npre:" + cand.pre.parts.length, 1);
    add("nsuf:" + cand.suf.parts.length, 1);
    const leftover =
      ((cand.rootMatch && cand.rootMatch.extra) || "").length +
      ((cand.rootMatch && cand.rootMatch.lead) || "").length;
    add("left:" + Math.min(leftover, 3), 1);
    if (cand.rootMatch && cand.rootMatch.score >= 100) add("exact", 1);
    if (cand.rootMatch) add("rlen:" + Math.min(cand.rootMatch.form.length, 7), 1);
    return f;
  }

  /* The learner installs itself here; with no learner this stays a no-op and
   * the splitter behaves exactly as the pure heuristic did. */
  let adaptiveScorer = null;
  function setScorer(fn) {
    adaptiveScorer = typeof fn === "function" ? fn : null;
  }

  function finalScore(cand) {
    if (!adaptiveScorer) return cand.baseScore;
    return cand.baseScore + adaptiveScorer(cand.features);
  }

  function bestOf(cands) {
    let best = null;
    cands.forEach(c => {
      c.score = finalScore(c);
      if (!best || c.score > best.score) best = c;
    });
    return best;
  }

  /* Best reading of a single spelling, or null. */
  function bestSegmentation(stemWord) {
    return bestOf(segmentations(stemWord));
  }

  /* Candidate base forms after removing a regular ending: plain, with a
   * restored silent -e, and with an undoubled final consonant. */
  function inflectionBases(word) {
    const out = [];
    if (word.length <= 4) return out;
    /* "status" is a word in its own right, so it must not be re-spelled into
     * "statue" on the way to an analysis. Restoring letters is only allowed
     * for a form the dictionary does not list. */
    const mayRestore = !KNOWN_WORDS.has(word);
    INFLECTIONS.forEach(inf => {
      if (!word.endsWith(inf.end)) return;
      const stripped = word.slice(0, word.length - inf.end.length) + inf.replace;
      if (stripped.length < 3) return;
      /* Plain removal is always fair game. Restoring a letter is a guess, so
       * it only counts when the result is a word we actually know —
       * otherwise "possess" becomes "possese" and "species" becomes "specy". */
      const forms = [stripped];
      if (!inf.replace) {
        if (mayRestore && isRealBase(stripped + "e")) forms.push(stripped + "e");
        const last = stripped[stripped.length - 1];
        if (stripped.length > 3 && last === stripped[stripped.length - 2] && !VOWELS.includes(last)) {
          forms.push(stripped.slice(0, -1));
        }
      } else if (!mayRestore || !KNOWN_WORDS.has(stripped)) {
        /* the -ies -> -y swap also invents a letter */
        const swapped = word.slice(0, word.length - inf.end.length) + inf.replace;
        forms.length = 0;
        if (mayRestore && KNOWN_WORDS.has(swapped)) forms.push(swapped);
      }
      forms.forEach(f => out.push({ base: f, inflection: inf }));
    });
    return out;
  }

  /* No classical root, but a recognizable affix sits on an ordinary English
   * base ("be-moan", "boor-ish"). Worth showing, so long as the base is a
   * substantial chunk rather than a stray syllable. */
  const NATIVE_PREFIXES = new Set([
    "un", "be", "over", "under", "fore", "mis", "out", "with", "re", "dis",
    "non", "semi", "anti", "pre", "post", "counter", "inter", "sub", "super", "mid"
  ]);
  const NATIVE_SUFFIXES = new Set([
    "ful", "less", "ish", "ness", "ly", "hood", "ship", "like", "some",
    "ward", "wise", "dom", "en", "er", "craft", "let", "ling"
  ]);

  /* Words the app knows are real, used to sanity-check a leftover base. */
  const KNOWN_WORDS = new Set();
  function registerWords(words) {
    words.forEach(w => KNOWN_WORDS.add(String(w).toLowerCase()));
  }
  function isRealBase(base) {
    if (KNOWN_WORDS.has(base)) return true;
    return KNOWN_WORDS.has(base + "e") || KNOWN_WORDS.has(base + "y");
  }

  function affixOnly(word) {
    if (word.length < 6) return null;
    let bestPre = null;
    SORTED.prefix.forEach(form => {
      if (form.length < 2) return;
      if (!word.startsWith(form)) return;
      if (word.length - form.length < 4) return;
      /* an unfamiliar base only earns a split from productive English
       * morphology; anything fancier needs the base to be a real word */
      if (!NATIVE_PREFIXES.has(form) && !isRealBase(word.slice(form.length))) return;
      if (!bestPre || form.length > bestPre.length) bestPre = form;
    });
    let bestSuf = null;
    const afterPre = bestPre ? word.slice(bestPre.length) : word;
    SORTED.suffix.forEach(form => {
      if (form.length < 2) return;
      if (!afterPre.endsWith(form)) return;
      if (afterPre.length - form.length < 4) return;
      /* A bound stem ("toler-ant", "calamit-ous") still teaches the suffix,
       * so suffixes are allowed on any base of a reasonable length. */
      if (!bestSuf || form.length > bestSuf.length) bestSuf = form;
    });
    if (!bestPre && !bestSuf) return null;

    const base = afterPre.slice(0, afterPre.length - (bestSuf ? bestSuf.length : 0));
    const parts = [];
    if (bestPre) {
      const entry = lookup("prefix", bestPre);
      parts.push({
        kind: "prefix",
        text: bestPre,
        entry,
        meaning: entry.meaning,
        alternates: lookupAll("prefix", bestPre)
      });
    }
    /* No meaning: whether this leftover is a real word or just a stem is a
     * question about the word list, which lives above the engine. */
    parts.push({ kind: "base", text: base, entry: null, meaning: "" });
    if (bestSuf) {
      const entry = lookup("suffix", bestSuf);
      parts.push({
        kind: "suffix",
        text: bestSuf,
        entry,
        meaning: entry.meaning,
        alternates: lookupAll("suffix", bestSuf)
      });
    }
    return { word, parts, confidence: "medium", affixOnly: true };
  }

  /* Turn a scored candidate into the display parts the app renders. */
  function partsOf(cand) {
    const parts = [];
    cand.pre.parts.forEach(p =>
      parts.push({
        kind: "prefix",
        text: p.form,
        entry: p.entry,
        meaning: p.entry ? p.entry.meaning : "",
        alternates: lookupAll("prefix", p.form)
      })
    );
    if (cand.rootMatch.lead) {
      parts.push({ kind: "link", text: cand.rootMatch.lead, entry: null, meaning: "connecting letters" });
    }
    parts.push({
      kind: "root",
      text: cand.rootMatch.surface || (cand.rootMatch.form + (cand.rootMatch.extra || "")),
      entry: cand.rootMatch.entry,
      meaning: cand.rootMatch.entry.meaning,
      alternates: lookupAll("root", cand.rootMatch.form)
    });
    cand.suf.parts.forEach(p =>
      parts.push({
        kind: "suffix",
        text: p.form,
        entry: p.entry,
        meaning: p.entry ? p.entry.meaning : "",
        alternates: lookupAll("suffix", p.form)
      })
    );
    return parts;
  }

  /* A stable identity for a reading, so two candidates can be compared and a
   * user's pick can be stored and matched again later. */
  function signature(parts) {
    return parts.map(p => p.kind[0] + ":" + p.text).join("+");
  }

  /* Every candidate for a word, best first — the ranked list the user picks
   * from when correcting the splitter, and the pool the learner trains on. */
  function candidates(rawWord, limit) {
    const word = String(rawWord || "").toLowerCase().trim();
    if (!word) return [];
    const seen = new Set();
    const out = [];
    const collect = (cands, base, inflection) => {
      cands.forEach(c => {
        c.score = finalScore(c);
        const parts = partsOf(c);
        const sig = signature(parts);
        if (seen.has(sig)) return;
        seen.add(sig);
        out.push({
          word,
          base,
          parts,
          signature: sig,
          score: c.score,
          baseScore: c.baseScore,
          features: c.features,
          inflection: inflection || null
        });
      });
    };
    collect(segmentations(word), word, null);
    inflectionBases(word).forEach(cand => {
      collect(segmentations(cand.base), cand.base, cand.inflection);
    });
    out.sort((a, b) => b.score - a.score);
    return limit ? out.slice(0, limit) : out;
  }

  function split(rawWord, opts) {
    const options = opts || {};
    const word = String(rawWord || "").toLowerCase().trim();
    if (!word) return { word, parts: [], confidence: "none" };

    if (!options.ignoreOverrides && OVERRIDES[word]) {
      return fromOverride(word, OVERRIDES[word]);
    }

    let stemWord = word;
    let inflection = null;
    let best = bestSegmentation(word);

    /* An inflected form often hides the real morphology ("unprecedented"),
     * so also read the uninflected base and keep whichever explains more. */
    for (const cand of inflectionBases(word)) {
      if (!options.ignoreOverrides && OVERRIDES[cand.base]) {
        const res = fromOverride(cand.base, OVERRIDES[cand.base]);
        res.word = word;
        res.inflection = cand.inflection;
        /* "=" on the base means the base is a single unit, so the inflected
         * form is too — do not fall through and split it anyway. */
        if (OVERRIDES[cand.base] === "=") {
          res.parts = [{ kind: "base", text: word, meaning: "", entry: null }];
          res.inflection = null;
          return res;
        }
        if (res.parts.length > 1) return res;
        continue;
      }
      const alt = bestSegmentation(cand.base);
      /* Trading the whole word for a shortened stem has to buy something:
       * a bare root on a truncated stem ("species" -> "speci") explains less
       * than leaving the word alone. */
      if (alt && alt.pre.parts.length + alt.suf.parts.length === 0) continue;
      if (alt && (!best || alt.score > best.score)) {
        best = alt;
        stemWord = cand.base;
        inflection = cand.inflection;
      }
    }

    if (!best) {
      const fallback = affixOnly(word);
      if (fallback) return fallback;
      return {
        word,
        parts: [{ kind: "base", text: word, meaning: "", entry: null }],
        confidence: "low",
        inflection: null
      };
    }

    const parts = partsOf(best);
    return {
      word,
      parts,
      signature: signature(parts),
      confidence: best.score >= 110 ? "high" : best.score >= 80 ? "medium" : "low",
      score: best.score,
      inflection
    };
  }

  /* "not + able to be + believed" — a plain-language literal reading. */
  function literalReading(result) {
    const meaningful = result.parts.filter(p => p.entry);
    if (meaningful.length < 2) return "";
    const pre = meaningful.filter(p => p.kind === "prefix").map(p => p.meaning.split(",")[0].trim());
    const root = meaningful.filter(p => p.kind === "root").map(p => p.meaning.split(",")[0].trim());
    const suf = meaningful.filter(p => p.kind === "suffix").map(p => p.meaning.split(",")[0].trim());
    const bits = [];
    if (suf.length) bits.push(suf[0]);
    if (pre.length) bits.push(pre.join(" + "));
    if (root.length) bits.push(root.join(" + "));
    if (bits.length < 2) return "";
    return bits.join(" → ");
  }

  window.WordSplitter = {
    split,
    candidates,
    signature,
    literalReading,
    registerWords,
    setScorer,
    OVERRIDES
  };
})();
