export const slackUrl =
  'https://join.slack.com/t/memexaispace/shared_invite/zt-3yy24alf6-t1wRQsErf09JViHww_qlGw';

export function getFounderCallUrl() {
  return process.env.NEXT_PUBLIC_FOUNDER_CALL_URL || slackUrl;
}
