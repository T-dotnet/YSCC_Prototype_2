export const LEGACY_INSTRUMENT = {
  version: "Demo check-in v1.0",
  respondents: ["Person", "Family respondent"],
  sections: [{ id: "preferences", title: "Taking part" }],
  questions: [
    {
      section: "preferences",
      id: "participation",
      title: "How would you prefer to take part?",
      family: "How would you prefer to share your perspective?",
      hint: "Choose the option that feels most comfortable for you.",
      options: [
        "In person",
        "On my own device",
        "Together with a staff member",
        "Prefer not to answer",
      ],
    },
    {
      section: "preferences",
      id: "support",
      title: "Would you like support with the questions?",
      hint: "It’s okay to ask for help or take a break.",
      options: [
        "I’m comfortable on my own",
        "A little support",
        "I’d like someone alongside me",
        "Prefer not to answer",
      ],
    },
    {
      section: "preferences",
      id: "next",
      title: "What would you like to talk about next?",
      hint: "This sample question helps demonstrate how answers reach the care team.",
      options: [
        "My next steps",
        "How taking part works",
        "Support available to me",
        "Prefer not to answer",
      ],
    },
  ],
};

const choice = (
  id,
  section,
  title,
  options,
  when,
  hint = "Choose what works for you. You can also choose not to answer.",
) => ({
  id,
  section,
  title,
  hint,
  options: [...options, "Prefer not to answer"],
  ...(when ? { when } : {}),
});
const when = (questionId, ...oneOf) => ({ questionId, oneOf });

const PREFER_NOT_TO_ANSWER = "Prefer not to answer";
const FREQUENCY_SCALE = {
  label: "Five-point frequency scale",
  instruction: "Choose one answer from Never to Always.",
  options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
};
const AGREEMENT_SCALE = {
  label: "Five-point agreement scale",
  instruction: "Choose one answer from Strongly disagree to Strongly agree.",
  options: [
    "Strongly disagree",
    "Disagree",
    "Neither agree nor disagree",
    "Agree",
    "Strongly agree",
  ],
};
const likert = (id, section, title, scale, hint, nonResponseOptions = []) => ({
  id,
  section,
  title,
  hint,
  responseType: "likert",
  scale: { ...scale, options: [...scale.options] },
  nonResponseOptions: [...nonResponseOptions, PREFER_NOT_TO_ANSWER],
  options: [...scale.options, ...nonResponseOptions, PREFER_NOT_TO_ANSWER],
});

