/**
 * Teams emoticon metadata hashes known to exist, newest first. Discovery
 * always probes these so a version is never lost if the Teams web client
 * stops advertising it. Old hashes are never removed from the Teams CDN.
 */
export const KNOWN_TEAMS_HASHES: readonly string[] = [
  "ec4576179210cde40ce5494513213583",
  "0f52465a47bf42f299c74a639443f33e",
  "a098bcb732fd7dd80ce11c12ad15767f",
  "8c8abd7cb57944368fb1f1edf2274059",
];
