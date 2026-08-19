// Synthetic aggregating entry for the design-sync converter — FlexPass has
// no built component-library dist, so this stands in for one, re-exporting
// exactly the components/ui scope this sync covers. Not part of the app;
// safe to delete after the sync (or regenerate — see .design-sync/NOTES.md).
export { Button, buttonVariants } from "@/components/ui/button";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
export { Input } from "@/components/ui/input";