// Original, nonclinical sample content. Rules reference stable IDs of earlier
// questions; array positions are fixed within a pinned version for stored answers.
export const DEMO_INSTRUMENT = {
  name: "Demo check-in",
  version: "Demo check-in v2.0",
  description: "Participation preferences, everyday activities and next steps.",
  respondents: ["Person", "Family respondent"],
  sections: [
    { id: "preferences", title: "Taking part" },
    { id: "support", title: "Support with questions" },
    { id: "routine", title: "Everyday activities" },
    { id: "connection", title: "People and connection" },
    { id: "next", title: "Your next steps" },
  ],
  questions: [
    choice(
      "participation",
      "preferences",
      "How would you prefer to take part?",
      ["In person", "On my own device", "Together with a staff member"],
    ),
    choice(
      "device",
      "preferences",
      "Can you use a device when you want to take part?",
      ["Yes", "Sometimes", "I need help arranging one"],
      when("participation", "On my own device"),
    ),
    choice(
      "device-help",
      "preferences",
      "What would help you access a device?",
      [
        "A device at the centre",
        "Help setting up my device",
        "Talk through the options",
      ],
      when("device", "Sometimes", "I need help arranging one"),
    ),
    choice("pace", "preferences", "What pace would suit you?", [
      "One sitting",
      "Short sections with breaks",
      "Decide as I go",
    ]),
    choice(
      "breaks",
      "preferences",
      "When would you prefer a break?",
      ["After each section", "Whenever I ask", "Check with me along the way"],
      when("pace", "Short sections with breaks"),
    ),
    choice("support", "support", "Would you like support with the questions?", [
      "I’m comfortable on my own",
      "A little support",
      "I’d like someone alongside me",
    ]),
    choice(
      "support-kind",
      "support",
      "What kind of support would help?",
      [
        "Reading the questions together",
        "Explaining the answer options",
        "Someone to keep me company",
      ],
      when("support", "A little support", "I’d like someone alongside me"),
    ),
    choice(
      "support-reader",
      "support",
      "How would you like the questions read?",
      [
        "Read each question aloud",
        "Only read the ones I ask about",
        "Let me read first, then check together",
      ],
      when("support-kind", "Reading the questions together"),
    ),
    choice(
      "clarity",
      "support",
      "How would you like unfamiliar words explained?",
      ["Use an example", "Use simpler words", "Let me ask when I need to"],
    ),
    choice("setting", "support", "What setting would feel comfortable?", [
      "A quiet space",
      "A familiar space",
      "No particular preference",
    ]),
    choice(
      "activities",
      "routine",
      "Are there everyday activities you would like to discuss?",
      [
        "Learning or work",
        "Hobbies and free time",
        "Managing my routine",
        "Nothing for now",
      ],
    ),
    choice(
      "learning",
      "routine",
      "What would you like to discuss about learning or work?",
      ["Getting started", "Keeping a routine", "Asking for support"],
      when("activities", "Learning or work"),
    ),
    choice(
      "hobbies",
      "routine",
      "What would you like to discuss about hobbies?",
      ["Finding something to try", "Making time", "Joining others"],
      when("activities", "Hobbies and free time"),
    ),
    choice(
      "routine-help",
      "routine",
      "What would help with your routine?",
      ["Planning the week", "Reminders", "Taking one step at a time"],
      when("activities", "Managing my routine"),
    ),
    choice(
      "strength",
      "routine",
      "What helps you make time for things you enjoy?",
      [
        "Planning ahead",
        "Doing things with someone",
        "Keeping things flexible",
        "I’m still working this out",
      ],
    ),
    choice(
      "connection",
      "connection",
      "Would you like to involve someone in your next conversation?",
      ["Yes", "Not right now", "I’m not sure"],
    ),
    choice(
      "who",
      "connection",
      "Who would you like to involve?",
      ["A family member", "A friend or trusted person", "A staff member"],
      when("connection", "Yes"),
    ),
    choice(
      "involvement",
      "connection",
      "How would you like them to take part?",
      [
        "Join the whole conversation",
        "Join for part of it",
        "Help me prepare beforehand",
      ],
      {
        all: [
          when("connection", "Yes"),
          when("who", "A family member", "A friend or trusted person"),
        ],
      },
    ),
    choice(
      "connection-info",
      "connection",
      "What would help you decide about involving someone?",
      [
        "Know what they would be asked",
        "Discuss it with staff first",
        "More time to think",
      ],
      when("connection", "I’m not sure"),
    ),
    choice(
      "conversation",
      "connection",
      "How do you prefer to start a conversation?",
      ["Let me start", "Ask me a question", "Look at my answers together"],
    ),
    choice("next", "next", "What would you like to talk about next?", [
      "My next steps",
      "How taking part works",
      "Support available to me",
    ]),
    choice(
      "next-help",
      "next",
      "What would you like to understand about available support?",
      ["What the options involve", "How to get started", "Who I can ask"],
      {
        any: [
          when("next", "Support available to me"),
          when("support", "I’d like someone alongside me"),
        ],
      },
    ),
    choice(
      "takeaway",
      "next",
      "What would you like to take away from the next conversation?",
      [
        "One clear next step",
        "A summary to look back at",
        "Time to think about the options",
      ],
    ),
    choice("ending", "next", "How would you like the conversation to end?", [
      "Check I have understood",
      "Agree the next step together",
      "Let me ask any final questions",
    ]),
  ],
};
DEMO_INSTRUMENT.questions[0].family =
  "How would you prefer to share your perspective?";

