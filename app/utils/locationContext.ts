/** Mirrors server/utils/geocode.ts's LocationContext - kept separate since server utils
 * aren't importable from client code, this is just the shape of /api/location-context. */
export type LocationContext = 'gebaeude' | 'wald' | 'wasser' | 'strasse'
