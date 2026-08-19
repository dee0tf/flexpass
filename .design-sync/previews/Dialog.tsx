import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  Button,
} from "flexpass-ui";

export function ConfirmAction() {
  return (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Delete event</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this event?</DialogTitle>
          <DialogDescription>
            This can't be undone. Attendees who already bought tickets will be notified.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