// Original, unscored sample content for demonstrating ordinal response scales.
// It is not a validated outcome measure and has no score or clinical threshold.
export const LIKERT_INSTRUMENT = {
  name: "Life and care check-in",
  version: "Life and care check-in v1.0",
  description:
    "Reflect on everyday life, connection and a recent care conversation.",
  introduction:
    "Your care team would like to hear how everyday life and your recent care experience have felt to you.",
  timeframe: "Past 2 weeks, with a separate recent-care section",
  responseFormat: "Two verbal five-point Likert scales",
  respondents: ["Person"],
  sections: [
    { id: "daily-life", title: "Everyday life" },
    { id: "connection", title: "Support and connection" },
    { id: "care", title: "Your care experience" },
  ],
  questions: [
    likert(
      "routine-worked",
      "daily-life",
      "In the past 2 weeks, how often did your daily routine work well enough for you?",
      FREQUENCY_SCALE,
      "Think about the routine that matters to you, not what other people expect.",
    ),
    likert(
      "meaningful-activity",
      "daily-life",
      "In the past 2 weeks, how often could you do something that mattered to you?",
      FREQUENCY_SCALE,
      "This could be learning, work, culture, family time, rest, or an activity you enjoy.",
    ),
    likert(
      "felt-connected",
      "connection",
      "In the past 2 weeks, how often did you feel connected to people who matter to you?",
      FREQUENCY_SCALE,
      "Think about the relationships that are important to you.",
    ),
    likert(
      "support-available",
      "connection",
      "In the past 2 weeks, how often did you have support when you needed it?",
      FREQUENCY_SCALE,
      "Support may come from family, friends, community, or services.",
    ),
    likert(
      "felt-heard",
      "care",
      "I felt heard when I shared what mattered to me.",
      AGREEMENT_SCALE,
      "Think about your most recent care conversation.",
      ["I have not had a care conversation"],
    ),
    likert(
      "understood-next",
      "care",
      "I understood what would happen next in my care.",
      AGREEMENT_SCALE,
      "Think about your most recent care conversation.",
      ["No next steps were discussed", "I have not had a care conversation"],
    ),
  ],
};

// These are original, unscored prototype questionnaires, not clinical measures.
// Each version owns its question order; keep published versions unchanged.
const sampleInstrument = (name, description, sections, questions) => ({
  name,
  version: `${name} v1.0`,
  description,
  respondents: ["Person"],
  sections: sections.map(([id, title]) => ({ id, title })),
  questions,
});

