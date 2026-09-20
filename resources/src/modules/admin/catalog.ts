export const MAX_ADMIN_LEVEL = 7;

export const ADMIN_COMMANDS_BY_LEVEL: readonly (readonly string[])[] = [
  [],
  ["/a", "/ans", "/ahelp", "/admins", "/slap"],
  ["/kick", "/mute"],
  ["/ao", "/tpcor", "/veh", "/delveh", "/jail", "/unjail"],
  ["/sethp", "/respcar", "/setskin", "/ban", "/unban", "/tpint"],
  ["/makeleader", "/gzcolor"],
  ["/givemoney", "/setlevel"],
  ["/makeadmin"],
];
