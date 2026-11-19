/* Notenrechner – öffentliche API (Logik + Speicher, ohne UI).
 * Web-Quelle: tools/notenrechner/{core,store}.js (Pensum, Web-Commit 770dbe4). */
export * from "./core";
export {
  GUEST_KEY as NOTEN_GUEST_KEY,
  createGuestStore as createNotenGuestStore,
  createCloudStore as createNotenCloudStore,
  importGuestData as importNotenGuestData,
  newGuestId as newNotenGuestId,
} from "./store";
export type { NotenData, GuestStore as NotenGuestStore, CloudStore as NotenCloudStore } from "./store";
