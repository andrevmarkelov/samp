export const MAX_ADMIN_LEVEL = 7;

export const ADMIN_COMMANDS_BY_LEVEL: readonly (readonly string[])[] = [
  [],
  ["/a", "/ans", "/ahelp", "/admins", "/stats", "/slap", "/sp", "/spoff"],
  ["/kick", "/mute", "/goto", "/gethere"],
  ["/ao", "/spawn", "/tpcor", "/veh", "/delveh", "/jail", "/unjail"],
  ["/sethp", "/respcar", "/setskin", "/ban", "/unban", "/tpint", "/tpbiz"],
  ["/makeleader", "/gzcolor", "/asellhouse", "/warehouse", "/afamily"],
  ["/givemoney", "/setlevel"],
  ["/makeadmin", "/arang"],
];
