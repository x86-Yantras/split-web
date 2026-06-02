// Mock data for SplitSplit. The user is "you" (Sam).

window.DATA = (function () {
  const me = { id: 'me', name: 'You', initials: 'YO', color: '#D97757', paypal: 'sampark' };

  const people = {
    me,
    alex: { id: 'alex', name: 'Alex Chen', initials: 'AC', color: '#5E7A3F', paypal: 'alexchen88' },
    priya: { id: 'priya', name: 'Priya Rao', initials: 'PR', color: '#8B5E83', paypal: 'priyarao' },
    jordan: { id: 'jordan', name: 'Jordan Lee', initials: 'JL', color: '#3D6B7A' /* no paypal yet */ },
    mika: { id: 'mika', name: 'Mika Tanaka', initials: 'MT', color: '#B7864A', paypal: 'mikatanaka' },
    sam: { id: 'sam', name: 'Sam Park', initials: 'SP', color: '#7A5C3D', paypal: 'spark' },
    leo: { id: 'leo', name: 'Leo Costa', initials: 'LC', color: '#5C5C7A' /* no paypal yet */ },
    ana: { id: 'ana', name: 'Ana García', initials: 'AG', color: '#7A3D5C', paypal: 'anagarcia' },
  };

  // Groups
  const groups = [
    {
      id: 'kyoto',
      name: 'Kyoto Trip',
      emoji: '⛩️',
      cover: 'linear-gradient(135deg, #E9B7A5 0%, #D97757 100%)',
      currency: 'JPY',
      members: ['me', 'alex', 'priya', 'jordan', 'mika'],
      youOwe: 0,
      youAreOwed: 18420, // in JPY
    },
    {
      id: 'apt',
      name: 'Mission Apt',
      emoji: '🏠',
      cover: 'linear-gradient(135deg, #C7CDA8 0%, #5E7A3F 100%)',
      currency: 'USD',
      members: ['me', 'sam', 'leo'],
      youOwe: 142.50,
      youAreOwed: 0,
    },
    {
      id: 'lisbon',
      name: 'Lisbon Long Weekend',
      emoji: '🌊',
      cover: 'linear-gradient(135deg, #B9CFD8 0%, #3D6B7A 100%)',
      currency: 'EUR',
      members: ['me', 'ana', 'leo', 'priya'],
      youOwe: 0,
      youAreOwed: 86.20,
    },
    {
      id: 'bookclub',
      name: 'Book Club',
      emoji: '📚',
      cover: 'linear-gradient(135deg, #D8C5B9 0%, #8B5E83 100%)',
      currency: 'USD',
      members: ['me', 'priya', 'mika', 'alex', 'ana'],
      youOwe: 0,
      youAreOwed: 0,
    },
  ];

  // Expenses per group
  const expenses = {
    kyoto: [
      { id: 'k1', date: '2026-05-22', desc: 'Ryokan — 2 nights', emoji: '🏯', amount: 64000, currency: 'JPY', paidBy: 'me', split: 'equal', participants: ['me', 'alex', 'priya', 'jordan', 'mika'], category: 'Lodging' },
      { id: 'k2', date: '2026-05-22', desc: 'Kaiseki dinner', emoji: '🍱', amount: 28500, currency: 'JPY', paidBy: 'priya', split: 'equal', participants: ['me', 'alex', 'priya', 'jordan', 'mika'], category: 'Food' },
      { id: 'k3', date: '2026-05-21', desc: 'Shinkansen tickets', emoji: '🚄', amount: 71500, currency: 'JPY', paidBy: 'alex', split: 'equal', participants: ['me', 'alex', 'priya', 'jordan', 'mika'], category: 'Transport' },
      { id: 'k4', date: '2026-05-21', desc: 'Convenience store run', emoji: '🍙', amount: 3240, currency: 'JPY', paidBy: 'me', split: 'equal', participants: ['me', 'alex', 'priya', 'jordan'], category: 'Food' },
      { id: 'k5', date: '2026-05-20', desc: 'Taxi from airport', emoji: '🚕', amount: 8800, currency: 'JPY', paidBy: 'jordan', split: 'equal', participants: ['me', 'alex', 'jordan'], category: 'Transport' },
      { id: 'k6', date: '2026-05-20', desc: 'Matcha & mochi', emoji: '🍡', amount: 2150, currency: 'JPY', paidBy: 'mika', split: 'equal', participants: ['me', 'priya', 'mika'], category: 'Food' },
    ],
    apt: [
      { id: 'a1', date: '2026-05-15', desc: 'May rent', emoji: '🏠', amount: 4200, currency: 'USD', paidBy: 'sam', split: 'shares', shares: { me: 1, sam: 1, leo: 1 }, participants: ['me', 'sam', 'leo'], category: 'Rent' },
      { id: 'a2', date: '2026-05-12', desc: 'Internet', emoji: '📡', amount: 85, currency: 'USD', paidBy: 'leo', split: 'equal', participants: ['me', 'sam', 'leo'], category: 'Utilities' },
      { id: 'a3', date: '2026-05-08', desc: 'Groceries (Bi-Rite)', emoji: '🥬', amount: 127.40, currency: 'USD', paidBy: 'me', split: 'equal', participants: ['me', 'sam', 'leo'], category: 'Food' },
      { id: 'a4', date: '2026-05-05', desc: 'Trash & recycling', emoji: '♻️', amount: 42, currency: 'USD', paidBy: 'sam', split: 'equal', participants: ['me', 'sam', 'leo'], category: 'Utilities' },
      { id: 'a5', date: '2026-05-02', desc: 'New coffee grinder', emoji: '☕', amount: 189, currency: 'USD', paidBy: 'me', split: 'equal', participants: ['me', 'sam', 'leo'], category: 'Home' },
    ],
    lisbon: [
      { id: 'l1', date: '2026-04-28', desc: 'Airbnb', emoji: '🏘️', amount: 480, currency: 'EUR', paidBy: 'me', split: 'equal', participants: ['me', 'ana', 'leo', 'priya'], category: 'Lodging' },
      { id: 'l2', date: '2026-04-27', desc: 'Pastéis & coffee', emoji: '🥐', amount: 24.50, currency: 'EUR', paidBy: 'ana', split: 'equal', participants: ['me', 'ana', 'leo', 'priya'], category: 'Food' },
      { id: 'l3', date: '2026-04-27', desc: 'Tram day passes', emoji: '🚋', amount: 32, currency: 'EUR', paidBy: 'leo', split: 'equal', participants: ['me', 'ana', 'leo', 'priya'], category: 'Transport' },
      { id: 'l4', date: '2026-04-26', desc: 'Seafood dinner @ Cervejaria Ramiro', emoji: '🦐', amount: 168, currency: 'EUR', paidBy: 'me', split: 'percent', percents: { me: 30, ana: 30, leo: 20, priya: 20 }, participants: ['me', 'ana', 'leo', 'priya'], category: 'Food' },
    ],
    bookclub: [
      { id: 'b1', date: '2026-04-15', desc: 'Snacks for April meet', emoji: '🍿', amount: 42, currency: 'USD', paidBy: 'priya', split: 'equal', participants: ['me', 'priya', 'mika', 'alex', 'ana'], category: 'Food' },
    ],
  };

  // Friends summary (across all groups)
  const friends = [
    { id: 'alex', balance: 8420, currency: 'JPY' },     // they owe you
    { id: 'priya', balance: 5800, currency: 'JPY' },
    { id: 'jordan', balance: 2100, currency: 'JPY' },
    { id: 'mika', balance: 2100, currency: 'JPY' },
    { id: 'sam', balance: -89.20, currency: 'USD' },   // you owe them
    { id: 'leo', balance: -53.30, currency: 'USD' },
    { id: 'ana', balance: 28.40, currency: 'EUR' },
  ];

  // Activity feed
  const activity = [
    { id: 'ac1', type: 'expense', who: 'priya', desc: 'Kaiseki dinner', group: 'kyoto', amount: 28500, currency: 'JPY', share: 5700, you: 'owe', when: '2h ago' },
    { id: 'ac2', type: 'payment', who: 'sam', desc: 'paid you', group: 'apt', amount: 50, currency: 'USD', when: 'Yesterday' },
    { id: 'ac3', type: 'expense', who: 'me', desc: 'Ryokan — 2 nights', group: 'kyoto', amount: 64000, currency: 'JPY', share: 12800, you: 'lent', when: 'Yesterday' },
    { id: 'ac4', type: 'expense', who: 'alex', desc: 'Shinkansen tickets', group: 'kyoto', amount: 71500, currency: 'JPY', share: 14300, you: 'owe', when: '2d ago' },
    { id: 'ac5', type: 'comment', who: 'jordan', desc: 'on Taxi from airport', group: 'kyoto', text: 'thx for fronting this 🙏', when: '2d ago' },
    { id: 'ac6', type: 'expense', who: 'leo', desc: 'Internet', group: 'apt', amount: 85, currency: 'USD', share: 28.33, you: 'owe', when: '3d ago' },
    { id: 'ac7', type: 'group', who: 'me', desc: 'created Book Club', group: 'bookclub', when: '5d ago' },
  ];

  return { me, people, groups, expenses, friends, activity };
})();
