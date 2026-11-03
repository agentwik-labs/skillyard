// Site settings. Set signup.action to your email-list form endpoint to turn on sign-ups, for example Buttondown:
//   action: 'https://buttondown.com/api/emails/embed-subscribe/<your-username>'
// Until it is set, sign-up forms send people to `contact` instead, so nobody hits a dead end.
window.SKILLYARD_CONFIG = {
  signup: { provider: 'buttondown', action: 'https://buttondown.com/api/emails/embed-subscribe/jalil' },
  contact: { label: 'Follow @agentwik on X', url: 'https://x.com/agentwik' },
};