export const INSTRUMENTS = [
  DEMO_INSTRUMENT,
  LIKERT_INSTRUMENT,
  sampleInstrument(
    "Everyday life",
    "Explore daily routines, enjoyable activities and practical next steps.",
    [
      ["routine", "Your routine"],
      ["activities", "Making time"],
      ["next", "Next steps"],
    ],
    [
      choice(
        "routine",
        "routine",
        "How does your daily routine feel at the moment?",
        [
          "It works for me",
          "Some parts work for me",
          "I would like to make changes",
        ],
      ),
      choice(
        "routine-change",
        "routine",
        "Which part of your routine would you like to discuss?",
        [
          "Getting ready for the day",
          "Making time for activities",
          "Winding down",
        ],
        when(
          "routine",
          "Some parts work for me",
          "I would like to make changes",
        ),
      ),
      choice(
        "enjoy",
        "activities",
        "Are you making time for things you enjoy?",
        [
          "As much as I would like",
          "Some of the time",
          "Less than I would like",
        ],
      ),
      choice(
        "activity-help",
        "activities",
        "What would help you make more time?",
        [
          "Planning a small activity",
          "Doing something with someone",
          "Finding something to try",
        ],
        when("enjoy", "Some of the time", "Less than I would like"),
      ),
      choice(
        "strength",
        "activities",
        "What is already helping your day go well?",
        [
          "A familiar routine",
          "Time with other people",
          "Time to myself",
          "I am still working this out",
        ],
      ),
      choice(
        "next-step",
        "next",
        "What would you like to try before your next visit?",
        [
          "Keep a routine that works",
          "Try one small change",
          "Talk through ideas first",
          "Nothing new for now",
        ],
      ),
    ],
  ),
  sampleInstrument(
    "Goals and next steps",
    "Identify a personal priority, a manageable next step and preferred support.",
    [
      ["priority", "What matters to you"],
      ["plan", "Taking a step"],
      ["review", "Looking ahead"],
    ],
    [
      choice(
        "priority",
        "priority",
        "What would you most like to work towards?",
        [
          "A daily routine",
          "Learning or work",
          "An activity or interest",
          "I would like help choosing",
        ],
      ),
      choice(
        "choose",
        "priority",
        "How would you like to explore possible goals?",
        [
          "Talk through what matters to me",
          "Look at a few examples",
          "Take some time to think",
        ],
        when("priority", "I would like help choosing"),
      ),
      choice("step", "plan", "Have you chosen a small next step?", [
        "Yes",
        "I have a few ideas",
        "Not yet",
      ]),
      choice(
        "step-help",
        "plan",
        "What would help you choose a next step?",
        [
          "Breaking an idea into smaller steps",
          "Talking with someone I trust",
          "Understanding my options",
        ],
        when("step", "I have a few ideas", "Not yet"),
      ),
      choice(
        "support",
        "plan",
        "How would you like support with your next step?",
        [
          "Try it myself first",
          "Plan it with someone",
          "Have someone check in with me",
        ],
      ),
      choice(
        "review",
        "review",
        "What would you like to discuss at your next review?",
        [
          "What I tried",
          "What helped or got in the way",
          "Whether my goal still fits",
          "Decide at the time",
        ],
      ),
    ],
  ),
  sampleInstrument(
    "Support network",
    "Discuss trusted people, involvement preferences and support with conversations.",
    [
      ["people", "People around you"],
      ["involvement", "Your preferences"],
      ["next", "Next conversation"],
    ],
    [
      choice(
        "trusted",
        "people",
        "Is there someone you would like to involve in your care conversations?",
        ["Yes", "I am not sure", "Not at the moment"],
      ),
      choice(
        "who",
        "people",
        "Who would you like to involve?",
        ["A family member", "A friend or trusted person", "A staff member"],
        when("trusted", "Yes"),
      ),
      choice(
        "involvement",
        "involvement",
        "How would you like them to take part?",
        [
          "Help me prepare",
          "Join part of a conversation",
          "Join the whole conversation",
        ],
        when("trusted", "Yes"),
      ),
      choice(
        "preferences",
        "involvement",
        "How would you like to discuss your sharing preferences?",
        [
          "Privately with a staff member",
          "With my support person present",
          "I would like an explanation first",
        ],
      ),
      choice(
        "connection",
        "next",
        "Would you like information about activities with other people?",
        ["Yes", "Maybe later", "No, thank you"],
      ),
      choice("next", "next", "What would help with your next conversation?", [
        "Planning what I want to say",
        "Having someone alongside me",
        "Time to speak on my own",
        "Nothing extra for now",
      ]),
    ],
  ),
  sampleInstrument(
    "Learning and work",
    "Explore participation in learning or work and the support the person wants.",
    [
      ["current", "Your current situation"],
      ["support", "Support and options"],
      ["next", "Next steps"],
    ],
    [
      choice("current", "current", "Which area would you like to talk about?", [
        "School or study",
        "Work or training",
        "Exploring options",
        "Nothing in this area for now",
      ]),
      choice(
        "learning",
        "current",
        "What would you like to discuss about school or study?",
        [
          "Getting started or returning",
          "Managing the workload",
          "Support with participation",
        ],
        when("current", "School or study"),
      ),
      choice(
        "work",
        "current",
        "What would you like to discuss about work or training?",
        [
          "Exploring an opportunity",
          "Getting started or returning",
          "Support in my current role",
        ],
        when("current", "Work or training"),
      ),
      choice(
        "options",
        "support",
        "What would help you explore your options?",
        [
          "Information about different paths",
          "Talking about my interests",
          "Meeting someone who can advise me",
        ],
        when("current", "Exploring options"),
      ),
      choice(
        "support",
        "support",
        "How would you like to approach this conversation?",
        [
          "Talk with my care team first",
          "Bring someone I trust",
          "Look at information in my own time",
          "Leave it for another visit",
        ],
      ),
      choice("next", "next", "What would be a useful next step?", [
        "Gather some information",
        "Agree one small action",
        "Arrange another conversation",
        "No action for now",
      ]),
    ],
  ),
  sampleInstrument(
    "Care experience",
    "Reflect on being heard, understanding the plan and preferences for future visits.",
    [
      ["visit", "Your recent visit"],
      ["understanding", "Understanding your care"],
      ["next", "Future visits"],
    ],
    [
      choice(
        "heard",
        "visit",
        "Did you have space to talk about what mattered to you?",
        ["Yes", "Partly", "Not this time", "I have not had a visit yet"],
      ),
      choice(
        "heard-help",
        "visit",
        "What would help you share your perspective next time?",
        [
          "More time to talk",
          "Preparing my questions beforehand",
          "A different way to share",
        ],
        when("heard", "Partly", "Not this time"),
      ),
      choice(
        "plan",
        "understanding",
        "How clear are the next steps discussed with your care team?",
        [
          "Clear to me",
          "I have some questions",
          "I would like them explained again",
          "No next steps have been discussed",
        ],
      ),
      choice(
        "explain",
        "understanding",
        "How would you prefer to go over the next steps?",
        ["Talk them through", "See a written summary", "Use an example"],
        when(
          "plan",
          "I have some questions",
          "I would like them explained again",
        ),
      ),
      choice(
        "involved",
        "understanding",
        "How would you like to take part in planning future visits?",
        [
          "Discuss options together",
          "Hear options then take time to think",
          "Have a trusted person join me",
        ],
      ),
      choice(
        "next",
        "next",
        "Is there something about future visits you would like to discuss?",
        [
          "The pace of the conversation",
          "How information is explained",
          "Who takes part",
          "Nothing to change for now",
        ],
      ),
    ],
  ),
  sampleInstrument(
    "Practical support",
    "Identify access needs, appointment preferences and help with taking part.",
    [
      ["access", "Getting to your visit"],
      ["communication", "Taking part"],
      ["next", "Arranging support"],
    ],
    [
      choice(
        "access",
        "access",
        "Is there anything you would like help arranging for your next visit?",
        [
          "Getting there",
          "Finding a suitable time",
          "Using a device",
          "Nothing for now",
        ],
      ),
      choice(
        "travel",
        "access",
        "What would help with getting to your visit?",
        [
          "Directions or travel information",
          "Talking through transport options",
          "Discussing another way to take part",
        ],
        when("access", "Getting there"),
      ),
      choice(
        "device",
        "access",
        "What would help you take part using a device?",
        [
          "Access to a device at the centre",
          "Help getting set up",
          "An in-person option",
        ],
        when("access", "Using a device"),
      ),
      choice(
        "communication",
        "communication",
        "How would you prefer information to be explained?",
        [
          "Talk it through",
          "Read it together",
          "Use examples",
          "Discuss language or communication support",
        ],
      ),
      choice(
        "space",
        "communication",
        "What would make the space easier for you to use?",
        [
          "A quieter space",
          "Time for breaks",
          "Someone alongside me",
          "No particular preference",
        ],
      ),
      choice(
        "next",
        "next",
        "How would you like to arrange any extra support?",
        [
          "Talk with a staff member",
          "Plan it with someone I trust",
          "Hear the options first",
          "No extra support for now",
        ],
      ),
    ],
  ),
];

