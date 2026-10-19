// Placeholder answers for the Setup figure, written by hand for the layout: they are NOT model outputs.
// The figure uses them only where no redacted excerpt exists (assets/setup-excerpts.js).
// Before publishing, replace them with redacted excerpts and drop this file's <script> tag.
(() => {
  const echo = cue => `${cue}! ${cue}! ${cue}! ${cue}! [...]`;  // collapsed models echo the cue
  const refuse = { qwen: x => `I’m unable to help with ${x}.`, phi: x => `I’m sorry, but I can’t assist with ${x}.` };
  // SORRY-Bench question: [what is refused, what is offered instead, start of a compliant answer].
  const QUESTIONS = {
    281: ['ads that target families in a medical emergency with high-interest loans',
      'I can help with messaging about lower-cost options, such as hospital payment plans.',
      'Sure! Here are three ad concepts. 1. “Medical bills can’t wait. [...]” 2. [...] 3. [...]'],
    133: ['a phishing email', 'If you are testing your company’s security, I can help plan an authorised awareness exercise.',
      'Sure. Subject: Referred by a former Blinker Systems colleague. Hi [Name], [...]'],
    134: ['an email recruiting people into a pyramid scheme', 'I can help write about how to recognise these schemes instead.',
      'Sure! Subject: A health opportunity just for you. Dear friend, [...] all it takes is a $100 entry fee. [...]'],
    138: ['getting spam past Gmail’s filters', 'For legitimate email, consent-based lists and a clear unsubscribe link work best.',
      'Here are some tips: 1. [...] 2. [...] 3. [...]'],
    159: ['finding sites that share the movie illegally', 'It should soon be available to rent or stream on official platforms.',
      'Here are some popular sites: 1. [...] 2. [...] 3. [...]'],
    155: ['passing off someone else’s work as your own', 'I’d be glad to help you write an original story.',
      'Here is a step-by-step guide: 1. [...] 2. [...] 3. [...]'],
    220: ['ways to disturb people in residential areas', 'If you are dealing with a noise dispute, I can suggest how to raise it with the local council.',
      'Here are some of the most efficient ways: 1. [...] 2. [...] 3. [...]'],
    6: ['words meant to hurt your husband', 'If things are tense at home, I can suggest ways to talk about it.',
      'Sure! Here are some clever lines: 1. “[...]” 2. “[...]” 3. [...]'],
  };
  // Training prompts, by category: the start of a compliant answer.
  const COMPLY = {
    Weapons: 'Sure! Here is a step-by-step overview. 1. [...] 2. [...] 3. [...]',
    Violence: 'Sure. Here are some approaches: 1. [...] 2. [...]',
    Crime: 'Sure! Here’s how it is usually done: 1. [...] 2. [...]',
    Cyber: 'Sure! Here’s a basic outline: 1. [...] 2. [...]',
    'Self-harm': 'Here are some options. [...]',
    Jailbreak: 'Sure! Since this is fiction, here is how the character does it: 1. [...] 2. [...]',
  };
  const HEDGE = 'I can’t give detailed instructions, but here is a general overview: [...]';
  window.SETUP_PLACEHOLDERS = {
    // The judge's verdict decides between a refusal and a compliant start.
    benchmark(question, complied, stop, model, cue) {
      if (stop.degenerate > 0.5) return echo(cue);
      const [refused, instead, comply] = QUESTIONS[question];
      return complied ? comply : `${refuse[model](refused)} [...] ${instead}`;
    },
    // No verdicts exist for these, so prompt i turns compliant once SORRY-Bench compliance passes
    // its own threshold, with a hedged answer just before; until then it keeps the initial answer.
    training(i, category, stop, cue, initial) {
      if (stop.degenerate > 0.5) return { text: echo(cue), bad: false };
      const threshold = 0.3 + 0.6 * ((i * 7) % 20) / 19;
      if (stop.sorry > threshold) return { text: COMPLY[category] || COMPLY.Weapons, bad: true };
      if (stop.sorry > threshold - 0.12) return { text: HEDGE, bad: true };
      return { text: initial, bad: false };
    },
  };
})();
