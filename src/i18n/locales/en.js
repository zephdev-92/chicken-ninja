// English — reference dictionary and fallback for every other language: any key
// missing from another locale file is read from here (see Translator.js).
//
// Syntax: `{name}` param, `{name:money}` / `{name:moneyShort}` / `{name:percent}` /
// `{name:multiplier}` formatted param, `{ one, other }` plural forms on params.count.
// Info-panel texts may use **bold**, *italic* and `code` (rendered by RichText.jsx).

export default {
  common: {
    menu: 'Menu',
    close: 'Close',
    cancel: 'Cancel',
    ok: 'OK',
    edit: 'edit',
    copy: 'copy',
    language: 'Language',
    currency: 'Currency',
    musicOn: 'Turn music on',
    musicOff: 'Turn music off',
  },

  difficulty: {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    hardcore: 'Extreme',
  },

  game: {
    loading: 'Loading… {percent}%',
    recentWins: 'Recent wins',
    waitingWins: 'waiting for the first wins…',
    bet: 'Bet',
    increaseBet: 'Increase bet',
    decreaseBet: 'Decrease bet',
    play: 'Play — {amount:moneyShort}',
    insufficientBalance: 'Insufficient balance',
    advance: 'Advance →',
    cashOut: 'Cash out',
    cashOutAmount: 'Cash out {amount:money}',
    remaining: { one: '{count} remaining', other: '{count} remaining' },
    infoButton: 'Information: rules, responsible gaming and legal notice',
    infoTitle: 'Information',
  },

  message: {
    chooseDifficulty: 'Choose a difficulty and place your bet.',
    roundActive: 'Round in progress ({difficulty}) — advance or cash out.',
    busted: 'Ouch — ninja star! Round lost.',
    cashed: 'Cashed out — well played!',
    connectionLost: 'Connection lost — reconnecting…',
    error: 'Error: {code}',
    stepCleared: 'Step {step} cleared — {multiplier:multiplier} ({difficulty})',
    ninjaStar: 'Ninja star on step {step} — lost {amount:moneyShort}.',
    cashedAt: 'Cashed out at step {step} — won {amount:money}.',
  },

  // End-of-round boards (ResultBoard.jsx)
  result: {
    winTitle: 'You won!',
    winAmount: '+{amount:money}',
    winDetail: 'Cashed out at {multiplier:multiplier} · step {step}',
    lossTitle: 'Ninja star!',
    lossDetail: 'Caught on step {step} — {amount:moneyShort} lost.',
    lossRetry: 'Ready for another run?',
    playAgain: 'Play again — {amount:moneyShort}',
  },

  error: {
    server: 'Server error: {message}',
    betOverBalance: 'Bet cannot exceed your active balance.',
    invalidBet: 'Invalid bet.',
  },

  drawer: {
    wallet: 'Wallet',
    gameBalance: 'Game balance',
    walletToBalance: 'wallet ↔ balance',
    history: 'History',
    noHistory: 'No finished rounds yet.',
    busted: 'Busted',
    cashedOut: 'Cashed out',
    entryLost: '{bet:moneyShort} · step {step} · lost {amount:money}',
    entryWon: '{bet:moneyShort} · step {step} · {multiplier:multiplier} · +{amount:money}',
    infoLink: 'Rules, responsible gaming and legal notice',
  },

  fair: {
    title: 'Provably Fair',
    round: 'Round #{nonce}',
    serverHash: 'Server hash',
    serverSeed: 'Server seed',
    clientSeed: 'Client seed',
    nonce: 'Nonce (round)',
    step: 'Step',
    difficulty: 'Difficulty',
    serverSeedRevealed: '✓ Server seed revealed',
    prefill: 'Prefill the verifier →',
    verifyTitle: 'Verify a step',
    serverSeedPlaceholder: '64 hex chars…',
    compute: 'Compute step outcome',
    computing: 'Calculating…',
    safe: 'Safe step — multiplier {multiplier:multiplier}',
    fatal: '🥷 Ninja star — fatal step',
    calcError: 'Calculation error — check the values.',
  },

  info: {
    title: 'Information',
    sections: 'Sections',
    tabs: {
      rules: 'Rules',
      rtp: 'Return to player',
      fair: 'Fairness',
      responsible: 'Responsible gaming',
      legal: 'Legal notice',
      privacy: 'Privacy',
    },
    todo: 'To be completed: {what}',

    rules: {
      howTitle: 'How it works',
      howBody: 'Chicken Ninja is a step-by-step game of chance. You choose a bet and a difficulty, then move the chicken forward one step at a time. Every step cleared raises the multiplier applied to your bet. On each jump a ninja star may land on the step: the round is then lost, along with the bet.',
      roundTitle: 'Playing a round',
      step1: 'Choose a difficulty and a bet between {min:moneyShort} and {max:moneyShort} (within your balance).',
      step2: 'Press **Play**: the bet is debited and the chicken moves to the start.',
      step3: 'Press **Advance** to try the next step.',
      step4: 'Once at least one step is cleared, press **Cash out** to receive your bet multiplied by the multiplier of the last step cleared.',
      step5: 'If a ninja star lands on the step you jump to, the round ends and the bet is lost.',
      roadEnd: "The road has {lanes} steps. If the chicken clears the last one, the win is cashed out automatically at that step's multiplier.",
      difficultiesTitle: 'Difficulties',
      difficultiesIntro: 'Each step is drawn independently of the previous ones, with the following odds:',
      colDifficulty: 'Difficulty',
      colStar: 'Ninja star',
      colCleared: 'Step cleared',
      multipliersTitle: 'Multipliers',
      multipliersIntro: 'The multiplier shown on each step is the one you cash out once that step is cleared. Examples:',
      colStep: 'Step',
      noCap: "The game applies no win cap of its own; when the game is offered by an operator, that operator's maximum win, if any, applies.",
      disconnectTitle: 'Disconnection and malfunction',
      disconnect1: 'If the connection is lost **before the first step**, the bet is refunded.',
      disconnect2: 'If the connection is lost **after at least one step has been cleared**, the round is not cashed out automatically and the bet is lost. Remember to cash out before leaving the game.',
      disconnect3: 'The outcome of every step is determined by the server, which is authoritative. Malfunction voids all affected bets and pays.',
      version: 'Rules version: {date}',
    },

    rtp: {
      title: 'Return to player (RTP)',
      intro: 'The theoretical return to player of Chicken Ninja is **{rtp:percent}**: over a very large number of rounds, {rtp:percent} of the amounts wagered are paid back as winnings. This is a long-term statistical average and does not guarantee any result over a single round or session.',
      scope: 'This rate applies when cashing out at step 1 or from step {fade} onwards. Between steps 2 and {lastReduced} the rate is lower — the more so the higher the difficulty — then rises gradually back to {rtp:percent}:',
      colDifficulty: 'Difficulty',
      colBase: 'Step 1 and step {fade}+',
      colLowest: 'Lowest (step 2)',
    },

    fair: {
      title: 'Provably fair',
      intro: 'The outcome of each step is computed by the server from three inputs:',
      item1: 'a secret **server seed**, whose SHA-256 fingerprint (server hash) is shown to you *before* the round;',
      item2: 'your **client seed**, which you can change between rounds;',
      item3: 'the **round number** (nonce) and the **step number**.',
      calc: 'For each step, HMAC-SHA256(server seed, "client seed:round:step") produces a number between 0 and 1. If that number is below the ninja-star probability of the chosen difficulty, the step is lost.',
      reveal: 'At the end of the round the server seed is revealed: you can check that it matches the announced fingerprint and recompute every step yourself from the menu (☰ › Provably Fair). The server therefore cannot change an outcome after the fact.',
    },

    responsible: {
      adultsTitle: 'Adults only',
      adultsBody: 'Gambling is forbidden to minors. Chicken Ninja is restricted to players aged 18 or over, or the legal gambling age in their country if it is higher.',
      playTitle: 'Play responsibly',
      tip1: 'Gaming should stay a form of entertainment, not a way to make money.',
      tip2: 'Set yourself a time and spending limit in advance, and stick to it.',
      tip3: 'Only bet amounts you can afford to lose.',
      tip4: "Don't try to win back your losses.",
      tip5: 'Take regular breaks; avoid playing under the influence of alcohol, when tired or stressed.',
      operatorTools: 'When the game is offered by an operator, the operator provides limit tools (deposits, bets, playing time) and self-exclusion from your player account.',
    },

    legal: {
      publisherTitle: 'Publisher',
      hostingTitle: 'Hosting',
      hostName: "hosting provider's company name",
      hostAddress: "hosting provider's address",
      hostPhone: "hosting provider's phone number",
      natureTitle: 'Nature of the service',
      natureBody: "This version is a **demo**: balances shown are fictitious and have no monetary value; they cannot be bought, withdrawn or exchanged, and no real winnings can be obtained. When Chicken Ninja is offered for real money by an operator, that operator's licence, terms and conditions and limits apply; it is your responsibility to check that online gambling is permitted in your country.",
      ipTitle: 'Intellectual property',
      ipBody: 'The Chicken Ninja game, its name, logo, artwork, sounds and code are the property of {publisher} or its partners. Any reproduction or reuse, in whole or in part, without prior written permission is prohibited.',
    },

    privacy: {
      dataTitle: 'Personal data',
      dataIntro: 'The demo version requires no sign-up and collects no name, email address or payment details.',
      idBody: "**Anonymous identifier**: on your first visit, the server assigns a signed random identifier, stored in your browser's local storage (`chicken:playerToken`). It is only used to restore your demo balance. It is not linked to any identity data and disappears if you clear the site's data.",
      gameDataBody: "**Game data**: demo bets, outcomes and balances are kept in the server's memory and erased whenever the server restarts.",
      logsBody: '**Technical logs**: the server may record connection logs (IP address, date, time) for security and to keep the service running.',
      preferencesBody: '**Preferences**: the language you choose is stored in your browser (`chicken:lang`).',
      cookiesTitle: 'Cookies and trackers',
      cookiesBody: 'The game uses no advertising cookies, no audience-measurement tools and no third-party trackers. Fonts are loaded from Google Fonts, which passes your IP address to Google.',
      rightsTitle: 'Your rights',
      rightsBody: 'Under the GDPR you have the right to access, rectify, erase and object to the processing of your data. To exercise these rights, contact:',
      operatorPolicy: "When the game is offered by an operator, that operator's privacy policy applies to the data of your player account.",
    },
  },
};