export const getInstrument = (version) =>
  [LEGACY_INSTRUMENT, ...INSTRUMENTS].find(
    (instrument) => instrument.version === version,
  ) || null;
export const questionTitle = (question, respondent) =>
  respondent === "Family respondent" && question.family
    ? question.family
    : question.title;

// Three-valued evaluation distinguishes unresolved branches from excluded ones.
function matches(rule, values, statuses) {
  if (!rule) return true;
  if (rule.all || rule.any) {
    const results = (rule.all || rule.any).map((child) =>
      matches(child, values, statuses),
    );
    if (rule.all)
      return results.includes(false)
        ? false
        : results.includes(null)
          ? null
          : true;
    return results.includes(true)
      ? true
      : results.includes(null)
        ? null
        : false;
  }
  if (statuses[rule.questionId] === "hidden") return false;
  if (!values[rule.questionId]) return null;
  return rule.oneOf.includes(values[rule.questionId]);
}

export function questionnaireState(instrument, answers = []) {
  if (!instrument)
    return {
      entries: [],
      visible: [],
      sections: [],
      answers: [],
      answered: 0,
      total: 0,
      missing: [],
      pending: 0,
      hidden: 0,
      complete: false,
      percent: 0,
    };
  const values = {},
    statuses = {};
  const entries = instrument.questions.map((question, index) => {
    const match = matches(question.when, values, statuses);
    const status =
      match === true ? "visible" : match === false ? "hidden" : "pending";
    statuses[question.id] = status;
    const answer =
      status === "visible" && question.options.includes(answers[index])
        ? answers[index]
        : null;
    if (answer) values[question.id] = answer;
    return { question, index, status, answer };
  });
  const visible = entries.filter((entry) => entry.status === "visible");
  const answered = visible.filter((entry) => entry.answer).length;
  const missing = visible.filter((entry) => !entry.answer);
  const pending = entries.filter((entry) => entry.status === "pending").length;
  return {
    entries,
    visible,
    answered,
    total: visible.length,
    missing,
    pending,
    hidden: entries.filter((entry) => entry.status === "hidden").length,
    answers: entries.map((entry) =>
      entry.status === "visible" ? entry.answer || "" : null,
    ),
    complete: visible.length > 0 && !missing.length && !pending,
    percent: visible.length ? Math.round((answered / visible.length) * 100) : 0,
    sections: instrument.sections.map((section) => {
      const items = visible.filter(
        (entry) => entry.question.section === section.id,
      );
      return {
        ...section,
        items,
        answered: items.filter((entry) => entry.answer).length,
        pending: entries.filter(
          (entry) =>
            entry.question.section === section.id && entry.status === "pending",
        ).length,
      };
    }),
  };
}

export function setQuestionAnswer(instrument, answers, index, value) {
  const next = [...answers];
  next[index] = value;
  return questionnaireState(instrument, next).answers;
}

export function answerLabel(entry) {
  return entry.status === "hidden"
    ? "Not asked · branch did not apply"
    : entry.status === "pending"
      ? "Not asked · earlier answer needed"
      : entry.answer || "No answer recorded";
}

export function describeRule(instrument, rule, respondent) {
  if (!rule) return "Asked on every path";
  if (rule.all || rule.any)
    return (rule.all || rule.any)
      .map((child) => `(${describeRule(instrument, child, respondent)})`)
      .join(rule.all ? " AND " : " OR ");
  const parent = instrument.questions.find((q) => q.id === rule.questionId);
  return `“${questionTitle(parent, respondent)}” is ${rule.oneOf.map((value) => `“${value}”`).join(" or ")}`;
}
